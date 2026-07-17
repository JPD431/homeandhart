-- Verificación de identidad (DNI) y flag público seguro para el badge de cliente.
-- dni_estado / dni_verificado_* ya pueden existir en prod; IF NOT EXISTS es idempotente.
-- dni_verificado en profiles_public es SOLO un booleano (no expone documento ni estado interno).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dni_estado text DEFAULT 'pendiente';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dni_verificado_at timestamptz;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dni_verificado_por uuid;

COMMENT ON COLUMN public.profiles.dni_estado IS
  'Revisión admin del DNI: pendiente | verificado | rechazado. Independiente de profiles.verificado (aprobación proveedor).';

-- Recrear vista pública añadiendo dni_verificado (boolean derivado).
-- Antes de aplicar en prod, verifica la definición actual con:
--   SELECT pg_get_viewdef('public.profiles_public'::regclass, true);

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  nombre,
  apellido,
  foto_perfil,
  foto_url,
  ciudad,
  location_zone,
  descripcion,
  idiomas,
  verificado,
  badge_respuesta,
  tiempo_respuesta_horas,
  role,
  anos_experiencia,
  fecha_registro,
  documentos_completos,
  cobros_activos,
  (dni_estado = 'verificado') AS dni_verificado
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
