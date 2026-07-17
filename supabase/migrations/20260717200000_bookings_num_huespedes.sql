-- Huéspedes elegidos en la reserva (alojamiento con modelo por huésped).
-- NULL = reserva sin modelo / reservas antiguas (retrocompatible).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS num_huespedes integer;

COMMENT ON COLUMN public.bookings.num_huespedes IS
  'Huéspedes elegidos al reservar (alojamiento). NULL si el servicio no usa modelo por huésped o reserva antigua.';
