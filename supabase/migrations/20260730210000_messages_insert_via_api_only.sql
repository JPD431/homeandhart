-- Integridad marketplace: partir policy ALL de messages.
-- Revisar ANTES de aplicar. No ejecuta el agente.
--
-- Situación real en BD:
--   Una sola policy: "Participantes ven sus mensajes" cmd=ALL (public).
--   Cubría SELECT+INSERT+UPDATE+DELETE. No se puede borrar sin reemplazar SELECT/UPDATE.
--
-- Este script:
--   1) Lee qual / with_check / roles de esa policy (réplica EXACTA).
--   2) La elimina.
--   3) Crea SELECT + UPDATE con la misma condición.
--   4) INSERT: solo deny para authenticated/anon (service_role bypassa RLS → endpoint OK).
--   5) DELETE: sin policy → denegado para clientes (hoy la app no borra mensajes).
--
-- Antes de aplicar, opcional:
--   SELECT policyname, roles, cmd, qual, with_check
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'messages';

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_qual text;
  v_with_check text;
  v_roles name[];
  v_roles_sql text;
  v_using text;
  v_check text;
BEGIN
  SELECT p.qual, p.with_check, p.roles
  INTO v_qual, v_with_check, v_roles
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename = 'messages'
    AND p.policyname = 'Participantes ven sus mensajes';

  IF v_qual IS NULL THEN
    RAISE EXCEPTION
      'No se encontró policy "Participantes ven sus mensajes" en public.messages. Abortando sin cambios.';
  END IF;

  -- Roles originales: {public} → TO public; si no, lista quote_ident.
  IF v_roles IS NULL
     OR cardinality(v_roles) = 0
     OR 'public' = ANY (v_roles) THEN
    v_roles_sql := 'public';
  ELSE
    SELECT string_agg(quote_ident(r), ', ' ORDER BY r)
    INTO v_roles_sql
    FROM unnest(v_roles) AS r;
  END IF;

  v_using := v_qual;
  -- En policies ALL, with_check suele ser NULL (= misma que USING) o igual a qual.
  v_check := COALESCE(NULLIF(btrim(v_with_check), ''), v_qual);

  RAISE NOTICE 'messages policy qual (USING) a replicar: %', v_using;
  RAISE NOTICE 'messages policy with_check a replicar: %', v_check;
  RAISE NOTICE 'messages policy roles: %', v_roles_sql;

  -- Quitar ALL y posibles restos de intentos previos.
  DROP POLICY IF EXISTS "Participantes ven sus mensajes" ON public.messages;
  DROP POLICY IF EXISTS "Participantes actualizan sus mensajes" ON public.messages;
  DROP POLICY IF EXISTS messages_select_participantes ON public.messages;
  DROP POLICY IF EXISTS messages_update_participantes ON public.messages;
  DROP POLICY IF EXISTS messages_insert_deny_authenticated ON public.messages;
  DROP POLICY IF EXISTS messages_insert_deny_anon ON public.messages;

  -- SELECT: misma condición → lectura del chat intacta.
  EXECUTE
    'CREATE POLICY "Participantes ven sus mensajes" ON public.messages'
    || ' FOR SELECT TO ' || v_roles_sql
    || ' USING (' || v_using || ')';

  -- UPDATE: marcar leído / rechazar oferta desde el cliente.
  EXECUTE
    'CREATE POLICY "Participantes actualizan sus mensajes" ON public.messages'
    || ' FOR UPDATE TO ' || v_roles_sql
    || ' USING (' || v_using || ')'
    || ' WITH CHECK (' || v_check || ')';

  -- INSERT: sin policy permisiva. Deny explícito (OR con denys = sigue denegado).
  CREATE POLICY messages_insert_deny_authenticated
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (false);

  CREATE POLICY messages_insert_deny_anon
    ON public.messages
    FOR INSERT
    TO anon
    WITH CHECK (false);
END $$;

COMMENT ON POLICY "Participantes ven sus mensajes" ON public.messages IS
  'SELECT: participantes (condición heredada de la antigua policy ALL).';

COMMENT ON POLICY "Participantes actualizan sus mensajes" ON public.messages IS
  'UPDATE: participantes (marcar leído / rechazar oferta).';

COMMENT ON POLICY messages_insert_deny_authenticated ON public.messages IS
  'INSERT bloqueado para authenticated; usar POST /api/chat/messages (service_role).';
