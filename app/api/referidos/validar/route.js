import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false });
  }

  const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";

  if (!codigo) {
    return NextResponse.json({ valid: false });
  }

  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("codigo_referido", codigo)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ valid: !!data });
}
