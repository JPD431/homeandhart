-- Vista pública: solo avales completados, sin email ni token.
-- Sin security_invoker (mismo patrón que profiles_public).

CREATE OR REPLACE VIEW public.referencias_public AS
SELECT
  proveedor_id,
  nombre_referente,
  relacion,
  conoce_desde,
  recomendaria,
  comentario,
  estado
FROM public.referencias
WHERE estado = 'completada';

GRANT SELECT ON public.referencias_public TO anon, authenticated;
