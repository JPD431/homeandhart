-- RGPD: registro de consentimiento (términos + privacidad) con versión y fecha.
-- Revisar y ejecutar en Supabase antes de desplegar el flujo de registro actualizado.

-- 1) Estado actual en profiles (gate rápido)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acepto_terminos_at timestamptz,
  ADD COLUMN IF NOT EXISTS terminos_version text,
  ADD COLUMN IF NOT EXISTS acepto_privacidad_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacidad_version text;

COMMENT ON COLUMN public.profiles.acepto_terminos_at IS
  'Timestamp de la última aceptación de términos de uso';
COMMENT ON COLUMN public.profiles.terminos_version IS
  'Versión de términos aceptada (ej. 2026-07)';
COMMENT ON COLUMN public.profiles.acepto_privacidad_at IS
  'Timestamp de la última aceptación de política de privacidad';
COMMENT ON COLUMN public.profiles.privacidad_version IS
  'Versión de privacidad aceptada (ej. 2026-07)';

-- 2) Histórico de aceptaciones (reaceptaciones / auditoría de versión)
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('terminos', 'privacidad')),
  document_version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'registro'
    CHECK (source IN ('registro', 'reaceptacion', 'api')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_consents_user_id_idx
  ON public.user_consents (user_id);

CREATE INDEX IF NOT EXISTS user_consents_user_doc_idx
  ON public.user_consents (user_id, document_type, accepted_at DESC);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_consents_select_own" ON public.user_consents;
CREATE POLICY "user_consents_select_own"
  ON public.user_consents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Inserts solo vía service_role / SECURITY DEFINER (sin policy INSERT para authenticated)

GRANT SELECT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;

-- 3) Trigger de alta: lee consentimiento del metadata de signUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_acepta_terminos boolean;
  v_acepta_privacidad boolean;
  v_terminos_version text;
  v_privacidad_version text;
  v_now timestamptz := now();
BEGIN
  v_acepta_terminos := COALESCE(
    (NEW.raw_user_meta_data->>'acepto_terminos')::boolean,
    false
  );
  v_acepta_privacidad := COALESCE(
    (NEW.raw_user_meta_data->>'acepto_privacidad')::boolean,
    false
  );
  v_terminos_version := NULLIF(trim(NEW.raw_user_meta_data->>'terminos_version'), '');
  v_privacidad_version := NULLIF(trim(NEW.raw_user_meta_data->>'privacidad_version'), '');

  INSERT INTO public.profiles (
    id,
    nombre,
    apellido,
    role,
    codigo_referido,
    reservas_sin_comision,
    reservas_sin_comision_cliente,
    reservas_sin_comision_proveedor,
    acepto_terminos_at,
    terminos_version,
    acepto_privacidad_at,
    privacidad_version
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'cliente'),
    'HH-' || upper(substring(COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)) from 1 for 4)) || floor(random() * 9000 + 1000)::text,
    3,
    3,
    3,
    CASE WHEN v_acepta_terminos AND v_terminos_version IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN v_acepta_terminos AND v_terminos_version IS NOT NULL THEN v_terminos_version ELSE NULL END,
    CASE WHEN v_acepta_privacidad AND v_privacidad_version IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN v_acepta_privacidad AND v_privacidad_version IS NOT NULL THEN v_privacidad_version ELSE NULL END
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_acepta_terminos AND v_terminos_version IS NOT NULL THEN
    INSERT INTO public.user_consents (user_id, document_type, document_version, accepted_at, source)
    VALUES (NEW.id, 'terminos', v_terminos_version, v_now, 'registro');
  END IF;

  IF v_acepta_privacidad AND v_privacidad_version IS NOT NULL THEN
    INSERT INTO public.user_consents (user_id, document_type, document_version, accepted_at, source)
    VALUES (NEW.id, 'privacidad', v_privacidad_version, v_now, 'registro');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Asegurar trigger (idempotente)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Nota: si ya aplicaste delete_account_anonymize, vuelve a ejecutar
-- supabase/migrations/20260731200000_delete_account_anonymize.sql
-- (limpia también estos campos de consentimiento al borrar cuenta).
