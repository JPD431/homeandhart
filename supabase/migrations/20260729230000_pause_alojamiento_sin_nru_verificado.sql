-- Gate alojamiento PASO 3: pausar servicios de alojamiento sin NRU verificado.
-- Revisar PREVIEW antes de ejecutar. No toca otras verticales.
-- Criterio: vertical='alojamiento' AND disponible=true AND (nru vacío OR nru_estado != 'verificado').

-- PREVIEW: a quién afectaría
-- SELECT s.id AS service_id, s.titulo, s.proveedor_id, s.nru, s.nru_estado, s.disponible,
--        p.nombre, p.apellido
-- FROM public.services s
-- JOIN public.profiles p ON p.id = s.proveedor_id
-- WHERE s.vertical = 'alojamiento'
--   AND s.disponible = true
--   AND (
--     TRIM(COALESCE(s.nru, '')) = ''
--     OR COALESCE(s.nru_estado, 'pendiente') <> 'verificado'
--   );

UPDATE public.services
SET disponible = false
WHERE vertical = 'alojamiento'
  AND disponible = true
  AND (
    TRIM(COALESCE(nru, '')) = ''
    OR COALESCE(nru_estado, 'pendiente') <> 'verificado'
  );
