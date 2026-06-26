-- Capacidad de alojamiento (personas, habitaciones, etc.) usada en búsqueda y ficha.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS capacidad jsonb;
