-- Compensación al proveedor por cancelación del cliente (distinto de pago_liberado_at / servicio completado).
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS compensacion_cancelacion numeric;
