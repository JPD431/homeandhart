-- Envía fotos y actualizaciones del cuidado (servicios mascotas).
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS fotos_actualizaciones boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN services.fotos_actualizaciones IS
  'El cuidador envía fotos y actualizaciones periódicas a los dueños (vertical mascotas).';
