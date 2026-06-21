import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verificarTokenConfirmacion } from "@/app/lib/confirmar-token";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { bookingId, token, comentario } = body ?? {};

  if (!bookingId || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!verificarTokenConfirmacion(bookingId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      confirmacion_cliente: "problema",
      comentario_problema: comentario?.trim() || null,
      confirmado_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
