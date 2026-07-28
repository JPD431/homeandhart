-- Claim atómico e idempotente de reservas sin comisión (M10).
-- Evita que completes/capturas concurrentes gasten el mismo cupo.

CREATE TABLE IF NOT EXISTS public.sin_comision_claims (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('cliente', 'proveedor')),
  applied boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sin_comision_claims_user_id_idx
  ON public.sin_comision_claims (user_id);

COMMENT ON TABLE public.sin_comision_claims IS
  'Ledger de claims de exención de comisión (idempotente por key).';

ALTER TABLE public.sin_comision_claims ENABLE ROW LEVEL SECURITY;

/**
 * Intenta consumir 1 reserva sin comisión de forma atómica.
 * RETURN true si decrementó (exención aplicada); false si no quedaban.
 * Misma idempotency_key → devuelve el resultado previo sin re-decrementar.
 *
 * El decremento es UPDATE condicional (contador > 0) + RETURNING;
 * la decisión de exención es el resultado de ese UPDATE, no una lectura previa.
 */
CREATE OR REPLACE FUNCTION public.claim_reserva_sin_comision(
  p_user_id uuid,
  p_role text,
  p_idempotency_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.sin_comision_claims%ROWTYPE;
  v_column text;
  v_applied boolean;
  v_new_count integer;
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL
     OR length(trim(p_idempotency_key)) = 0
     OR p_role NOT IN ('cliente', 'proveedor') THEN
    RAISE EXCEPTION 'claim_reserva_sin_comision: parámetros inválidos';
  END IF;

  SELECT * INTO v_existing
  FROM public.sin_comision_claims
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing.applied;
  END IF;

  -- Bloqueo de fila de perfil para serializar claims concurrentes del mismo user.
  PERFORM 1 FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'claim_reserva_sin_comision: perfil no encontrado';
  END IF;

  -- Re-check tras el lock (otra txn pudo insertar la misma key).
  SELECT * INTO v_existing
  FROM public.sin_comision_claims
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing.applied;
  END IF;

  v_column := CASE
    WHEN p_role = 'cliente' THEN 'reservas_sin_comision_cliente'
    ELSE 'reservas_sin_comision_proveedor'
  END;

  -- UPDATE atómico condicional: solo decrementa si quedan cupos.
  EXECUTE format(
    'UPDATE public.profiles
     SET %I = %I - 1
     WHERE id = $1 AND COALESCE(%I, 0) > 0
     RETURNING %I',
    v_column, v_column, v_column, v_column
  )
  INTO v_new_count
  USING p_user_id;

  v_applied := FOUND;

  BEGIN
    INSERT INTO public.sin_comision_claims (idempotency_key, user_id, role, applied)
    VALUES (p_idempotency_key, p_user_id, p_role, v_applied);
  EXCEPTION
    WHEN unique_violation THEN
      -- Carrera en insert: deshacer nuestro decremento si lo hicimos.
      IF v_applied THEN
        EXECUTE format(
          'UPDATE public.profiles SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
          v_column,
          v_column
        )
        USING p_user_id;
      END IF;
      SELECT * INTO v_existing
      FROM public.sin_comision_claims
      WHERE idempotency_key = p_idempotency_key;
      RETURN COALESCE(v_existing.applied, false);
  END;

  RETURN v_applied;
END;
$$;

/**
 * Revierte un claim (si applied=true restaura el contador).
 * Idempotente: si no hay fila, no-op.
 */
CREATE OR REPLACE FUNCTION public.release_reserva_sin_comision(
  p_idempotency_key text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.sin_comision_claims%ROWTYPE;
  v_column text;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN false;
  END IF;

  DELETE FROM public.sin_comision_claims
  WHERE idempotency_key = p_idempotency_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_row.applied THEN
    v_column := CASE
      WHEN v_row.role = 'cliente' THEN 'reservas_sin_comision_cliente'
      ELSE 'reservas_sin_comision_proveedor'
    END;

    EXECUTE format(
      'UPDATE public.profiles SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
      v_column,
      v_column
    )
    USING v_row.user_id;
  END IF;

  RETURN v_row.applied;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_reserva_sin_comision(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_reserva_sin_comision(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_reserva_sin_comision(uuid, text, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_reserva_sin_comision(text)
  TO service_role;
