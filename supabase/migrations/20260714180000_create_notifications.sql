-- Tabla de notificaciones in-app (ejecutada manualmente en Supabase).
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensaje text,
  href text,
  entity_type text,
  entity_id uuid,
  leida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_tipo_entity_unique
  ON notifications (user_id, tipo, entity_id);

CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON notifications (user_id, leida, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Lectura / marcar leída: solo el destinatario
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY notifications_update_own ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- INSERT: solo service role (desde API server-side con SUPABASE_SERVICE_ROLE_KEY)
