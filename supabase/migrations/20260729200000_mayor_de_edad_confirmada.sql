-- Seguridad infantil hueco 4 PASO 1: confirmación admin de mayoría de edad (18+).
-- Idempotente. SIN fecha de nacimiento en BD. SIN backfill (nadie ha confirmado edad aún).
-- No pausa servicios aquí (el gate en código bloquea activaciones nuevas).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mayor_de_edad_confirmada boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mayor_de_edad_confirmada_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mayor_de_edad_confirmada_por uuid NULL;

COMMENT ON COLUMN public.profiles.mayor_de_edad_confirmada IS
  'Admin confirmó mayoría de edad (18+) al revisar el DNI. Sin almacenar fecha de nacimiento.';

COMMENT ON COLUMN public.profiles.mayor_de_edad_confirmada_at IS
  'Momento en que se confirmó la mayoría de edad del proveedor.';

COMMENT ON COLUMN public.profiles.mayor_de_edad_confirmada_por IS
  'Admin (auth.users / profiles.id) que confirmó la mayoría de edad.';

-- Preview (ejecutar a mano en SQL Editor; no forma parte del apply):
-- SELECT p.id, p.nombre, p.apellido, p.verificado, p.dni_estado,
--        COUNT(s.id) FILTER (WHERE s.disponible = true) AS servicios_activos
-- FROM profiles p
-- JOIN services s ON s.proveedor_id = p.id
-- WHERE p.role = 'proveedor'
--   AND s.disponible = true
--   AND COALESCE(p.mayor_de_edad_confirmada, false) = false
-- GROUP BY p.id, p.nombre, p.apellido, p.verificado, p.dni_estado
-- ORDER BY servicios_activos DESC;
