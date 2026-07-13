import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { acceptFamiliaInvite } from "@/app/lib/familia-invites";
import { createClient } from "@/lib/supabase/server";

const supabaseAdmin = createServiceClient(
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

  const invitacionId = body?.invitacion_id?.trim?.() ?? body?.invitacion_id;
  if (!invitacionId) {
    return NextResponse.json(
      { error: "Falta invitacion_id" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const result = await acceptFamiliaInvite(
    supabaseAdmin,
    user.id,
    user.email,
    invitacionId,
  );

  if (!result.ok) {
    const status =
      result.code === "forbidden"
        ? 403
        : result.code === "not_found"
          ? 404
          : result.code === "already_in_family" ||
              result.code === "already_taken"
            ? 409
            : 400;

    return NextResponse.json({ error: result.message, code: result.code }, { status });
  }

  return NextResponse.json({
    success: true,
    code: result.code,
    message: result.message,
    familia_nombre: result.familia_nombre,
  });
}
