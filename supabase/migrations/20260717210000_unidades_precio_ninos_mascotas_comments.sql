-- Precio por unidad (niñera / mascotas): reutiliza las columnas ya existentes
-- capacidad_maxima, huespedes_incluidos, precio_huesped_extra.
-- Semántica genérica "unidades" según vertical:
--   alojamiento → huéspedes / noche
--   ninos       → niños / hora
--   mascotas    → mascotas / día
-- Sin columnas nuevas: retrocompatible al 100 % (NULL = precio plano).
-- Paso 1: solo configuración del proveedor; el cálculo de reserva no cambia aún
-- para ninos/mascotas (sigue plano). Alojamiento mantiene su Paso 2.

COMMENT ON COLUMN public.services.capacidad_maxima IS
  'Máximo de unidades en una reserva (huéspedes / niños / mascotas según vertical). NULL = sin modelo por unidad.';

COMMENT ON COLUMN public.services.huespedes_incluidos IS
  'Unidades incluidas en el precio base (huéspedes / niños / mascotas). NULL = modelo plano.';

COMMENT ON COLUMN public.services.precio_huesped_extra IS
  'Suplemento € por unidad adicional y por unidad de tiempo (noche/hora/día según vertical). NULL o 0 = sin suplemento.';
