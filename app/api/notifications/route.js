import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const LIST_LIMIT = 30;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { count: unreadCount, error: countError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("leida", false);

  if (countError) {
    console.error("[notifications] Error contando no leídas:", countError.message);
    return NextResponse.json({ error: countError.message }, { status: 500 });
  }

  const { data: notifications, error: listError } = await supabase
    .from("notifications")
    .select(
      "id, tipo, titulo, mensaje, href, entity_type, entity_id, leida, created_at",
    )
    .eq("user_id", user.id)
    .order("leida", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);

  if (listError) {
    console.error("[notifications] Error listando:", listError.message);
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  return NextResponse.json({
    notifications: notifications ?? [],
    unread_count: unreadCount ?? 0,
  });
}
