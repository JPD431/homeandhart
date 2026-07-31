-- Log opcional de ejecuciones del cron de retención RGPD.
-- El cron funciona aunque esta tabla no exista (solo console).

CREATE TABLE IF NOT EXISTS public.retention_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  dry_run boolean NOT NULL DEFAULT true,
  job text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  affected integer NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text
);

CREATE INDEX IF NOT EXISTS retention_runs_started_at_idx
  ON public.retention_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS retention_runs_job_idx
  ON public.retention_runs (job, started_at DESC);

COMMENT ON TABLE public.retention_runs IS
  'Auditoría de jobs de retención RGPD (cron /api/cron/retention).';

ALTER TABLE public.retention_runs ENABLE ROW LEVEL SECURITY;

-- Sin policies para authenticated/anon: solo service_role (bypass RLS).
