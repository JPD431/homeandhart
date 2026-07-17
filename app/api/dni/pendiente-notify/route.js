import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { notifyAdminsDniPendiente } from "@/app/lib/dni-admin-notify";

/**
 * POST /api/dni/pendiente-notify
 * Tras subir DNI, el usuario autenticado avisa a los admins.
 * Seguro: solo puede notificar sobre su propio perfil.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const result = await notifyAdminsDniPendiente(user.id);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error("[dni/pendiente-notify]", err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Error al notificar" },
      { status: 500 },
    );
  }
}
