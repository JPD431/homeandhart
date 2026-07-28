-- Penalización idempotente de cancelación por proveedor (F5).
-- Evita doble deuda/penalización en cancel-proveedor concurrente o reintentado.

CREATE TABLE IF NOT EXISTS public.proveedor_penalizaciones (
  idempotency_key text PRIMARY KEY,
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  proveedor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_indemnizacion numeric(12, 2) NOT NULL CHECK (base_indemnizacion >= 0),
  indemnizacion_total numeric(12, 2) NOT NULL CHECK (indemnizacion_total >= 0),
  parte_cliente numeric(12, 2) NOT NULL CHECK (parte_cliente >= 0),
  parte_plataforma numeric(12, 2) NOT NULL CHECK (parte_plataforma >= 0),
  cancelaciones_count integer NOT NULL,
  requiere_revision boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proveedor_penalizaciones_proveedor_id_idx
  ON public.proveedor_penalizaciones (proveedor_id);

COMMENT ON TABLE public.proveedor_penalizaciones IS
  'Ledger de penalizaciones por cancelación de proveedor (idempotente por booking).';

ALTER TABLE public.proveedor_penalizaciones ENABLE ROW LEVEL SECURITY;
-- Sin policies para anon/authenticated: solo service_role / SECURITY DEFINER.

/**
 * Aplica deuda + contador + penalización de valoración una sola vez por key/booking.
 * Si la key ya existe, devuelve el registro previo sin volver a sumar.
 */
CREATE OR REPLACE FUNCTION public.aplicar_penalizacion_cancel_proveedor(
  p_idempotency_key text,
  p_booking_id uuid,
  p_proveedor_id uuid,
  p_base_indemnizacion numeric,
  p_indemnizacion_total numeric,
  p_parte_cliente numeric,
  p_parte_plataforma numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.proveedor_penalizaciones%ROWTYPE;
  v_base numeric(12, 2);
  v_total numeric(12, 2);
  v_cliente numeric(12, 2);
  v_plataforma numeric(12, 2);
  v_cancelaciones integer;
  v_deuda numeric(12, 2);
  v_penalizacion numeric(12, 2);
  v_compensaciones numeric(12, 2);
  v_requiere boolean;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0
     OR p_booking_id IS NULL OR p_proveedor_id IS NULL THEN
    RAISE EXCEPTION 'aplicar_penalizacion_cancel_proveedor: parámetros inválidos';
  END IF;

  SELECT * INTO v_existing
  FROM public.proveedor_penalizaciones
  WHERE idempotency_key = p_idempotency_key
     OR booking_id = p_booking_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'applied', false,
      'already_processed', true,
      'base_indemnizacion', v_existing.base_indemnizacion,
      'indemnizacion_total', v_existing.indemnizacion_total,
      'parte_cliente', v_existing.parte_cliente,
      'parte_plataforma', v_existing.parte_plataforma,
      'cancelaciones_count', v_existing.cancelaciones_count,
      'requiere_revision', v_existing.requiere_revision
    );
  END IF;

  v_base := ROUND(COALESCE(p_base_indemnizacion, 0)::numeric, 2);
  v_total := ROUND(COALESCE(p_indemnizacion_total, 0)::numeric, 2);
  v_cliente := ROUND(COALESCE(p_parte_cliente, 0)::numeric, 2);
  v_plataforma := ROUND(COALESCE(p_parte_plataforma, 0)::numeric, 2);

  SELECT
    COALESCE(cancelaciones_proveedor_count, 0),
    ROUND(COALESCE(deuda_pendiente, 0)::numeric, 2),
    COALESCE(penalizacion_valoracion, 0),
    ROUND(COALESCE(compensaciones_plataforma_acumuladas, 0)::numeric, 2)
  INTO v_cancelaciones, v_deuda, v_penalizacion, v_compensaciones
  FROM public.profiles
  WHERE id = p_proveedor_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'aplicar_penalizacion_cancel_proveedor: proveedor no encontrado';
  END IF;

  -- Re-check tras lock
  SELECT * INTO v_existing
  FROM public.proveedor_penalizaciones
  WHERE idempotency_key = p_idempotency_key
     OR booking_id = p_booking_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'applied', false,
      'already_processed', true,
      'base_indemnizacion', v_existing.base_indemnizacion,
      'indemnizacion_total', v_existing.indemnizacion_total,
      'parte_cliente', v_existing.parte_cliente,
      'parte_plataforma', v_existing.parte_plataforma,
      'cancelaciones_count', v_existing.cancelaciones_count,
      'requiere_revision', v_existing.requiere_revision
    );
  END IF;

  v_cancelaciones := v_cancelaciones + 1;
  v_deuda := ROUND((v_deuda + v_total)::numeric, 2);
  v_penalizacion := v_penalizacion + 0.5;
  v_compensaciones := ROUND((v_compensaciones + v_plataforma)::numeric, 2);
  v_requiere := v_cancelaciones >= 3;

  UPDATE public.profiles
  SET
    cancelaciones_proveedor_count = v_cancelaciones,
    deuda_pendiente = v_deuda,
    penalizacion_valoracion = v_penalizacion,
    compensaciones_plataforma_acumuladas = v_compensaciones,
    requiere_revision_admin = CASE
      WHEN v_requiere THEN true
      ELSE requiere_revision_admin
    END
  WHERE id = p_proveedor_id;

  BEGIN
    INSERT INTO public.proveedor_penalizaciones (
      idempotency_key,
      booking_id,
      proveedor_id,
      base_indemnizacion,
      indemnizacion_total,
      parte_cliente,
      parte_plataforma,
      cancelaciones_count,
      requiere_revision
    ) VALUES (
      p_idempotency_key,
      p_booking_id,
      p_proveedor_id,
      v_base,
      v_total,
      v_cliente,
      v_plataforma,
      v_cancelaciones,
      v_requiere
    );
  EXCEPTION
    WHEN unique_violation THEN
      -- Carrera: deshacer el UPDATE del perfil y devolver el registro ganador.
      UPDATE public.profiles
      SET
        cancelaciones_proveedor_count = GREATEST(COALESCE(cancelaciones_proveedor_count, 0) - 1, 0),
        deuda_pendiente = ROUND((COALESCE(deuda_pendiente, 0) - v_total)::numeric, 2),
        penalizacion_valoracion = GREATEST(COALESCE(penalizacion_valoracion, 0) - 0.5, 0),
        compensaciones_plataforma_acumuladas = ROUND(
          (COALESCE(compensaciones_plataforma_acumuladas, 0) - v_plataforma)::numeric,
          2
        )
      WHERE id = p_proveedor_id;

      SELECT * INTO v_existing
      FROM public.proveedor_penalizaciones
      WHERE idempotency_key = p_idempotency_key
         OR booking_id = p_booking_id;

      RETURN jsonb_build_object(
        'applied', false,
        'already_processed', true,
        'base_indemnizacion', COALESCE(v_existing.base_indemnizacion, v_base),
        'indemnizacion_total', COALESCE(v_existing.indemnizacion_total, v_total),
        'parte_cliente', COALESCE(v_existing.parte_cliente, v_cliente),
        'parte_plataforma', COALESCE(v_existing.parte_plataforma, v_plataforma),
        'cancelaciones_count', COALESCE(v_existing.cancelaciones_count, v_cancelaciones),
        'requiere_revision', COALESCE(v_existing.requiere_revision, v_requiere)
      );
  END;

  RETURN jsonb_build_object(
    'applied', true,
    'already_processed', false,
    'base_indemnizacion', v_base,
    'indemnizacion_total', v_total,
    'parte_cliente', v_cliente,
    'parte_plataforma', v_plataforma,
    'nueva_deuda', v_deuda,
    'cancelaciones_count', v_cancelaciones,
    'requiere_revision', v_requiere
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aplicar_penalizacion_cancel_proveedor(
  text, uuid, uuid, numeric, numeric, numeric, numeric
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.aplicar_penalizacion_cancel_proveedor(
  text, uuid, uuid, numeric, numeric, numeric, numeric
) TO service_role;
