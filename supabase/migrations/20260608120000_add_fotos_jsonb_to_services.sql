-- Galería multi-foto: array ordenado en jsonb; foto_url = portada (fotos[0]).
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN services.fotos IS
  'URLs públicas (bucket Media) en orden de galería; la primera es la portada (foto_url).';

-- Backfill legacy: una sola foto_url → fotos = [foto_url]
UPDATE services
SET fotos = jsonb_build_array(foto_url)
WHERE (fotos IS NULL OR fotos = '[]'::jsonb)
  AND foto_url IS NOT NULL
  AND trim(foto_url) <> '';
