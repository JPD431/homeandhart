import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(_request, { params }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Falta id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("notifications")
    .update({ leida: true })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[notifications/read] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(
      { error: "Notificación no encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
