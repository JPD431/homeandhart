-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmacion_cliente text;
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS comentario_problema text;
-- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmado_at timestamptz;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmacion_cliente text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS comentario_problema text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmado_at timestamptz;
