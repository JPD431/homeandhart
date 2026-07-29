import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth/requireAdmin";
import { hasDniUploaded } from "@/app/lib/dni";
import { countCancelacionesNoExentasByUsers } from "@/app/lib/cancelaciones";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

function buildRolLabel(esProveedor, esCliente) {
  if (esProveedor && esCliente) return "Cliente + Proveedor";
  if (esProveedor) return "Proveedor";
  return "Cliente";
}

/**
 * GET /api/admin/usuarios?q=&filtro=todos|pendiente|sin_dni|verificado|rechazado&limit=
 */
export async function GET(request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const q = (searchParams.get("q") || "").trim().toLowerCase();
  const filtro = searchParams.get("filtro") || "todos";
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit")) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  const [servicesRes, bookingsRes] = await Promise.all([
    supabaseAdmin.from("services").select("proveedor_id"),
    supabaseAdmin.from("bookings").select("cliente_id"),
  ]);

  if (servicesRes.error) {
    return NextResponse.json({ error: servicesRes.error.message }, { status: 500 });
  }
  if (bookingsRes.error) {
    return NextResponse.json({ error: bookingsRes.error.message }, { status: 500 });
  }

  const proveedorIds = new Set(
    (servicesRes.data ?? []).map((r) => r.proveedor_id).filter(Boolean),
  );
  const clienteIds = new Set(
    (bookingsRes.data ?? []).map((r) => r.cliente_id).filter(Boolean),
  );

  let query = supabaseAdmin
    .from("profiles")
    .select(
      "id, nombre, apellido, role, doc_dni_url, dni_estado, dni_verificado_at, mayor_de_edad_confirmada, fecha_registro",
    )
    .order("fecha_registro", { ascending: false })
    .limit(limit);

  if (filtro === "sin_dni") {
    query = query.or("doc_dni_url.is.null,doc_dni_url.eq.");
  } else if (filtro === "pendiente") {
    query = query.not("doc_dni_url", "is", null).neq("doc_dni_url", "").eq("dni_estado", "pendiente");
  } else if (filtro === "verificado") {
    query = query.eq("dni_estado", "verificado");
  } else if (filtro === "rechazado") {
    query = query.eq("dni_estado", "rechazado");
  }

  if (q) {
    const pattern = `%${q.replace(/%/g, "")}%`;
    query = query.or(`nombre.ilike.${pattern},apellido.ilike.${pattern}`);
  }

  const { data: profiles, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const enriched = await Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(p.id);
      const email = userData?.user?.email?.toLowerCase() ?? null;

      const esProveedor = proveedorIds.has(p.id);
      const esCliente =
        clienteIds.has(p.id) || p.role === "cliente" || !esProveedor;

      return {
        id: p.id,
        nombre: p.nombre,
        apellido: p.apellido,
        email,
        doc_dni_url: p.doc_dni_url,
        dni_estado: p.dni_estado ?? "pendiente",
        dni_verificado_at: p.dni_verificado_at,
        mayor_de_edad_confirmada: p.mayor_de_edad_confirmada === true,
        created_at: p.fecha_registro,
        es_proveedor: esProveedor,
        es_cliente: esCliente,
        rol_label: buildRolLabel(esProveedor, esCliente),
        dni_subido: hasDniUploaded(p),
      };
    }),
  );

  const cancelCounts = await countCancelacionesNoExentasByUsers(
    enriched.map((u) => u.id),
  );

  const withCancels = enriched.map((u) => ({
    ...u,
    cancelaciones_count: cancelCounts[u.id] || 0,
  }));

  const usuarios = q
    ? withCancels.filter((u) => {
        const haystack = [
          u.nombre,
          u.apellido,
          u.email,
          [u.nombre, u.apellido].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
    : withCancels;

  const meta = {
    total: usuarios.length,
    limit,
    filtro,
    pendientes: usuarios.filter((u) => u.dni_subido && u.dni_estado === "pendiente")
      .length,
    sin_dni: usuarios.filter((u) => !u.dni_subido).length,
  };

  const [pendientesGlobal, sinDniGlobal] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("doc_dni_url", "is", null)
      .neq("doc_dni_url", "")
      .eq("dni_estado", "pendiente"),
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .or("doc_dni_url.is.null,doc_dni_url.eq."),
  ]);

  meta.summary = {
    pendientes: pendientesGlobal.count ?? 0,
    sin_dni: sinDniGlobal.count ?? 0,
  };

  return NextResponse.json({ usuarios, meta });
}
