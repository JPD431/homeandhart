-- ============================================================
-- PASO 1 (revisar ANTES de aplicar): lugar_servicio en bookings
-- + booking_contact_cliente (dirección del cliente, RLS estricto)
--
-- Retrocompatible: columnas nullable, sin backfill obligatorio.
-- Reservas existentes → lugar_servicio NULL, sin fila de contacto.
--
-- NO confundir con:
--   services.modalidad     (domicilio_cliente / domicilio_proveedor / ambas…)
--   bookings.modalidad_cobro (hora / dia / medio_dia)
-- ============================================================

-- ------------------------------------------------------------
-- A) Campos no sensibles en bookings
-- ------------------------------------------------------------
-- lugar_servicio: dónde se presta ESTA reserva (elección efectiva).
--   'casa_proveedor' | 'casa_cliente' | NULL (legacy / alojamiento / N/A)
--
-- direccion_cliente_a_definir: solo tiene sentido si lugar_servicio = 'casa_cliente'.
--   true  → el cliente aún no indica dirección (coordinan por teléfono)
--   false → hay (o habrá) dirección en booking_contact_cliente
--   NULL → N/A (casa del proveedor, legacy, u otras verticales)
-- La dirección en sí NUNCA va en bookings → tabla protegida abajo.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS lugar_servicio text,
  ADD COLUMN IF NOT EXISTS direccion_cliente_a_definir boolean;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_lugar_servicio_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_lugar_servicio_check
  CHECK (
    lugar_servicio IS NULL
    OR lugar_servicio IN ('casa_proveedor', 'casa_cliente')
  );

COMMENT ON COLUMN public.bookings.lugar_servicio IS
  'Dónde se presta esta reserva: casa_proveedor | casa_cliente. NULL = legacy / N/A.';

COMMENT ON COLUMN public.bookings.direccion_cliente_a_definir IS
  'Si lugar_servicio = casa_cliente: true = a definir (sin dirección aún); false = dirección en booking_contact_cliente. NULL = N/A.';

-- ------------------------------------------------------------
-- B) Tabla protegida: dirección del cliente por reserva
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_contact_cliente (
  booking_id uuid PRIMARY KEY
    REFERENCES public.bookings (id) ON DELETE CASCADE,
  direccion_cliente text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.booking_contact_cliente IS
  'Dirección del cliente para la reserva (dato personal). Solo cliente dueño o proveedor con reserva confirmada/en_curso/completada.';

COMMENT ON COLUMN public.booking_contact_cliente.direccion_cliente IS
  'Dirección indicada por el cliente. NULL si aún no hay texto (p.ej. a_definir=true).';

-- updated_at
CREATE OR REPLACE FUNCTION public.set_booking_contact_cliente_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_contact_cliente_updated_at
  ON public.booking_contact_cliente;
CREATE TRIGGER trg_booking_contact_cliente_updated_at
  BEFORE UPDATE ON public.booking_contact_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.set_booking_contact_cliente_updated_at();

-- ------------------------------------------------------------
-- C) Helpers SECURITY DEFINER (evitar recursión RLS
--    bookings ↔ services, mismo patrón que auth_uid_has_booking_for_service)
-- ------------------------------------------------------------

-- ¿auth.uid() es el cliente dueño de la reserva?
CREATE OR REPLACE FUNCTION public.auth_uid_owns_booking_as_cliente(p_booking_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.id = p_booking_id
      AND b.cliente_id = auth.uid()
  );
$$;

-- ¿auth.uid() es el proveedor del servicio de esa reserva
--    Y el estado permite ver contacto (alineado a canShowProviderContact)?
CREATE OR REPLACE FUNCTION public.auth_uid_can_read_booking_contact_as_proveedor(
  p_booking_id uuid
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
      AND s.proveedor_id = auth.uid()
      AND b.estado IN ('confirmada', 'en_curso', 'completada')
  );
$$;

REVOKE ALL ON FUNCTION public.auth_uid_owns_booking_as_cliente(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auth_uid_can_read_booking_contact_as_proveedor(uuid)
  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.auth_uid_owns_booking_as_cliente(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_uid_can_read_booking_contact_as_proveedor(uuid)
  TO authenticated;

-- ------------------------------------------------------------
-- D) RLS
-- ------------------------------------------------------------

ALTER TABLE public.booking_contact_cliente ENABLE ROW LEVEL SECURITY;

-- anon: sin acceso
REVOKE ALL ON TABLE public.booking_contact_cliente FROM anon;

-- authenticated: operaciones; RLS filtra filas
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_contact_cliente
  TO authenticated;

-- service_role: bypass RLS (Supabase) — intacto

-- Cliente dueño: ver / crear / editar / borrar su fila
-- (puede escribir en pendiente; p.ej. al reservar o actualizar antes de confirmar)
DROP POLICY IF EXISTS booking_contact_cliente_owner_all
  ON public.booking_contact_cliente;
CREATE POLICY booking_contact_cliente_owner_all
  ON public.booking_contact_cliente
  FOR ALL
  TO authenticated
  USING (public.auth_uid_owns_booking_as_cliente(booking_id))
  WITH CHECK (public.auth_uid_owns_booking_as_cliente(booking_id));

-- Proveedor: SOLO LECTURA, y solo si reserva confirmada/en_curso/completada
DROP POLICY IF EXISTS booking_contact_cliente_provider_select
  ON public.booking_contact_cliente;
CREATE POLICY booking_contact_cliente_provider_select
  ON public.booking_contact_cliente
  FOR SELECT
  TO authenticated
  USING (public.auth_uid_can_read_booking_contact_as_proveedor(booking_id));
