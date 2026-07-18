-- Modalidad de cobro para niñera / mascotas (configuración proveedor).
-- NO confundir con services.modalidad (domicilio_cliente / domicilio_proveedor).
--
-- Estrategia retrocompatible (la más segura):
--   - columnas NULLABLE, SIN backfill.
--   - modalidad_cobro NULL = comportamiento actual por vertical en la app
--     (ninos → hora, mascotas → dia). El cálculo de reserva (paso 2) no usa
--     aún estos campos; los servicios existentes no cambian de precio.
--   - horas_por_unidad NULL = no aplica o no configurado (informativo).

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS modalidad_cobro text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS horas_por_unidad numeric;

COMMENT ON COLUMN public.services.modalidad_cobro IS
  'Unidad de cobro: hora | dia | medio_dia. NULL = legacy (ninos→hora, mascotas→dia). No aplica a alojamiento.';

COMMENT ON COLUMN public.services.horas_por_unidad IS
  'Horas que representa un día o medio día (informativo). NULL si modalidad_cobro es hora o no aplica.';

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_modalidad_cobro_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_modalidad_cobro_check
  CHECK (
    modalidad_cobro IS NULL
    OR modalidad_cobro IN ('hora', 'dia', 'medio_dia')
  );

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_horas_por_unidad_check;

ALTER TABLE public.services
  ADD CONSTRAINT services_horas_por_unidad_check
  CHECK (
    horas_por_unidad IS NULL
    OR (horas_por_unidad > 0 AND horas_por_unidad <= 24)
  );
