-- Precio por huésped en alojamiento (opcional; NULL = precio plano actual).
-- No modifica services.capacidad (jsonb informativo: personas/habitaciones/camas/baños).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS capacidad_maxima integer;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS huespedes_incluidos integer;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS precio_huesped_extra numeric;

COMMENT ON COLUMN public.services.capacidad_maxima IS
  'Máximo de huéspedes en una reserva (alojamiento). NULL = sin modelo por huésped.';
COMMENT ON COLUMN public.services.huespedes_incluidos IS
  'Huéspedes incluidos en el precio base por noche. NULL = modelo plano.';
COMMENT ON COLUMN public.services.precio_huesped_extra IS
  'Suplemento € por huésped adicional y por noche. NULL o 0 = sin suplemento.';
