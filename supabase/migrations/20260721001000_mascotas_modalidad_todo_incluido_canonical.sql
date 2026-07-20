-- Mascotas: unificar "en casa del proveedor" en el canónico todo_incluido.
-- domicilio_proveedor queda como alias de lectura en código (legacy); el form ya no lo ofrece.
-- Hoy: 0 filas esperadas. Preventivo por si aparecen.

-- Preview (opcional):
-- SELECT id, titulo, modalidad, revision_estado, disponible
-- FROM services
-- WHERE vertical = 'mascotas' AND modalidad = 'domicilio_proveedor';

UPDATE public.services
SET modalidad = 'todo_incluido'
WHERE vertical = 'mascotas'
  AND modalidad = 'domicilio_proveedor';
