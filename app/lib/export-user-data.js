import "server-only";

/**
 * Export RGPD: reúne datos del interesado y reduce PII de terceros.
 */

const LIMITS = {
  bookings: 2000,
  messages: 5000,
  reviews: 1000,
  services: 500,
  notifications: 500,
  favoritos: 500,
  referencias: 500,
  reports: 500,
  credito: 2000,
  conversations: 500,
  viajes: 200,
};

function publicPerson(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    nombre: row.nombre ?? null,
    apellido: row.apellido ?? null,
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {{ id: string, email?: string, created_at?: string, user_metadata?: object }} user
 */
export async function buildUserDataExport(admin, user) {
  const userId = user.id;
  const exportedAt = new Date().toISOString();

  const [
    profileRes,
    consentsRes,
    servicesRes,
    bookingsClienteRes,
    favoritosRes,
    reviewsWrittenRes,
    reviewsReceivedRes,
    referenciasRes,
    notificationsRes,
    reportsRes,
    debitoRes,
    abonoRes,
    claimsRes,
    convARes,
    convBRes,
    viajesRes,
    familiaMiembroRes,
    providerDocsRes,
  ] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).maybeSingle(),
    admin
      .from("user_consents")
      .select(
        "id, document_type, document_version, accepted_at, source, created_at",
      )
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false })
      .limit(200),
    admin
      .from("services")
      .select(
        "id, titulo, vertical, ciudad, location_zone, descripcion, descripcion_anuncio, precio, disponible, revision_estado, foto_url, fotos, nru, nru_estado, created_at, updated_at, modalidad, capacidad, amenities, oferta_titulo, oferta_precio, oferta_activa",
      )
      .eq("proveedor_id", userId)
      .limit(LIMITS.services),
    admin
      .from("bookings")
      .select(
        "id, service_id, estado, fecha_inicio, fecha_fin, hora, duracion_horas, precio_total, precio_base, credito_aplicado, mensaje, lugar_servicio, direccion_cliente_a_definir, num_huespedes, modalidad_cobro, grupo_reserva, payment_intent_id, pago_liberado_at, importe_transferido, confirmacion_cliente, comentario_problema, created_at, completada_at, familia_id, cliente_sin_comision, proveedor_sin_comision, services:service_id(id, titulo, vertical, proveedor_id)",
      )
      .eq("cliente_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.bookings),
    admin
      .from("favoritos")
      .select("id, proveedor_id, created_at")
      .eq("cliente_id", userId)
      .limit(LIMITS.favoritos),
    admin
      .from("reviews")
      .select(
        "id, booking_id, service_id, proveedor_id, valoracion, comentario, created_at",
      )
      .eq("cliente_id", userId)
      .limit(LIMITS.reviews),
    admin
      .from("reviews")
      .select(
        "id, booking_id, service_id, cliente_id, valoracion, comentario, created_at",
      )
      .eq("proveedor_id", userId)
      .limit(LIMITS.reviews),
    admin
      .from("referencias")
      .select(
        "id, nombre_referente, email_referente, relacion, conoce_desde, recomendaria, comentario, estado, created_at",
      )
      .eq("proveedor_id", userId)
      .limit(LIMITS.referencias),
    admin
      .from("notifications")
      .select(
        "id, tipo, titulo, mensaje, href, entity_type, entity_id, leida, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.notifications),
    admin
      .from("reports")
      .select(
        "id, booking_id, reported_id, tipo, motivo, descripcion, estado, created_at",
      )
      .eq("reporter_id", userId)
      .limit(LIMITS.reports),
    admin
      .from("credito_debitos")
      .select("idempotency_key, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.credito),
    admin
      .from("credito_abonos")
      .select("idempotency_key, amount, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(LIMITS.credito),
    admin
      .from("sin_comision_claims")
      .select("idempotency_key, created_at")
      .eq("user_id", userId)
      .limit(LIMITS.credito),
    admin
      .from("conversations")
      .select("id, participant_a_id, participant_b_id, created_at")
      .eq("participant_a_id", userId)
      .limit(LIMITS.conversations),
    admin
      .from("conversations")
      .select("id, participant_a_id, participant_b_id, created_at")
      .eq("participant_b_id", userId)
      .limit(LIMITS.conversations),
    admin
      .from("viajes")
      .select("id, nombre, ciudad, fecha_inicio, fecha_fin, familia_id, created_at")
      .eq("creador_id", userId)
      .limit(LIMITS.viajes),
    admin
      .from("familia_miembros")
      .select("id, familia_id, rol, estado, email_invitado, created_at")
      .eq("perfil_id", userId)
      .limit(100),
    admin
      .from("provider_documents")
      .select("id, tipo, vertical, url, created_at, updated_at")
      .eq("proveedor_id", userId)
      .limit(100),
  ]);

  // Tablas opcionales / ledger: no tumbar el export si faltan en algún entorno
  const softFailTables = new Set([
    "credito_debitos",
    "credito_abonos",
    "sin_comision_claims",
    "provider_documents",
    "viajes",
    "familia_miembros",
    "referencias",
    "favoritos",
    "user_consents",
  ]);

  for (const res of [
    { r: profileRes, t: "profiles" },
    { r: consentsRes, t: "user_consents" },
    { r: servicesRes, t: "services" },
    { r: bookingsClienteRes, t: "bookings" },
    { r: favoritosRes, t: "favoritos" },
    { r: reviewsWrittenRes, t: "reviews" },
    { r: reviewsReceivedRes, t: "reviews" },
    { r: referenciasRes, t: "referencias" },
    { r: notificationsRes, t: "notifications" },
    { r: reportsRes, t: "reports" },
    { r: debitoRes, t: "credito_debitos" },
    { r: abonoRes, t: "credito_abonos" },
    { r: claimsRes, t: "sin_comision_claims" },
    { r: convARes, t: "conversations" },
    { r: convBRes, t: "conversations" },
    { r: viajesRes, t: "viajes" },
    { r: familiaMiembroRes, t: "familia_miembros" },
    { r: providerDocsRes, t: "provider_documents" },
  ]) {
    if (res.r.error && !softFailTables.has(res.t)) {
      throw new Error(`Error leyendo ${res.t}: ${res.r.error.message}`);
    }
  }

  const serviceIds = (servicesRes.data || []).map((s) => s.id);

  let bookingsProveedor = [];
  if (serviceIds.length > 0) {
    const { data, error } = await admin
      .from("bookings")
      .select(
        "id, service_id, cliente_id, estado, fecha_inicio, fecha_fin, hora, duracion_horas, precio_total, precio_base, credito_aplicado, mensaje, lugar_servicio, num_huespedes, modalidad_cobro, grupo_reserva, payment_intent_id, pago_liberado_at, importe_transferido, created_at, completada_at, services:service_id(id, titulo, vertical)",
      )
      .in("service_id", serviceIds)
      .order("created_at", { ascending: false })
      .limit(LIMITS.bookings);
    if (error) throw new Error(`Error leyendo bookings proveedor: ${error.message}`);
    bookingsProveedor = data || [];
  }

  const conversations = [
    ...(convARes.data || []),
    ...(convBRes.data || []),
  ];
  const convById = new Map();
  for (const c of conversations) {
    if (c?.id) convById.set(c.id, c);
  }
  const conversationIds = [...convById.keys()];

  const otherIds = new Set();
  for (const c of convById.values()) {
    const other =
      c.participant_a_id === userId
        ? c.participant_b_id
        : c.participant_a_id;
    if (other) otherIds.add(other);
  }
  for (const b of bookingsProveedor) {
    if (b.cliente_id) otherIds.add(b.cliente_id);
  }
  for (const r of reviewsReceivedRes.data || []) {
    if (r.cliente_id) otherIds.add(r.cliente_id);
  }
  for (const f of favoritosRes.data || []) {
    if (f.proveedor_id) otherIds.add(f.proveedor_id);
  }
  for (const b of bookingsClienteRes.data || []) {
    const pid = b.services?.proveedor_id;
    if (pid) otherIds.add(pid);
  }
  for (const r of reportsRes.data || []) {
    if (r.reported_id) otherIds.add(r.reported_id);
  }

  const otherIdList = [...otherIds];
  let publicById = {};
  if (otherIdList.length > 0) {
    const { data: publics } = await admin
      .from("profiles_public")
      .select("id, nombre, apellido")
      .in("id", otherIdList);
    publicById = Object.fromEntries(
      (publics || []).map((p) => [p.id, publicPerson(p)]),
    );
  }

  let messages = [];
  if (conversationIds.length > 0) {
    const { data, error } = await admin
      .from("messages")
      .select("id, conversation_id, sender_id, content, read, created_at")
      .eq("sender_id", userId)
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(LIMITS.messages);
    if (error) throw new Error(`Error leyendo messages: ${error.message}`);
    messages = data || [];
  }

  // Contacto de reservas propias (direcciones del interesado)
  const bookingClienteIds = (bookingsClienteRes.data || []).map((b) => b.id);
  let bookingContacts = [];
  if (bookingClienteIds.length > 0) {
    const { data } = await admin
      .from("booking_contact_cliente")
      .select("booking_id, direccion_cliente, updated_at")
      .in("booking_id", bookingClienteIds.slice(0, 500));
    bookingContacts = data || [];
  }

  const contactByBooking = Object.fromEntries(
    bookingContacts.map((c) => [c.booking_id, c.direccion_cliente]),
  );

  const profile = profileRes.data
    ? sanitizeOwnProfile(profileRes.data)
    : null;

  const reservasComoCliente = (bookingsClienteRes.data || []).map((b) => ({
    id: b.id,
    estado: b.estado,
    fecha_inicio: b.fecha_inicio,
    fecha_fin: b.fecha_fin,
    hora: b.hora,
    duracion_horas: b.duracion_horas,
    precio_total: b.precio_total,
    precio_base: b.precio_base,
    credito_aplicado: b.credito_aplicado,
    mensaje: b.mensaje,
    lugar_servicio: b.lugar_servicio,
    direccion_cliente_a_definir: b.direccion_cliente_a_definir,
    direccion_cliente: contactByBooking[b.id] ?? null,
    num_huespedes: b.num_huespedes,
    modalidad_cobro: b.modalidad_cobro,
    grupo_reserva: b.grupo_reserva,
    payment_intent_id: b.payment_intent_id,
    pago_liberado_at: b.pago_liberado_at,
    importe_transferido: b.importe_transferido,
    confirmacion_cliente: b.confirmacion_cliente,
    comentario_problema: b.comentario_problema,
    created_at: b.created_at,
    completada_at: b.completada_at,
    servicio: b.services
      ? {
          id: b.services.id,
          titulo: b.services.titulo,
          vertical: b.services.vertical,
        }
      : null,
    proveedor: publicById[b.services?.proveedor_id] || {
      id: b.services?.proveedor_id ?? null,
    },
  }));

  const reservasComoProveedor = bookingsProveedor.map((b) => ({
    id: b.id,
    estado: b.estado,
    fecha_inicio: b.fecha_inicio,
    fecha_fin: b.fecha_fin,
    hora: b.hora,
    duracion_horas: b.duracion_horas,
    precio_total: b.precio_total,
    precio_base: b.precio_base,
    credito_aplicado: b.credito_aplicado,
    // mensaje del cliente: contenido de la reserva; no añadimos teléfono/email del cliente
    mensaje_del_cliente: b.mensaje,
    lugar_servicio: b.lugar_servicio,
    num_huespedes: b.num_huespedes,
    modalidad_cobro: b.modalidad_cobro,
    grupo_reserva: b.grupo_reserva,
    payment_intent_id: b.payment_intent_id,
    pago_liberado_at: b.pago_liberado_at,
    importe_transferido: b.importe_transferido,
    created_at: b.created_at,
    completada_at: b.completada_at,
    servicio: b.services
      ? {
          id: b.services.id,
          titulo: b.services.titulo,
          vertical: b.services.vertical,
        }
      : null,
    cliente: publicById[b.cliente_id] || { id: b.cliente_id },
  }));

  const conversaciones = [...convById.values()].map((c) => {
    const otherId =
      c.participant_a_id === userId
        ? c.participant_b_id
        : c.participant_a_id;
    return {
      id: c.id,
      created_at: c.created_at,
      interlocutor: publicById[otherId] || { id: otherId },
    };
  });

  const mensajesEnviados = messages.map((m) => {
    const conv = convById.get(m.conversation_id);
    const otherId = conv
      ? conv.participant_a_id === userId
        ? conv.participant_b_id
        : conv.participant_a_id
      : null;
    return {
      id: m.id,
      conversation_id: m.conversation_id,
      content: m.content,
      read: m.read,
      created_at: m.created_at,
      interlocutor: otherId
        ? publicById[otherId] || { id: otherId }
        : null,
    };
  });

  return {
    meta: {
      exported_at: exportedAt,
      format_version: 1,
      user_id: userId,
      account_email: user.email ?? null,
      account_created_at: user.created_at ?? null,
      note:
        "Exportación de datos personales (RGPD). Los datos de terceros se limitan a identificador y nombre público. No se incluyen documentos binarios; sí las rutas/metadatos de tus propios documentos si existen.",
      limits: LIMITS,
      warnings: softWarnings([
        debitoRes,
        abonoRes,
        claimsRes,
        viajesRes,
        familiaMiembroRes,
        providerDocsRes,
      ]),
    },
    perfil: profile,
    consentimiento_legal: {
      vigente: {
        acepto_terminos_at: profile?.acepto_terminos_at ?? null,
        terminos_version: profile?.terminos_version ?? null,
        acepto_privacidad_at: profile?.acepto_privacidad_at ?? null,
        privacidad_version: profile?.privacidad_version ?? null,
      },
      historico: consentsRes.error ? [] : consentsRes.data || [],
    },
    cuenta_auth: {
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      user_metadata: sanitizeMetadata(user.user_metadata),
    },
    servicios_publicados: servicesRes.data || [],
    documentos_proveedor: (providerDocsRes.data || []).map((d) => ({
      id: d.id,
      tipo: d.tipo,
      vertical: d.vertical,
      storage_path: d.url,
      created_at: d.created_at,
      updated_at: d.updated_at,
    })),
    reservas_como_cliente: reservasComoCliente,
    reservas_como_proveedor: reservasComoProveedor,
    conversaciones,
    mensajes_enviados: mensajesEnviados,
    reseñas_escritas: reviewsWrittenRes.data || [],
    reseñas_recibidas: (reviewsReceivedRes.data || []).map((r) => ({
      id: r.id,
      booking_id: r.booking_id,
      service_id: r.service_id,
      valoracion: r.valoracion,
      comentario: r.comentario,
      created_at: r.created_at,
      cliente: publicById[r.cliente_id] || { id: r.cliente_id },
    })),
    favoritos: (favoritosRes.data || []).map((f) => ({
      id: f.id,
      created_at: f.created_at,
      proveedor: publicById[f.proveedor_id] || { id: f.proveedor_id },
    })),
    referencias_solicitadas: referenciasRes.error
      ? []
      : referenciasRes.data || [],
    notificaciones: notificationsRes.data || [],
    reportes_enviados: (reportsRes.data || []).map((r) => ({
      id: r.id,
      booking_id: r.booking_id,
      tipo: r.tipo,
      motivo: r.motivo,
      descripcion: r.descripcion,
      estado: r.estado,
      created_at: r.created_at,
      reported_user: publicById[r.reported_id] || { id: r.reported_id },
    })),
    credito: {
      saldo_disponible: profile?.credito_disponible ?? null,
      debitos: debitoRes.error ? [] : debitoRes.data || [],
      abonos: abonoRes.error ? [] : abonoRes.data || [],
      reservas_sin_comision_claims: claimsRes.error
        ? []
        : claimsRes.data || [],
    },
    viajes: viajesRes.error ? [] : viajesRes.data || [],
    familia: familiaMiembroRes.error ? [] : familiaMiembroRes.data || [],
  };
}

function sanitizeOwnProfile(p) {
  // Incluye todos los campos del perfil del interesado (sus propios datos).
  // No filtramos doc_*_url: son rutas propias (no el binario).
  const { ...rest } = p;
  return rest;
}

function sanitizeMetadata(meta) {
  if (!meta || typeof meta !== "object") return null;
  const { nombre, apellido, role, codigo_referido } = meta;
  return { nombre, apellido, role, codigo_referido };
}

function softWarnings(results) {
  const w = [];
  for (const r of results) {
    if (r?.error) w.push(r.error.message);
  }
  return w;
}
