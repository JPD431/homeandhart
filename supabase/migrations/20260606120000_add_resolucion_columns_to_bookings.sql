-- Trazabilidad de resolución de incidencias (admin).
-- Ejecutar en Supabase; no destructivo.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_tipo text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_admin_id uuid;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_nota text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_importe_cliente numeric;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS resolucion_importe_proveedor numeric;

COMMENT ON COLUMN bookings.resolucion_tipo IS 'reembolso_total | liberado_proveedor | parcial | reparto';
