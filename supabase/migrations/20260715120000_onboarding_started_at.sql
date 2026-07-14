-- Marca cuándo el usuario entró en "proveedor a medias" (para recordatorios por email)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_started_at timestamptz;

-- Usuarios ya a medias: usar fecha_registro como aproximación
UPDATE profiles
SET onboarding_started_at = COALESCE(fecha_registro, now())
WHERE role = 'proveedor'
  AND onboarding_completed_at IS NULL
  AND onboarding_started_at IS NULL;
