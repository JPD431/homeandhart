-- Seguridad infantil PASO 2: pausar servicios ninos sin documentación aprobada.
-- Revisar PREVIEW antes de ejecutar. No toca otras verticales.

-- PREVIEW: a quién afectaría
-- SELECT s.id AS service_id, s.titulo, s.proveedor_id, p.nombre, p.apellido,
--        p.verificado, p.ninos_documentacion_aprobada, s.disponible
-- FROM services s
-- JOIN profiles p ON p.id = s.proveedor_id
-- WHERE s.vertical = 'ninos'
--   AND s.disponible = true
--   AND COALESCE(p.ninos_documentacion_aprobada, false) = false;

UPDATE public.services s
SET disponible = false
FROM public.profiles p
WHERE s.proveedor_id = p.id
  AND s.vertical = 'ninos'
  AND s.disponible = true
  AND COALESCE(p.ninos_documentacion_aprobada, false) = false;
