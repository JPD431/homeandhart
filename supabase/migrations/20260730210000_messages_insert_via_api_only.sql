-- Integridad marketplace: INSERT de messages solo vía service role (POST /api/chat/messages).
-- Revisar ANTES de aplicar. No ejecuta el agente.
--
-- Objetivo:
--   - Quitar policies INSERT de authenticated/anon sobre public.messages
--   - Sin policy INSERT permisiva → el cliente NO puede saltarse el filtro
--   - SELECT / UPDATE de participantes se mantienen (si existen)
--   - service_role bypassa RLS (el endpoint usa SUPABASE_SERVICE_ROLE_KEY)
--
-- Comprobar en prod antes/después:
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'messages';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND cmd = 'INSERT'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.messages',
      r.policyname
    );
  END LOOP;
END $$;

-- Defensa explícita: authenticated no puede insertar por PostgREST.
DROP POLICY IF EXISTS messages_insert_deny_authenticated ON public.messages;
CREATE POLICY messages_insert_deny_authenticated
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS messages_insert_deny_anon ON public.messages;
CREATE POLICY messages_insert_deny_anon
  ON public.messages
  FOR INSERT
  TO anon
  WITH CHECK (false);

COMMENT ON POLICY messages_insert_deny_authenticated ON public.messages IS
  'Los mensajes se crean solo desde POST /api/chat/messages (service role).';
