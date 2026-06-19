import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CONOCE_DESDE_OPTIONS } from "@/app/lib/referencias";

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CONOCE_DESDE_VALUES = new Set(
  CONOCE_DESDE_OPTIONS.map((opt) => opt.value),
);

async function loadReferenciaByToken(token) {
  const { data, error } = await supabaseAdmin
    .from("referencias")
    .select(
      `
      id,
      nombre_referente,
      estado,
      proveedor_id,
      profiles_public:proveedor_id (nombre, apellido)
    `,
    )
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

function getProveedorNombre(referencia) {
  const p = referencia?.profiles_public;
  return (
    [p?.nombre, p?.apellido].filter(Boolean).join(" ").trim() || "el proveedor"
  );
}

function toPublicPayload(referencia) {
  return {
    nombre_referente: referencia.nombre_referente,
    proveedor_nombre: getProveedorNombre(referencia),
    estado: referencia.estado,
  };
}

export async function GET(request) {
  const token = new URL(request.url).searchParams.get("token");

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Falta token" }, { status: 400 });
  }

  try {
    const referencia = await loadReferenciaByToken(token);

    if (!referencia) {
      return NextResponse.json(
        { error: "Enlace de referencia no válido o expirado." },
        { status: 404 },
      );
    }

    return NextResponse.json(toPublicPayload(referencia));
  } catch (err) {
    console.error("[referencias/responder] GET:", err);
    return NextResponse.json(
      { error: err?.message || "Error al cargar la referencia" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { token, conoce_desde, recomendaria, comentario } = body ?? {};

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Falta token" }, { status: 400 });
  }

  if (!conoce_desde || !CONOCE_DESDE_VALUES.has(conoce_desde)) {
    return NextResponse.json(
      { error: "Indica cuánto tiempo conoces a esta persona." },
      { status: 400 },
    );
  }

  if (typeof recomendaria !== "boolean") {
    return NextResponse.json(
      { error: "Indica si recomendarías sus servicios." },
      { status: 400 },
    );
  }

  try {
    const referencia = await loadReferenciaByToken(token);

    if (!referencia) {
      return NextResponse.json(
        { error: "Enlace de referencia no válido o expirado." },
        { status: 404 },
      );
    }

    if (referencia.estado !== "pendiente") {
      return NextResponse.json(
        { error: "Este aval ya fue completado" },
        { status: 409 },
      );
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("referencias")
      .update({
        conoce_desde,
        recomendaria,
        comentario:
          typeof comentario === "string" && comentario.trim()
            ? comentario.trim()
            : null,
        estado: "completada",
      })
      .eq("token", token)
      .eq("estado", "pendiente")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: "Este aval ya fue completado" },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[referencias/responder] POST:", err);
    return NextResponse.json(
      { error: err?.message || "Error al guardar el aval" },
      { status: 500 },
    );
  }
}
