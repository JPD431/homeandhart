-- Gate mascotas PASO 3: pausar servicios mascotas sin documentación aprobada.
-- Revisar PREVIEW antes de ejecutar. No toca otras verticales.

-- PREVIEW: a quién afectaría
-- SELECT s.id AS service_id, s.titulo, s.proveedor_id, p.nombre, p.apellido,
--        p.verificado, p.mascotas_documentacion_aprobada, s.disponible
-- FROM services s
-- JOIN profiles p ON p.id = s.proveedor_id
-- WHERE s.vertical = 'mascotas'
--   AND s.disponible = true
--   AND COALESCE(p.mascotas_documentacion_aprobada, false) = false;

UPDATE public.services s
SET disponible = false
FROM public.profiles p
WHERE s.proveedor_id = p.id
  AND s.vertical = 'mascotas'
  AND s.disponible = true
  AND COALESCE(p.mascotas_documentacion_aprobada, false) = false;
