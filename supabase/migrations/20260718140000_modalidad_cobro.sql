-- Modalidades de cobro MÚLTIPLES (niñera / mascotas).
-- Reemplaza el enfoque de una sola modalidad (services.modalidad_cobro).
--
-- NO confundir con services.modalidad (domicilio_cliente / domicilio_proveedor).
--
-- Retrocompatibilidad (la más segura):
--   - Sin filas en service_modalidades = comportamiento actual:
--       ninos → cobro por hora con services.precio
--       mascotas → cobro por día con services.precio
--   - El cálculo de reserva (paso 2) aún NO lee esta tabla.
--   - services.precio sigue siendo el precio usado en reserva hoy.

-- Si se llegó a aplicar la migración de modalidad única, limpiar columnas.
ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_modalidad_cobro_check;

ALTER TABLE public.services
  DROP CONSTRAINT IF EXISTS services_horas_por_unidad_check;

ALTER TABLE public.services
  DROP COLUMN IF EXISTS modalidad_cobro;

ALTER TABLE public.services
  DROP COLUMN IF EXISTS horas_por_unidad;

CREATE TABLE IF NOT EXISTS public.service_modalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  modalidad text NOT NULL,
  precio numeric NOT NULL,
  horas_unidad numeric,
  suplemento_extra numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_modalidades_modalidad_check
    CHECK (modalidad IN ('hora', 'dia', 'medio_dia')),
  CONSTRAINT service_modalidades_precio_check
    CHECK (precio > 0),
  CONSTRAINT service_modalidades_horas_check
    CHECK (
      horas_unidad IS NULL
      OR (horas_unidad > 0 AND horas_unidad <= 24)
    ),
  CONSTRAINT service_modalidades_suplemento_check
    CHECK (suplemento_extra IS NULL OR suplemento_extra >= 0),
  CONSTRAINT service_modalidades_horas_required_check
    CHECK (
      (modalidad = 'hora' AND horas_unidad IS NULL)
      OR (
        modalidad IN ('dia', 'medio_dia')
        AND horas_unidad IS NOT NULL
        AND horas_unidad > 0
        AND horas_unidad <= 24
      )
    ),
  CONSTRAINT service_modalidades_service_modalidad_unique
    UNIQUE (service_id, modalidad)
);

CREATE INDEX IF NOT EXISTS service_modalidades_service_id_idx
  ON public.service_modalidades (service_id);

COMMENT ON TABLE public.service_modalidades IS
  'Modalidades de cobro activas por servicio (niñera/mascotas). Sin filas = legacy por vertical.';

COMMENT ON COLUMN public.service_modalidades.modalidad IS
  'hora | dia | medio_dia';

COMMENT ON COLUMN public.service_modalidades.precio IS
  'Precio de la unidad: €/hora, €/día o €/medio día según modalidad.';

COMMENT ON COLUMN public.service_modalidades.horas_unidad IS
  'Horas informativas que representa un día o medio día. NULL en modalidad hora.';

COMMENT ON COLUMN public.service_modalidades.suplemento_extra IS
  'Suplemento opcional por niño/mascota extra en esta modalidad (€ por unidad). NULL = sin suplemento.';

ALTER TABLE public.service_modalidades ENABLE ROW LEVEL SECURITY;

-- Lectura pública de precios (anuncio / búsqueda). Los precios no son secretos.
DROP POLICY IF EXISTS service_modalidades_select_public ON public.service_modalidades;
CREATE POLICY service_modalidades_select_public
  ON public.service_modalidades
  FOR SELECT
  USING (true);

-- El dueño del servicio gestiona sus filas (el API también usa service role).
DROP POLICY IF EXISTS service_modalidades_owner_all ON public.service_modalidades;
CREATE POLICY service_modalidades_owner_all
  ON public.service_modalidades
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_id AND s.proveedor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = service_id AND s.proveedor_id = auth.uid()
    )
  );
