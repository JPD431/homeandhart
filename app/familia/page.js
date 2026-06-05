"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  getFamiliaInitials,
  getFamiliaMiembros,
  getUserFamiliaActiva,
} from "@/app/lib/familia";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function MiembroAvatar({ perfil, email }) {
  const avatarUrl = perfil?.foto_perfil || perfil?.avatar_url || null;
  const initials = getFamiliaInitials(perfil?.nombre, perfil?.apellido);

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="h-11 w-11 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
      style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
    >
      {initials !== "?" ? initials : email?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

export default function FamiliaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aceptarId = searchParams.get("aceptar");

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [familia, setFamilia] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [nombreFamilia, setNombreFamilia] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFamilia = useCallback(async (uid) => {
    const activa = await getUserFamiliaActiva(supabase, uid);
    if (!activa) {
      setFamilia(null);
      setUserRol(null);
      setMiembros([]);
      return;
    }

    setFamilia(activa.familia);
    setUserRol(activa.rol);
    const lista = await getFamiliaMiembros(supabase, activa.familia.id);
    setMiembros(lista);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      if (aceptarId) {
        const { data: invitacion } = await supabase
          .from("familia_miembros")
          .select("id, estado, email_invitado, perfil_id, familia_id")
          .eq("id", aceptarId)
          .maybeSingle();

        if (invitacion?.estado === "pendiente") {
          const emailMatch =
            invitacion.email_invitado?.toLowerCase() ===
            user.email?.toLowerCase();
          const perfilMatch =
            !invitacion.perfil_id || invitacion.perfil_id === user.id;

          if (emailMatch && perfilMatch) {
            const yaEnFamilia = await getUserFamiliaActiva(supabase, user.id);
            if (!yaEnFamilia) {
              await supabase
                .from("familia_miembros")
                .update({
                  perfil_id: user.id,
                  estado: "activo",
                  email_invitado: null,
                })
                .eq("id", aceptarId);
              setSuccess("¡Te has unido al grupo familiar!");
            }
          }
        }
        router.replace("/familia");
      }

      await loadFamilia(user.id);
      setLoading(false);
    }

    init();
  }, [router, aceptarId, loadFamilia]);

  async function handleCreateFamilia(e) {
    e.preventDefault();
    if (!nombreFamilia.trim()) {
      setError("Indica un nombre para tu familia.");
      return;
    }

    setCreating(true);
    setError("");
    setSuccess("");

    const { data: familiaData, error: familiaError } = await supabase
      .from("familias")
      .insert({
        nombre: nombreFamilia.trim(),
        creador_id: userId,
      })
      .select("id, nombre, creador_id")
      .single();

    if (familiaError) {
      setCreating(false);
      setError(familiaError.message);
      return;
    }

    const { error: memberError } = await supabase
      .from("familia_miembros")
      .insert({
        familia_id: familiaData.id,
        perfil_id: userId,
        rol: "administrador",
        estado: "activo",
      });

    setCreating(false);

    if (memberError) {
      setError(memberError.message);
      return;
    }

    setSuccess("Grupo familiar creado correctamente.");
    setNombreFamilia("");
    await loadFamilia(userId);
  }

  async function handleInvite(e) {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setError("Indica un email para invitar.");
      return;
    }

    setInviting(true);
    setError("");
    setSuccess("");

    const email = inviteEmail.trim().toLowerCase();

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, nombre, email_contacto")
      .ilike("email_contacto", email)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: yaMiembro } = await supabase
        .from("familia_miembros")
        .select("id")
        .eq("familia_id", familia.id)
        .eq("perfil_id", existingProfile.id)
        .maybeSingle();

      if (yaMiembro) {
        setInviting(false);
        setError("Esa persona ya pertenece al grupo.");
        return;
      }
    }

    const { data: pendingInvite } = await supabase
      .from("familia_miembros")
      .select("id")
      .eq("familia_id", familia.id)
      .eq("email_invitado", email)
      .eq("estado", "pendiente")
      .maybeSingle();

    if (pendingInvite) {
      setInviting(false);
      setError("Ya hay una invitación pendiente para ese email.");
      return;
    }

    const { data: invitacion, error: inviteError } = await supabase
      .from("familia_miembros")
      .insert({
        familia_id: familia.id,
        perfil_id: existingProfile?.id ?? null,
        email_invitado: email,
        rol: "miembro",
        estado: "pendiente",
      })
      .select("id")
      .single();

    if (inviteError) {
      setInviting(false);
      setError(inviteError.message);
      return;
    }

    const { data: invitador } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", userId)
      .single();

    const invitadorNombre =
      [invitador?.nombre, invitador?.apellido].filter(Boolean).join(" ") ||
      "Un miembro";

    await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "invitacion_familia",
        destinatario_email: email,
        invitador_nombre: invitadorNombre,
        familia_nombre: familia.nombre,
        aceptar_url: `${process.env.NEXT_PUBLIC_URL || ""}/familia?aceptar=${invitacion.id}`,
      }),
    });

    setInviting(false);
    setInviteEmail("");
    setSuccess("Invitación enviada correctamente.");
    await loadFamilia(userId);
  }

  async function handleRemoveMember(memberId) {
    setRemovingId(memberId);
    setError("");

    const { error: removeError } = await supabase
      .from("familia_miembros")
      .delete()
      .eq("id", memberId);

    setRemovingId(null);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    setSuccess("Miembro eliminado del grupo.");
    await loadFamilia(userId);
  }

  const isAdmin = userRol === "administrador";

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <header
        className="px-4 py-6 text-white sm:px-6"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="mx-auto max-w-2xl">
          <Link
            href="/dashboard"
            className="text-sm text-white/80 no-underline transition-opacity hover:opacity-100"
          >
            ← Volver al dashboard
          </Link>
          <h1
            className="mt-2 text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Grupo familiar
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </p>
        )}

        {!familia ? (
          <section
            className="rounded-2xl border bg-white p-6 sm:p-8"
            style={{ borderColor: BRAND.border }}
          >
            <h2 className="text-lg font-semibold text-[#1a1a1a]">
              Crea tu grupo familiar
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              Coordina reservas con tu familia: todos los miembros podrán ver y
              hacer reservas bajo el mismo grupo.
            </p>
            <form onSubmit={handleCreateFamilia} className="mt-6">
              <label
                htmlFor="nombre-familia"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Nombre de tu familia
              </label>
              <input
                id="nombre-familia"
                type="text"
                value={nombreFamilia}
                onChange={(e) => setNombreFamilia(e.target.value)}
                placeholder="Ej: Familia García"
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
              <button
                type="submit"
                disabled={creating}
                className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
                style={{ backgroundColor: BRAND.primary }}
              >
                {creating ? "Creando…" : "Crear grupo familiar"}
              </button>
            </form>
          </section>
        ) : (
          <div className="space-y-6">
            <section
              className="rounded-2xl border bg-white p-6"
              style={{ borderColor: BRAND.border }}
            >
              <h2
                className="text-xl font-semibold text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                {familia.nombre}
              </h2>
              <p className="mt-1 text-sm text-[#888]">
                {miembros.filter((m) => m.estado === "activo").length} miembro
                {miembros.filter((m) => m.estado === "activo").length !== 1
                  ? "s"
                  : ""}{" "}
                activo
                {miembros.filter((m) => m.estado === "pendiente").length > 0
                  ? ` · ${miembros.filter((m) => m.estado === "pendiente").length} invitación pendiente`
                  : ""}
              </p>

              <ul className="mt-5 flex flex-col gap-3">
                {miembros.map((miembro) => {
                  const perfil = miembro.profiles;
                  const nombre =
                    perfil
                      ? [perfil.nombre, perfil.apellido]
                          .filter(Boolean)
                          .join(" ")
                      : miembro.email_invitado || "Invitado";
                  const rolLabel =
                    miembro.rol === "administrador"
                      ? "Administrador"
                      : "Miembro";
                  const isPending = miembro.estado === "pendiente";

                  return (
                    <li
                      key={miembro.id}
                      className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <MiembroAvatar
                          perfil={perfil}
                          email={miembro.email_invitado}
                        />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-[#1a1a1a]">
                            {nombre}
                          </p>
                          <p className="text-xs text-[#888]">
                            {isPending ? "Invitación pendiente" : rolLabel}
                          </p>
                        </div>
                      </div>
                      {isAdmin &&
                        miembro.perfil_id !== userId &&
                        !isPending && (
                          <button
                            type="button"
                            disabled={removingId === miembro.id}
                            onClick={() => handleRemoveMember(miembro.id)}
                            className="shrink-0 text-xs text-red-600 underline disabled:opacity-60"
                          >
                            {removingId === miembro.id
                              ? "Eliminando…"
                              : "Eliminar"}
                          </button>
                        )}
                      {isAdmin && isPending && (
                        <button
                          type="button"
                          disabled={removingId === miembro.id}
                          onClick={() => handleRemoveMember(miembro.id)}
                          className="shrink-0 text-xs text-[#888] underline disabled:opacity-60"
                        >
                          Cancelar
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {isAdmin && (
              <section
                className="rounded-2xl border bg-white p-6"
                style={{ borderColor: BRAND.border }}
              >
                <h3 className="text-base font-semibold text-[#1a1a1a]">
                  Invitar miembros
                </h3>
                <p className="mt-1 text-sm text-[#666]">
                  Los administradores pueden invitar y eliminar miembros. Los
                  miembros pueden ver reservas del grupo y reservar bajo el
                  grupo.
                </p>
                <form onSubmit={handleInvite} className="mt-4">
                  <label
                    htmlFor="invite-email"
                    className="mb-1.5 block text-xs font-medium text-[#444]"
                  >
                    Email del familiar
                  </label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="familiar@email.com"
                      className={inputClass}
                      style={{ borderColor: BRAND.border }}
                    />
                    <button
                      type="submit"
                      disabled={inviting}
                      className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {inviting ? "Enviando…" : "Enviar invitación"}
                    </button>
                  </div>
                </form>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
