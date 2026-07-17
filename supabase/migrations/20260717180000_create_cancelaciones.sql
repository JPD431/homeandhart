-- Registro auditable de cancelaciones (cliente o proveedor).
-- Contador "no exentas" = COUNT(*) WHERE usuario_id = X AND exenta = false.
-- No sustituye cancelaciones_proveedor_count / deuda (flujo garantía existente).

CREATE TABLE IF NOT EXISTS public.cancelaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol_cancelador text NOT NULL CHECK (rol_cancelador IN ('cliente', 'proveedor')),
  motivo text,
  es_fuerza_mayor boolean NOT NULL DEFAULT false,
  exenta boolean NOT NULL DEFAULT false,
  exenta_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  exenta_at timestamptz,
  nota_admin text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cancelaciones_booking_id_unique UNIQUE (booking_id)
);

CREATE INDEX IF NOT EXISTS cancelaciones_usuario_exenta_idx
  ON public.cancelaciones (usuario_id, exenta);

CREATE INDEX IF NOT EXISTS cancelaciones_created_at_idx
  ON public.cancelaciones (created_at DESC);

COMMENT ON TABLE public.cancelaciones IS
  'Cancelaciones por booking. exenta=true (fuerza mayor) no cuenta para el contador admin.';

ALTER TABLE public.cancelaciones ENABLE ROW LEVEL SECURITY;

-- Solo service role / admin vía API; sin policies de lectura pública.
DROP POLICY IF EXISTS cancelaciones_admin_select ON public.cancelaciones;
-- Sin policy de SELECT para authenticated: el acceso va por service role en APIs admin.
