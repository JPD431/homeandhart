-- Abono atómico e idempotente de credito_disponible (F4 / cancelaciones).
-- Evita doble crédito en cancelaciones concurrentes o reintentos.

CREATE TABLE IF NOT EXISTS public.credito_abonos (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credito_abonos_user_id_idx
  ON public.credito_abonos (user_id);

COMMENT ON TABLE public.credito_abonos IS
  'Ledger de abonos de crédito con clave de idempotencia (cancelación/reembolso).';

ALTER TABLE public.credito_abonos ENABLE ROW LEVEL SECURITY;
-- Sin policies para anon/authenticated: solo service_role / SECURITY DEFINER.

/**
 * Suma p_amount al crédito del usuario de forma atómica.
 * Si la misma idempotency_key ya existe, devuelve el amount previo (sin volver a abonar).
 */
CREATE OR REPLACE FUNCTION public.credit_credito_disponible(
  p_user_id uuid,
  p_amount numeric,
  p_idempotency_key text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing numeric(12, 2);
  v_amount numeric(12, 2);
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'credit_credito_disponible: parámetros inválidos';
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0)::numeric, 2);
  IF v_amount <= 0 THEN
    RETURN 0;
  END IF;

  SELECT amount INTO v_existing
  FROM public.credito_abonos
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  PERFORM 1
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'credit_credito_disponible: perfil no encontrado';
  END IF;

  -- Tras el lock: otro proceso pudo haber insertado la misma key.
  SELECT amount INTO v_existing
  FROM public.credito_abonos
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  UPDATE public.profiles
  SET credito_disponible = ROUND(
    (COALESCE(credito_disponible, 0) + v_amount)::numeric,
    2
  )
  WHERE id = p_user_id;

  BEGIN
    INSERT INTO public.credito_abonos (idempotency_key, user_id, amount)
    VALUES (p_idempotency_key, p_user_id, v_amount);
  EXCEPTION
    WHEN unique_violation THEN
      -- Carrera residual: deshacer nuestro UPDATE y devolver el amount del ganador.
      UPDATE public.profiles
      SET credito_disponible = ROUND(
        (COALESCE(credito_disponible, 0) - v_amount)::numeric,
        2
      )
      WHERE id = p_user_id;

      SELECT amount INTO v_existing
      FROM public.credito_abonos
      WHERE idempotency_key = p_idempotency_key;
      RETURN COALESCE(v_existing, 0);
  END;

  RETURN v_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_credito_disponible(uuid, numeric, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.credit_credito_disponible(uuid, numeric, text)
  TO service_role;
