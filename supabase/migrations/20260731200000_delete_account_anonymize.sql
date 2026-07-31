-- RGPD: anonimización transaccional de cuenta (derecho al olvido).
-- NO borra auth.users (profiles_id_fkey es ON DELETE CASCADE; borrar auth
-- destruiría el perfil/historial). El endpoint JS BANEA + scrub del email.
-- NO borra Storage (eso lo hace el endpoint JS ANTES de llamar a esta función).
-- Ejecutar en Supabase SQL editor / migraciones antes de usar el endpoint nuevo.

CREATE OR REPLACE FUNCTION public.delete_account_anonymize(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active int;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_account_anonymize: p_user_id requerido';
  END IF;

  -- Doble chequeo de bloqueo (misma lógica que el endpoint)
  SELECT count(*)::int INTO v_active
  FROM public.bookings b
  LEFT JOIN public.services s ON s.id = b.service_id
  WHERE (b.cliente_id = p_user_id OR s.proveedor_id = p_user_id)
    AND (
      b.estado IN ('pendiente', 'confirmada', 'en_curso')
      OR (
        b.pago_liberado_at IS NULL
        AND b.estado NOT IN (
          'cancelada',
          'cancelada_proveedor',
          'cancelada_garantia',
          'rechazada'
        )
      )
    );

  IF v_active > 0 THEN
    RAISE EXCEPTION 'active_bookings:%', v_active
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  -- Bookings: quitar PII embebida; conservar importes/fechas/estado/ids
  UPDATE public.bookings
  SET
    mensaje = NULL,
    comentario_problema = NULL,
    direccion_cliente_a_definir = NULL
  WHERE cliente_id = p_user_id;

  -- Direcciones personales del cliente en reservas
  DELETE FROM public.booking_contact_cliente bcc
  USING public.bookings b
  WHERE bcc.booking_id = b.id
    AND b.cliente_id = p_user_id;

  -- Mensajes: vaciar contenido
  UPDATE public.messages
  SET content = '[mensaje eliminado]'
  WHERE sender_id = p_user_id;

  -- Reseñas: quitar texto; conservar valoración (el autor se ve vía profiles.nombre)
  UPDATE public.reviews
  SET comentario = NULL
  WHERE cliente_id = p_user_id;

  -- Perfil fantasma (NO borrar la fila: FKs de bookings/reviews/etc.)
  -- Nota: el email de login vive en auth.users (ban + scrub en el endpoint).
  -- No hay columna profiles.email ni profiles.direccion en el esquema actual.
  UPDATE public.profiles
  SET
    nombre = 'Usuario eliminado',
    apellido = NULL,
    telefono = NULL,
    email_contacto = NULL,
    ciudad = NULL,
    location_zone = NULL,
    descripcion = NULL,
    idiomas = NULL,
    foto_perfil = NULL,
    necesidades = NULL,
    doc_dni_url = NULL,
    doc_antecedentes_url = NULL,
    doc_antecedentes_sexuales_url = NULL,
    codigo_referido = NULL,
    stripe_customer_id = NULL,
    stripe_account_id = NULL,
    credito_disponible = 0,
    verificado = false,
    documentos_completos = false,
    cobros_activos = false,
    ninos_documentacion_aprobada = false,
    mascotas_documentacion_aprobada = false,
    dni_estado = 'pendiente',
    dni_verificado_at = NULL,
    dni_verificado_por = NULL,
    mayor_de_edad_confirmada = false,
    acepto_terminos_at = NULL,
    terminos_version = NULL,
    acepto_privacidad_at = NULL,
    privacidad_version = NULL
  WHERE id = p_user_id;

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id);
END;
$$;

COMMENT ON FUNCTION public.delete_account_anonymize(uuid) IS
  'RGPD: anonimiza perfil/mensajes/reseñas/reservas del usuario en una TX. Solo service_role.';

REVOKE ALL ON FUNCTION public.delete_account_anonymize(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_account_anonymize(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_account_anonymize(uuid) TO service_role;
