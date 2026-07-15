-- Distingue emails de secuencia por reserva (p. ej. recordatorio de reseña).
ALTER TABLE email_logs
  ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS email_logs_booking_id_idx
  ON email_logs (booking_id)
  WHERE booking_id IS NOT NULL;

-- Un solo email del mismo tipo por usuario + reserva.
CREATE UNIQUE INDEX IF NOT EXISTS email_logs_user_tipo_booking_unique
  ON email_logs (user_id, tipo, booking_id)
  WHERE booking_id IS NOT NULL;
