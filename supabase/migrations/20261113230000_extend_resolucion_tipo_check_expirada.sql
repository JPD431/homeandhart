-- Extiende bookings_resolucion_tipo_check para incluir 'expirada_sin_respuesta'.
--
-- Este CHECK existía solo en la base de datos (no estaba versionado en migrations/);
-- el cron de expiración de pendientes escribe resolucion_tipo = 'expirada_sin_respuesta'
-- y fallaba al aplicar el UPDATE. El cambio ya se aplicó a mano en Supabase; esta
-- migración documenta el estado canónico del constraint.

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_resolucion_tipo_check;

ALTER TABLE bookings ADD CONSTRAINT bookings_resolucion_tipo_check
CHECK (resolucion_tipo = ANY (ARRAY[
  'reembolso_total',
  'liberado_proveedor',
  'parcial',
  'reparto',
  'expirada_sin_respuesta'
]));

COMMENT ON COLUMN bookings.resolucion_tipo IS
  'reembolso_total | liberado_proveedor | parcial | reparto | expirada_sin_respuesta';
