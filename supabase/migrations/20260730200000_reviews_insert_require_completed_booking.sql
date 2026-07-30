-- R1 integridad marketplace: INSERT de reviews solo con reserva completada propia.
-- Revisar ANTES de aplicar. No ejecuta el agente.
--
-- Objetivo:
--   - Función SECURITY DEFINER auth_uid_can_review_booking(...)
--   - Policy INSERT reforzada (además de cliente_id = auth.uid())
--   - SELECT público se mantiene
--   - Anti auto-reseña: cliente_id ≠ proveedor del servicio
--
-- Nota: la ventana de 14 días se valida en POST /api/reviews (capa app).
-- El unique index reviews_booking_id_unique ya evita 2 reseñas por booking.

-- ------------------------------------------------------------
-- 1) Función: ¿auth.uid() puede reseñar este booking con estos IDs?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auth_uid_can_review_booking(
  p_booking_id uuid,
  p_proveedor_id uuid,
  p_service_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.services s ON s.id = b.service_id
    WHERE b.id = p_booking_id
      AND b.cliente_id = auth.uid()
      AND b.estado = 'completada'
      AND b.service_id = p_service_id
      AND s.id = p_service_id
      AND s.proveedor_id = p_proveedor_id
      AND b.cliente_id IS DISTINCT FROM s.proveedor_id
  );
$$;

REVOKE ALL ON FUNCTION public.auth_uid_can_review_booking(uuid, uuid, uuid)
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_review_booking(uuid, uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.auth_uid_can_review_booking(uuid, uuid, uuid) IS
  'True si auth.uid() es cliente de una reserva completada de ese service/proveedor y no es auto-reseña.';

-- ------------------------------------------------------------
-- 2) Policy INSERT reforzada
--    Nombres legacy posibles (DROP IF EXISTS). Ajustar si el nombre en prod difiere:
--    SELECT policyname FROM pg_policies WHERE tablename = 'reviews' AND cmd = 'INSERT';
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Cliente crea su review" ON public.reviews;
DROP POLICY IF EXISTS "cliente_crea_su_review" ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_own ON public.reviews;
DROP POLICY IF EXISTS reviews_insert_cliente ON public.reviews;

CREATE POLICY reviews_insert_completed_own
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    cliente_id = auth.uid()
    AND public.auth_uid_can_review_booking(
      booking_id,
      proveedor_id,
      service_id
    )
  );

-- SELECT público: no tocar (las reseñas se muestran en perfiles/listados).
-- Si en prod no existiera, descomentar:
-- DROP POLICY IF EXISTS reviews_select_public ON public.reviews;
-- CREATE POLICY reviews_select_public
--   ON public.reviews
--   FOR SELECT
--   TO anon, authenticated
--   USING (true);
