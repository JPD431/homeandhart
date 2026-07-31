import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/app/lib/rate-limit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function POST(request) {
  const limited = await enforceRateLimit(request, {
    limit: 20,
    window: "1 m",
    prefix: "referidos-validar",
  });
  if (limited) return limited;

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
