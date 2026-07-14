-- Permite al usuario borrar sus propias notificaciones.
DROP POLICY IF EXISTS notifications_delete_own ON notifications;
CREATE POLICY notifications_delete_own ON notifications
  FOR DELETE USING (auth.uid() = user_id);
