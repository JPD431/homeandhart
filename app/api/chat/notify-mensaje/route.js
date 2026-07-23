import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dispatchPlatformEmail } from "@/app/lib/platform-email-dispatch";
import { resolverNombreUsuario } from "@/app/lib/email-usuario";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Notifica por email un mensaje nuevo en el chat.
 * Solo participantes de la conversación; destinatario = el otro participante.
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

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const conversationId = body?.conversation_id;
  const mensajePreview =
    typeof body?.mensaje_preview === "string" ? body.mensaje_preview : "";

  if (!conversationId || typeof conversationId !== "string") {
    return NextResponse.json(
      { error: "Falta conversation_id" },
      { status: 400 },
    );
  }

  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id, participant_a_id, participant_b_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (convError) {
    return NextResponse.json({ error: convError.message }, { status: 500 });
  }

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversación no encontrada" },
      { status: 404 },
    );
  }

  const isA = conversation.participant_a_id === user.id;
  const isB = conversation.participant_b_id === user.id;

  if (!isA && !isB) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const destinatarioId = isA
    ? conversation.participant_b_id
    : conversation.participant_a_id;

  if (!destinatarioId) {
    return NextResponse.json(
      { error: "Destinatario no encontrado" },
      { status: 400 },
    );
  }

  const remitenteNombre =
    (await resolverNombreUsuario(user.id)) || "Un usuario";
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";

  const result = await dispatchPlatformEmail({
    tipo: "mensaje_nuevo",
    destinatario_id: destinatarioId,
    remitente_nombre: remitenteNombre,
    mensaje_preview: mensajePreview.slice(0, 500),
    chat_url: `${baseUrl}/chat?conversation=${conversationId}`,
  });

  if (!result.ok) {
    console.error(
      "[chat/notify-mensaje] FALLO email",
      result.status,
      result.error,
    );
    return NextResponse.json(
      { error: result.error || "No se pudo enviar el email" },
      { status: result.status || 500 },
    );
  }

  return NextResponse.json({ success: true });
}
