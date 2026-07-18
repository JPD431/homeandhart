-- Modalidad de cobro elegida en la reserva (niñera / mascotas).
-- NULL = reserva legacy o alojamiento (sin modalidad de cobro).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS modalidad_cobro text;

COMMENT ON COLUMN public.bookings.modalidad_cobro IS
  'Modalidad de cobro usada en esta reserva: hora | dia | medio_dia. NULL = legacy / no aplica.';

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_modalidad_cobro_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_modalidad_cobro_check
  CHECK (
    modalidad_cobro IS NULL
    OR modalidad_cobro IN ('hora', 'dia', 'medio_dia')
  );
