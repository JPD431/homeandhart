import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  fotosArraysEqual,
  normalizeFotosArray,
  parseFotosFromDb,
  parseFotosFromDbStrict,
  syncServicePhotos,
} from "@/app/lib/service-photos";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Persiste la galería de un servicio (fotos jsonb + foto_url portada).
 * Verifica ownership con el cliente del usuario; escribe y re-lee con service role.
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

  const receivedRaw = body?.fotos;
  const fotos = normalizeFotosArray(receivedRaw);
  const payload = syncServicePhotos({}, fotos);

  console.log("[api/services/fotos] body recibido", {
    serviceId,
    userId: user.id,
    receivedType: Array.isArray(receivedRaw) ? "array" : typeof receivedRaw,
    receivedCount: Array.isArray(receivedRaw) ? receivedRaw.length : 0,
    receivedUrls: receivedRaw,
    normalizedCount: payload.fotos.length,
    normalizedUrls: payload.fotos,
    foto_url: payload.foto_url,
  });

  const { data: owned, error: ownerError } = await supabase
    .from("services")
    .select("id, proveedor_id, fotos, foto_url")
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .maybeSingle();

  if (ownerError) {
    console.error("[api/services/fotos] error comprobando ownership", ownerError);
    return NextResponse.json({ error: ownerError.message }, { status: 500 });
  }

  if (!owned) {
    console.error("[api/services/fotos] servicio no encontrado o sin permiso", {
      serviceId,
      userId: user.id,
    });
    return NextResponse.json(
      { error: "Servicio no encontrado o sin permiso" },
      { status: 404 },
    );
  }

  const beforeStrict = parseFotosFromDbStrict(owned);
  console.log("[api/services/fotos] estado BD antes del update", {
    serviceId,
    beforeStrictCount: beforeStrict.length,
    beforeStrict,
    beforeFotoUrl: owned.foto_url,
    rawFotosType: typeof owned.fotos,
    rawFotos: owned.fotos,
  });

  const { data: updateRow, error: updateError } = await supabaseAdmin
    .from("services")
    .update(payload)
    .eq("id", serviceId)
    .eq("proveedor_id", user.id)
    .select("id, fotos, foto_url")
    .maybeSingle();

  console.log("[api/services/fotos] resultado update", {
    serviceId,
    updateError: updateError?.message ?? null,
    updateRowId: updateRow?.id ?? null,
    updateRowFotosType: updateRow ? typeof updateRow.fotos : null,
    updateRowFotos: updateRow?.fotos ?? null,
    updateRowFotoUrl: updateRow?.foto_url ?? null,
  });

  if (updateError) {
    console.error("[api/services/fotos] update error", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updateRow?.id) {
    console.error("[api/services/fotos] update no afectó filas", {
      serviceId,
      userId: user.id,
    });
    return NextResponse.json(
      {
        error:
          "El update no modificó ninguna fila (id o proveedor_id no coinciden).",
        verified: false,
      },
      { status: 500 },
    );
  }

  const { data: afterRow, error: readError } = await supabaseAdmin
    .from("services")
    .select("id, fotos, foto_url, proveedor_id")
    .eq("id", serviceId)
    .single();

  console.log("[api/services/fotos] re-lectura independiente tras update", {
    serviceId,
    readError: readError?.message ?? null,
    afterRowFotosType: afterRow ? typeof afterRow.fotos : null,
    afterRowFotos: afterRow?.fotos ?? null,
    afterRowFotoUrl: afterRow?.foto_url ?? null,
  });

  if (readError || !afterRow) {
    console.error("[api/services/fotos] error re-leyendo fila", readError);
    return NextResponse.json(
      {
        error: readError?.message || "No se pudo verificar la escritura en BD.",
        verified: false,
      },
      { status: 500 },
    );
  }

  const savedStrict = parseFotosFromDbStrict(afterRow);
  const savedWithFallback = parseFotosFromDb(afterRow);

  console.log("[api/services/fotos] verificación estricta", {
    serviceId,
    sentCount: payload.fotos.length,
    savedStrictCount: savedStrict.length,
    savedWithFallbackCount: savedWithFallback.length,
    sentUrls: payload.fotos,
    savedStrict,
    savedWithFallback,
    arraysEqual: fotosArraysEqual(savedStrict, payload.fotos),
  });

  if (savedStrict.length !== payload.fotos.length) {
    return NextResponse.json(
      {
        error: `La BD tiene ${savedStrict.length} foto(s) en fotos[] pero se enviaron ${payload.fotos.length}.`,
        verified: false,
        sent: payload.fotos,
        saved: savedStrict,
        savedWithFallback,
        dbRawFotos: afterRow.fotos,
        dbFotoUrl: afterRow.foto_url,
      },
      { status: 500 },
    );
  }

  if (!fotosArraysEqual(savedStrict, payload.fotos)) {
    const mismatches = payload.fotos
      .map((url, i) => (savedStrict[i] !== url ? { index: i, sent: url, saved: savedStrict[i] } : null))
      .filter(Boolean);

    return NextResponse.json(
      {
        error: "Las URLs en fotos[] no coinciden con las enviadas.",
        verified: false,
        sent: payload.fotos,
        saved: savedStrict,
        mismatches,
        dbRawFotos: afterRow.fotos,
        dbFotoUrl: afterRow.foto_url,
      },
      { status: 500 },
    );
  }

  console.log("[api/services/fotos] ok verificado", {
    serviceId,
    count: savedStrict.length,
    foto_url: afterRow.foto_url,
  });

  return NextResponse.json({
    id: afterRow.id,
    fotos: savedStrict,
    foto_url: afterRow.foto_url,
    verified: true,
    beforeCount: beforeStrict.length,
    savedCount: savedStrict.length,
  });
}
