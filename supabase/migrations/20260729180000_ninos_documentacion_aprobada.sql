-- Seguridad infantil PASO 1: flag de aprobación admin de documentación niñera.
-- Idempotente. No pausa servicios (eso es el paso del gate).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ninos_documentacion_aprobada boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ninos_documentacion_aprobada_at timestamptz NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ninos_documentacion_aprobada_por uuid NULL;

COMMENT ON COLUMN public.profiles.ninos_documentacion_aprobada IS
  'Admin aprobó los 3 docs de niñera (DNI + antecedentes penales + delitos sexuales). Independiente de profiles.verificado.';

COMMENT ON COLUMN public.profiles.ninos_documentacion_aprobada_at IS
  'Momento en que se aprobó la documentación de niñera.';

COMMENT ON COLUMN public.profiles.ninos_documentacion_aprobada_por IS
  'Admin (profiles.id / auth.users) que aprobó la documentación de niñera. NULL en backfill automático.';

-- Grandfathering D1: solo proveedores ya verificados CON los 3 documentos subidos.
-- No toca alojamiento/mascotas; no cambia disponible ni verificado.
UPDATE public.profiles
SET
  ninos_documentacion_aprobada = true,
  ninos_documentacion_aprobada_at = now(),
  ninos_documentacion_aprobada_por = NULL
WHERE verificado = true
  AND ninos_documentacion_aprobada = false
  AND doc_dni_url IS NOT NULL
  AND length(trim(doc_dni_url)) > 0
  AND doc_antecedentes_url IS NOT NULL
  AND length(trim(doc_antecedentes_url)) > 0
  AND doc_antecedentes_sexuales_url IS NOT NULL
  AND length(trim(doc_antecedentes_sexuales_url)) > 0;
