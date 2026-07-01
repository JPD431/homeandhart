-- Documentos opcionales y específicos por vertical (PDFs).
-- Comunes (DNI, antecedentes) siguen en profiles.doc_*_url.

CREATE TABLE IF NOT EXISTS public.provider_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proveedor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  vertical text NULL CHECK (vertical IN ('alojamiento', 'ninos', 'mascotas')),
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_documents_proveedor_tipo_unique UNIQUE (proveedor_id, tipo),
  CONSTRAINT provider_documents_tipo_check CHECK (
    tipo IN (
      'nru_comprobante',
      'seguro_hogar',
      'primeros_auxilios',
      'titulaciones',
      'certificaciones'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_provider_documents_proveedor_id
  ON public.provider_documents (proveedor_id);

COMMENT ON TABLE public.provider_documents IS
  'PDFs opcionales o de publicación (NRU). Comunes en profiles.doc_*_url.';

-- Actualizar updated_at en cada cambio
CREATE OR REPLACE FUNCTION public.set_provider_documents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provider_documents_updated_at ON public.provider_documents;
CREATE TRIGGER provider_documents_updated_at
  BEFORE UPDATE ON public.provider_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_provider_documents_updated_at();

-- RLS: el proveedor gestiona solo sus filas.
-- El panel admin usa SUPABASE_SERVICE_ROLE_KEY (bypass RLS), mismo patrón que profiles.
ALTER TABLE public.provider_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_documents_select_own ON public.provider_documents;
CREATE POLICY provider_documents_select_own ON public.provider_documents
  FOR SELECT TO authenticated
  USING (proveedor_id = auth.uid());

DROP POLICY IF EXISTS provider_documents_insert_own ON public.provider_documents;
CREATE POLICY provider_documents_insert_own ON public.provider_documents
  FOR INSERT TO authenticated
  WITH CHECK (proveedor_id = auth.uid());

DROP POLICY IF EXISTS provider_documents_update_own ON public.provider_documents;
CREATE POLICY provider_documents_update_own ON public.provider_documents
  FOR UPDATE TO authenticated
  USING (proveedor_id = auth.uid())
  WITH CHECK (proveedor_id = auth.uid());

DROP POLICY IF EXISTS provider_documents_delete_own ON public.provider_documents;
CREATE POLICY provider_documents_delete_own ON public.provider_documents
  FOR DELETE TO authenticated
  USING (proveedor_id = auth.uid());
