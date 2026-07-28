-- M5: exclusion constraint anti-solapamiento en disponibilidad.
-- REVISAR Y EJECUTAR MANUALMENTE en SQL Editor (no aplicar a ciegas).
--
-- Semántica de fechas en la app: día ocupado si fecha_inicio <= día <= fecha_fin
-- (intervalo cerrado). Por eso daterange(..., '[]').
--
-- ANTES de este script:
-- 1) Comprobar si el constraint ya existe (query de verificación).
-- 2) Detectar solapamientos existentes (query de solapes); resolverlos si hay filas.
-- 3) Solo entonces ejecutar CREATE EXTENSION + ADD CONSTRAINT.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.disponibilidad
  DROP CONSTRAINT IF EXISTS disponibilidad_sin_solapamiento;

ALTER TABLE public.disponibilidad
  ADD CONSTRAINT disponibilidad_sin_solapamiento
  EXCLUDE USING gist (
    service_id WITH =,
    daterange(
      fecha_inicio,
      COALESCE(fecha_fin, fecha_inicio),
      '[]'
    ) WITH &&
  );

COMMENT ON CONSTRAINT disponibilidad_sin_solapamiento ON public.disponibilidad IS
  'Impide solapes de fechas (cerrado) del mismo service_id en disponibilidad (reservas y bloqueos).';
