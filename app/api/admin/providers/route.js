import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function GET() {
  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("role", "proveedor")
    .order("fecha_registro", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enriquecer con email de auth.users
  const enriched = await Promise.all(
    (profiles || []).map(async (p) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(p.id);
      return { ...p, email_contacto: userData?.user?.email || null };
    }),
  );

  return NextResponse.json({ providers: enriched });
}
