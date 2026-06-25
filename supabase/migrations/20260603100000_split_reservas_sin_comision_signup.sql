-- Fase A (prerequisito) + Fase B/C pieza 1: columnas split + altas (trigger).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reservas_sin_comision_cliente integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reservas_sin_comision_proveedor integer NOT NULL DEFAULT 3;

UPDATE public.profiles
SET
  reservas_sin_comision_cliente = COALESCE(reservas_sin_comision, 3),
  reservas_sin_comision_proveedor = COALESCE(reservas_sin_comision, 3)
WHERE
  reservas_sin_comision_cliente IS DISTINCT FROM COALESCE(reservas_sin_comision, 3)
  OR reservas_sin_comision_proveedor IS DISTINCT FROM COALESCE(reservas_sin_comision, 3);

-- Dual-write en altas: legacy = contador cliente; proveedor en columna propia.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    nombre,
    apellido,
    role,
    codigo_referido,
    reservas_sin_comision,
    reservas_sin_comision_cliente,
    reservas_sin_comision_proveedor
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'),
    'HH-' || upper(substring(COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)) from 1 for 4)) || floor(random() * 9000 + 1000)::text,
    3,
    3,
    3
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
