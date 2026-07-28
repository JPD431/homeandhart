-- Débito atómico e idempotente de credito_disponible (F3).
-- Evita overspend por completes concurrentes y doble débito en reintentos.

CREATE TABLE IF NOT EXISTS public.credito_debitos (
  idempotency_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credito_debitos_user_id_idx
  ON public.credito_debitos (user_id);

COMMENT ON TABLE public.credito_debitos IS
  'Ledger de débitos de crédito con clave de idempotencia (complete/pago).';

ALTER TABLE public.credito_debitos ENABLE ROW LEVEL SECURITY;
-- Sin policies para anon/authenticated: solo service_role / SECURITY DEFINER.

/**
 * Debita hasta p_max_amount del crédito del usuario de forma atómica.
 * Si la misma idempotency_key ya existe, devuelve el amount previo (sin volver a debitar).
 * Nunca deja credito_disponible negativo.
 */
CREATE OR REPLACE FUNCTION public.debit_credito_disponible(
  p_user_id uuid,
  p_max_amount numeric,
  p_idempotency_key text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing numeric(12, 2);
  v_available numeric(12, 2);
  v_debited numeric(12, 2);
  v_max numeric(12, 2);
BEGIN
  IF p_user_id IS NULL OR p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'debit_credito_disponible: parámetros inválidos';
  END IF;

  v_max := ROUND(COALESCE(p_max_amount, 0)::numeric, 2);
  IF v_max <= 0 THEN
    RETURN 0;
  END IF;

  SELECT amount INTO v_existing
  FROM public.credito_debitos
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT ROUND(COALESCE(credito_disponible, 0)::numeric, 2)
  INTO v_available
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'debit_credito_disponible: perfil no encontrado';
  END IF;

  -- Tras el lock: otro proceso pudo haber insertado la misma key.
  SELECT amount INTO v_existing
  FROM public.credito_debitos
  WHERE idempotency_key = p_idempotency_key;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  v_debited := LEAST(v_available, v_max);
  v_debited := ROUND(v_debited::numeric, 2);

  IF v_debited > 0 THEN
    UPDATE public.profiles
    SET credito_disponible = ROUND((credito_disponible - v_debited)::numeric, 2)
    WHERE id = p_user_id;
  END IF;

  BEGIN
    INSERT INTO public.credito_debitos (idempotency_key, user_id, amount)
    VALUES (p_idempotency_key, p_user_id, v_debited);
  EXCEPTION
    WHEN unique_violation THEN
      -- Carrera residual: deshacer nuestro UPDATE y devolver el amount del ganador.
      IF v_debited > 0 THEN
        UPDATE public.profiles
        SET credito_disponible = ROUND(
          (COALESCE(credito_disponible, 0) + v_debited)::numeric,
          2
        )
        WHERE id = p_user_id;
      END IF;
      SELECT amount INTO v_existing
      FROM public.credito_debitos
      WHERE idempotency_key = p_idempotency_key;
      RETURN COALESCE(v_existing, 0);
  END;

  RETURN v_debited;
END;
$$;

/**
 * Revierte un débito previo (mismo idempotency_key) y borra el ledger row.
 * Idempotente: si no hay fila, no-op (devuelve 0).
 * No libera si ya hay bookings ligados al grupo/PI de la key (evita carrera
 * con un complete concurrente que ya insertó reservas).
 */
CREATE OR REPLACE FUNCTION public.release_credito_debito(
  p_idempotency_key text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.credito_debitos%ROWTYPE;
  v_grupo text;
  v_pi text;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RETURN 0;
  END IF;

  IF p_idempotency_key LIKE 'complete:grupo:%' THEN
    v_grupo := substr(p_idempotency_key, length('complete:grupo:') + 1);
    IF v_grupo IS NOT NULL AND length(v_grupo) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.grupo_reserva = v_grupo LIMIT 1
      ) THEN
        RETURN 0;
      END IF;
    END IF;
  ELSIF p_idempotency_key LIKE 'complete:pi:%' THEN
    v_pi := substr(p_idempotency_key, length('complete:pi:') + 1);
    IF v_pi IS NOT NULL AND length(v_pi) > 0 THEN
      IF EXISTS (
        SELECT 1 FROM public.bookings b WHERE b.payment_intent_id = v_pi LIMIT 1
      ) THEN
        RETURN 0;
      END IF;
    END IF;
  END IF;

  DELETE FROM public.credito_debitos
  WHERE idempotency_key = p_idempotency_key
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_row.amount > 0 THEN
    UPDATE public.profiles
    SET credito_disponible = ROUND(
      (COALESCE(credito_disponible, 0) + v_row.amount)::numeric,
      2
    )
    WHERE id = v_row.user_id;
  END IF;

  RETURN v_row.amount;
END;
$$;

REVOKE ALL ON FUNCTION public.debit_credito_disponible(uuid, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_credito_debito(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.debit_credito_disponible(uuid, numeric, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_credito_debito(text)
  TO service_role;
