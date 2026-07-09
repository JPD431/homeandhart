import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  normalizeFotosArray,
  parseFotosFromDb,
  syncServicePhotos,
} from "@/app/lib/service-photos";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Persiste la galería de un servicio (fotos jsonb + foto_url portada).
 * Verifica que el servicio pertenece al usuario autenticado; escribe con service role.
 *
 * PATCH JSON: { fotos: string[] }
 */
export async function PATCH(request, { params }) {
  const { serviceId } = await params;
  if (!serviceId) {
    return NextResponse.json({ error: "Falta serviceId" }, { status: 400 });
  }

  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[api/services/fotos] no autorizado", authError);
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const fotos = normalizeFotosArray(body?.fotos);
  const payload = syncServicePhotos({}, fotos);

  console.log("[api/services/fotos] PATCH", {
    serviceId,
    userId: user.id,
    fotosCount: payload.fotos.length,
    foto_url: payload.foto_url,
  });

  const { data: owned, error: ownerError } = await supabase
    .from("services")
    .select("id, proveedor_id")
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .maybeSingle();

  if (ownerError) {
    console.error("[api/services/fotos] error comprobando ownership", ownerError);
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owned) {
    return NextResponse.json(
      { error: "Servicio no encontrado o sin permiso" },
      { status: 404 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .select("id, fotos, foto_url")
    .single();

  if (error) {
    console.error("[api/services/fotos] update error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const saved = parseFotosFromDb(data);

  console.log("[api/services/fotos] ok", {
    serviceId,
    sentCount: payload.fotos.length,
    savedCount: saved.length,
    foto_url: data?.foto_url,
  });

  if (saved.length !== payload.fotos.length) {
    return NextResponse.json(
      {
        error: `La BD guardó ${saved.length} foto(s) pero se enviaron ${payload.fotos.length}.`,
        sent: payload.fotos,
        saved,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: data.id,
    fotos: saved,
    foto_url: data.foto_url,
  });
}
