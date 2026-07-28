-- Alertas de descuadre Stripe (M4): rastro + dedupe de emails al admin.

CREATE TABLE IF NOT EXISTS public.stripe_descuadre_alerts (
  dedupe_key text PRIMARY KEY,
  event_id text NOT NULL,
  event_type text NOT NULL,
  kind text NOT NULL,
  payment_intent_id text,
  charge_id text,
  booking_ids uuid[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_sent boolean NOT NULL DEFAULT false,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_descuadre_alerts_event_id_idx
  ON public.stripe_descuadre_alerts (event_id);

CREATE INDEX IF NOT EXISTS stripe_descuadre_alerts_created_at_idx
  ON public.stripe_descuadre_alerts (created_at DESC);

COMMENT ON TABLE public.stripe_descuadre_alerts IS
  'Descuadres/anomalías detectadas en webhook Stripe; dedupe_key evita emails repetidos.';

ALTER TABLE public.stripe_descuadre_alerts ENABLE ROW LEVEL SECURITY;
