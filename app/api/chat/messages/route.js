import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { shouldFilterContactBetween } from "@/app/lib/chat-booking-gate";
import {
  CONTACT_FILTER_BANNER,
  CONTACT_FILTER_NOTICE,
  filterChatContent,
  filterSpecialMensaje,
} from "@/app/lib/chat-content-filter";
import { enforceRateLimit } from "@/app/lib/rate-limit";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function loadConversationForUser(conversationId, userId) {
  const { data: conversation, error } = await supabaseAdmin
    .from("conversations")
    .select("id, participant_a_id, participant_b_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 };
  }
  if (!conversation) {
    return { error: "Conversación no encontrada", status: 404 };
  }

  const isA = conversation.participant_a_id === userId;
  const isB = conversation.participant_b_id === userId;
  if (!isA && !isB) {
    return { error: "No autorizado", status: 403 };
  }

  const otherId = isA
    ? conversation.participant_b_id
    : conversation.participant_a_id;

  return { conversation, otherId };
}

/**
 * GET /api/chat/messages?conversation_id=
 * Indica si el filtro de contacto está activo para esa conversación.
 */
export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) {
    return NextResponse.json(
      { error: "Falta conversation_id" },
      { status: 400 },
    );
  }

  const loaded = await loadConversationForUser(conversationId, user.id);
  if (loaded.error) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status },
    );
  }

  const filterActive = await shouldFilterContactBetween(
    supabaseAdmin,
    user.id,
    loaded.otherId,
  );

  return NextResponse.json({
    filter_active: filterActive,
    banner: filterActive ? CONTACT_FILTER_BANNER : null,
    notice: CONTACT_FILTER_NOTICE,
  });
}

/**
 * POST /api/chat/messages
 * Único camino de envío de mensajes (texto, oferta, solicitud_precio).
 * Filtra contacto SERVER-SIDE si aún no hay reserva conjunta confirmada+.
 *
 * Body:
 *  - { conversation_id, content } — texto libre
 *  - { conversation_id, oferta: { service_id, service_titulo?, precio_especial, precio_original?, valida_hasta, mensaje? } }
 *  - { conversation_id, solicitud_precio: { service_id, service_titulo?, precio_propuesto, precio_original?, mensaje? } }
 */
export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const limited = await enforceRateLimit(request, {
    limit: 60,
    window: "1 m",
    prefix: "chat-messages",
    userId: user.id,
  });
  if (limited) return limited;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const conversationId =
    typeof body?.conversation_id === "string"
      ? body.conversation_id.trim()
      : "";

  if (!conversationId) {
    return NextResponse.json(
      { error: "Falta conversation_id" },
      { status: 400 },
    );
  }

  const loaded = await loadConversationForUser(conversationId, user.id);
  if (loaded.error) {
    return NextResponse.json(
      { error: loaded.error },
      { status: loaded.status },
    );
  }

  const filterActive = await shouldFilterContactBetween(
    supabaseAdmin,
    user.id,
    loaded.otherId,
  );

  let content;
  let censored = false;

  if (body?.oferta && typeof body.oferta === "object") {
    const o = body.oferta;
    const serviceId =
      typeof o.service_id === "string" ? o.service_id.trim() : "";
    const precio = Number(o.precio_especial);
    const validaHasta =
      typeof o.valida_hasta === "string" ? o.valida_hasta.trim() : "";
    if (!serviceId || !precio || precio <= 0 || !validaHasta) {
      return NextResponse.json(
        { error: "Oferta incompleta (servicio, precio, validez)." },
        { status: 400 },
      );
    }

    const msgFiltered = filterSpecialMensaje(o.mensaje || "", {
      applyFilter: filterActive,
    });
    censored = msgFiltered.censored;

    content = JSON.stringify({
      tipo: "oferta",
      service_id: serviceId,
      service_titulo:
        typeof o.service_titulo === "string"
          ? o.service_titulo.trim() || "Servicio"
          : "Servicio",
      precio_especial: precio,
      precio_original: Number(o.precio_original) || 0,
      valida_hasta: validaHasta,
      mensaje: msgFiltered.content,
    });
  } else if (body?.solicitud_precio && typeof body.solicitud_precio === "object") {
    const s = body.solicitud_precio;
    const serviceId =
      typeof s.service_id === "string" ? s.service_id.trim() : "";
    const precio = Number(s.precio_propuesto);
    if (!serviceId || !precio || precio <= 0) {
      return NextResponse.json(
        { error: "Solicitud incompleta (servicio y precio)." },
        { status: 400 },
      );
    }

    const msgFiltered = filterSpecialMensaje(s.mensaje || "", {
      applyFilter: filterActive,
    });
    censored = msgFiltered.censored;

    content = JSON.stringify({
      tipo: "solicitud_precio",
      service_id: serviceId,
      service_titulo:
        typeof s.service_titulo === "string"
          ? s.service_titulo.trim() || "Servicio"
          : "Servicio",
      precio_propuesto: precio,
      precio_original: Number(s.precio_original) || 0,
      mensaje: msgFiltered.content,
    });
  } else {
    const raw =
      typeof body?.content === "string" ? body.content : "";
    if (!raw.trim()) {
      return NextResponse.json(
        { error: "Mensaje vacío" },
        { status: 400 },
      );
    }

    const filtered = filterChatContent(raw, { applyFilter: filterActive });
    content = filtered.content;
    censored = filtered.censored;

    if (!content) {
      return NextResponse.json(
        { error: "Mensaje vacío" },
        { status: 400 },
      );
    }
  }

  const { data, error: insertError } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
      read: false,
    })
    .select("id, conversation_id, sender_id, content, created_at, read")
    .single();

  if (insertError) {
    console.error("[chat/messages] INSERT error:", insertError);
    return NextResponse.json(
      { error: insertError.message || "No se pudo guardar el mensaje" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    message: data,
    censored,
    filter_active: filterActive,
    notice: censored ? CONTACT_FILTER_NOTICE : null,
  });
}
