-- Bloqueo manual de fechas en disponibilidad (retrocompatible).
-- Revisar antes de ejecutar en producción.

-- 1) Permitir filas sin reserva (bloqueo del proveedor).
--    Si booking_id ya es nullable, este ALTER es no-op seguro.
ALTER TABLE public.disponibilidad
  ALTER COLUMN booking_id DROP NOT NULL;

-- 2) Distinguir reserva vs bloqueo manual.
--    Filas existentes reciben default 'reserva'.
ALTER TABLE public.disponibilidad
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'reserva';

UPDATE public.disponibilidad
SET tipo = 'reserva'
WHERE tipo IS NULL OR btrim(tipo) = '';

ALTER TABLE public.disponibilidad
  DROP CONSTRAINT IF EXISTS disponibilidad_tipo_check;

ALTER TABLE public.disponibilidad
  ADD CONSTRAINT disponibilidad_tipo_check
  CHECK (tipo IN ('reserva', 'bloqueo_manual'));

-- 3) Consistencia: reserva ⇒ booking_id; bloqueo manual ⇒ sin booking.
ALTER TABLE public.disponibilidad
  DROP CONSTRAINT IF EXISTS disponibilidad_tipo_booking_consistency;

ALTER TABLE public.disponibilidad
  ADD CONSTRAINT disponibilidad_tipo_booking_consistency
  CHECK (
    (tipo = 'reserva' AND booking_id IS NOT NULL)
    OR (tipo = 'bloqueo_manual' AND booking_id IS NULL)
  );

-- Notas:
-- - No modifica filas de reservas existentes (solo fija tipo='reserva').
-- - El exclusion constraint anti-solape (disponibilidad_sin_solapamiento) se mantiene:
--   un bloqueo manual no puede solapar una reserva, y viceversa.
-- - service_tarifas no se toca.
