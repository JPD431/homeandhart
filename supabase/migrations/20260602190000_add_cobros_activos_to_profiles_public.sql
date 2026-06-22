-- Expone cobros_activos en la vista pública (dato no sensible para clientes).
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
  cobros_activos
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
