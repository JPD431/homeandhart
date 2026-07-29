-- Seguridad infantil hueco 3 PASO 1: suspensión cautelar por reporte grave.
-- Idempotente. SIN backfill (solo reportes futuros).
--
-- suspendido_cautelar_por es text (no uuid) para permitir:
--   - 'sistema' cuando lo dispara un reporte automático
--   - uuid del admin (como texto) cuando un humano suspende/levanta contexto

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspendido_cautelar boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspendido_cautelar_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspendido_cautelar_por text NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspendido_cautelar_motivo text NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspendido_cautelar_report_id uuid NULL;

COMMENT ON COLUMN public.profiles.suspendido_cautelar IS
  'Proveedor en suspensión cautelar (servicios pausados; no puede reactivar hasta revisión admin).';

COMMENT ON COLUMN public.profiles.suspendido_cautelar_at IS
  'Momento en que se activó la suspensión cautelar.';

COMMENT ON COLUMN public.profiles.suspendido_cautelar_por IS
  'Quién activó la suspensión: ''sistema'' (reporte grave automático) o uuid del admin como texto.';

COMMENT ON COLUMN public.profiles.suspendido_cautelar_motivo IS
  'Motivo/categoría del reporte grave que originó la suspensión.';

COMMENT ON COLUMN public.profiles.suspendido_cautelar_report_id IS
  'reports.id que originó la suspensión cautelar (si aplica).';

-- Reservas a revisar cuando se suspende un proveedor (confirmadas/en curso no se cancelan).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS revision_seguridad_pendiente boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bookings.revision_seguridad_pendiente IS
  'Reserva marcada para revisión admin tras suspensión cautelar del proveedor (no implica cancelación automática).';
