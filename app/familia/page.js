"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import FamiliaInviteBanner from "@/app/components/FamiliaInviteBanner";
import {
  getFamiliaInitials,
  getUserFamiliaActiva,
} from "@/app/lib/familia";
import { formatDateRange, getBookingEstado } from "@/app/lib/viajes";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";
const GREEN_DARK = "#085041";
const BORDER = "#e8e4de";

const VERTICAL_GRADIENTS = {
  alojamiento: `linear-gradient(135deg, ${PRIMARY}, #2a6bb5)`,
  ninos: "linear-gradient(135deg, #0e7a5c, #1a9d75)",
  mascotas: "linear-gradient(135deg, #c47d1a, #e09a2e)",
};

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#c47d1a", label: "Pendiente" },
  confirmada: { bg: "#e8f0fb", color: PRIMARY, label: "Confirmada" },
  en_curso: { bg: "#ede9fe", color: "#7c3aed", label: "En curso" },
  completada: { bg: "#e6f4f0", color: GREEN, label: "Completada" },
  cancelada: { bg: "#fee2e2", color: "#dc2626", label: "Cancelada" },
};

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function formatMemberDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFamiliaDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });
}

function formatPrice(precio) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio).toFixed(2)}€`;
}

function MiniNavbar() {
  return (
    <nav
      className="flex items-center justify-between border-b bg-white px-6 py-3"
      style={{ borderColor: BORDER }}
    >
      <Link
        href="/"
        className="no-underline"
        style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}
      >
        Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
      </Link>
      <Link href="/dashboard" className="text-sm no-underline" style={{ color: "#666" }}>
        ← Dashboard
      </Link>
    </nav>
  );
}

function MiembroAvatar({
  perfil,
  email,
  size = 44,
  borderColor,
  bgGray = false,
}) {
  const avatarUrl = perfil?.foto_perfil || perfil?.avatar_url || null;
  const initials = getFamiliaInitials(perfil?.nombre, perfil?.apellido);
  const dim = { width: size, height: size };

  if (avatarUrl && !bgGray) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ ...dim, border: borderColor ? `2px solid ${borderColor}` : undefined }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{
        ...dim,
        backgroundColor: bgGray ? "#9ca3af" : GREEN,
        border: borderColor ? `2px solid ${borderColor}` : undefined,
        color: bgGray ? "#fff" : "#fff",
      }}
    >
      {initials !== "?" ? initials : email?.[0]?.toUpperCase() || "?"}
    </span>
  );
}

function RolBadge({ rol, estado }) {
  if (estado === "pendiente") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: "#fdf3e3", color: "#c47d1a" }}
      >
        Pendiente
      </span>
    );
  }
  if (rol === "administrador") {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
        style={{ backgroundColor: "#e8f0fb", color: PRIMARY }}
      >
        Admin
      </span>
    );
  }
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: "#f3f4f6", color: "#666" }}
    >
      Miembro
    </span>
  );
}

function StatusBadge({ status }) {
  const key = status ?? "pendiente";
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function getViajeEmoji(viaje) {
  return "🧳";
}

function FamiliaPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aceptarId = searchParams.get("aceptar");

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [familia, setFamilia] = useState(null);
  const [userRol, setUserRol] = useState(null);
  const [miembros, setMiembros] = useState([]);
  const [reservas, setReservas] = useState([]);
  const [viajes, setViajes] = useState([]);
  const [nombreFamilia, setNombreFamilia] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [resendingId, setResendingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFamilia = useCallback(async (uid) => {
    const activa = await getUserFamiliaActiva(supabase, uid);
    if (!activa) {
      setFamilia(null);
      setUserRol(null);
      setMiembros([]);
      setReservas([]);
      setViajes([]);
      return;
    }

    const { data: familiaFull } = await supabase
      .from("familias")
      .select("id, nombre, creador_id, created_at")
      .eq("id", activa.familia.id)
      .single();

    setFamilia(familiaFull ?? activa.familia);
    setUserRol(activa.rol);

    const { data: lista } = await supabase
      .from("familia_miembros")
      .select("id, rol, estado, email_invitado, perfil_id, created_at")
      .eq("familia_id", activa.familia.id)
      .order("created_at", { ascending: true });

    const ids = (lista ?? []).map((m) => m.perfil_id).filter(Boolean);
    let perfilesPorId = {};
    if (ids.length > 0) {
      const { data: perfiles } = await supabase
        .from("profiles_public")
        .select("id, nombre, apellido, foto_perfil")
        .in("id", ids);
      perfilesPorId = Object.fromEntries((perfiles ?? []).map((p) => [p.id, p]));
    }
    const miembrosConPerfil = (lista ?? []).map((m) => ({
      ...m,
      profiles_public: m.perfil_id ? perfilesPorId[m.perfil_id] || null : null,
    }));
    setMiembros(miembrosConPerfil);

    const familiaId = activa.familia.id;

    const { data: reservasData } = await supabase
      .from("bookings")
      .select(
        `
        id,
        fecha_inicio,
        fecha_fin,
        precio_total,
        estado,
        cliente_id,
        services:service_id (titulo, vertical),
        profiles_public:cliente_id (nombre, apellido)
      `,
      )
      .eq("familia_id", familiaId)
      .order("created_at", { ascending: false })
      .limit(6);

    setReservas(reservasData ?? []);

    const { data: viajesData } = await supabase
      .from("viajes")
      .select(
        `
        id,
        nombre,
        fecha_inicio,
        fecha_fin,
        viaje_reservas (
          bookings:booking_id ( id )
        )
      `,
      )
      .eq("familia_id", familiaId)
      .order("fecha_inicio", { ascending: false })
      .limit(6);

    setViajes(viajesData ?? []);
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

      if (aceptarId) {
        try {
          const res = await fetch("/api/familia/aceptar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ invitacion_id: aceptarId }),
          });
          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            setSuccess(data.message || "¡Te has unido al grupo familiar!");
          } else if (data.code === "already_in_family") {
            setError(data.error || "Ya formas parte de otro grupo familiar.");
          } else if (data.code === "already_active") {
            setSuccess(data.message || "Ya formas parte de este grupo familiar.");
          } else {
            setError(data.error || "No se pudo aceptar la invitación.");
          }
        } catch {
          setError("Error de conexión al aceptar la invitación.");
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

  async function sendInviteEmail(email, invitacionId, tieneCuenta) {
    const { data: invitador } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", userId)
      .single();

    const invitadorNombre =
      [invitador?.nombre, invitador?.apellido].filter(Boolean).join(" ") ||
      "Un miembro";

    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_URL || "";
    const encodedEmail = encodeURIComponent(email);
    const emailTipo = tieneCuenta
      ? "invitacion_familia_login"
      : "invitacion_familia_registro";
    const accionUrl = tieneCuenta
      ? `${baseUrl}/login?email=${encodedEmail}`
      : `${baseUrl}/registro?email=${encodedEmail}`;

    await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: emailTipo,
        destinatario_email: email,
        invitador_nombre: invitadorNombre,
        familia_nombre: familia.nombre,
        accion_url: accionUrl,
        aceptar_url: `${baseUrl}/familia?aceptar=${invitacionId}`,
      }),
    });
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

    try {
      const res = await fetch("/api/familia/invitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ familia_id: familia.id, email }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setInviting(false);
        setError(
          data.error ||
            (res.status === 401
              ? "Debes iniciar sesión para invitar."
              : res.status === 403
                ? "No tienes permiso para invitar a esta familia."
                : res.status === 409
                  ? "Esa persona ya está en el grupo o tiene una invitación pendiente."
                  : "No se pudo enviar la invitación."),
        );
        return;
      }

      setInviting(false);
      setInviteEmail("");
      setSuccess("Invitación enviada correctamente.");
      await loadFamilia(userId);
    } catch {
      setInviting(false);
      setError("Error de conexión al enviar la invitación.");
    }
  }

  async function handleResendInvite(miembro) {
    if (!miembro.email_invitado) return;

    setResendingId(miembro.id);
    setError("");

    await sendInviteEmail(
      miembro.email_invitado,
      miembro.id,
      Boolean(miembro.perfil_id),
    );

    setResendingId(null);
    setSuccess("Invitación reenviada correctamente.");
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
  const activos = miembros.filter((m) => m.estado === "activo").length;
  const pendientes = miembros.filter((m) => m.estado === "pendiente").length;

  function scrollToInvite() {
    document.getElementById("invitar-miembros")?.scrollIntoView({ behavior: "smooth" });
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <MiniNavbar />
        <main className="px-6 py-16 text-center text-sm text-[#666]">Cargando…</main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <MiniNavbar />

      <main className="mx-auto space-y-5" style={{ padding: 24, maxWidth: 900 }}>
        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>
        )}

        <FamiliaInviteBanner
          onAccepted={(data) => {
            setSuccess(data.message || "¡Te has unido al grupo familiar!");
            setError("");
            if (userId) loadFamilia(userId);
          }}
        />

        {!familia ? (
          <section
            className="rounded-xl border bg-white px-6 py-10 text-center"
            style={{ borderColor: BORDER }}
          >
            <p className="text-[48px] leading-none" aria-hidden>
              👨‍👩‍👧
            </p>
            <h1
              className="mt-4 text-[20px] text-[#1a1a1a]"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              Crea tu grupo familiar
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#666]">
              Coordina reservas con tu familia: todos los miembros podrán ver y
              hacer reservas bajo el mismo grupo.
            </p>
            <form onSubmit={handleCreateFamilia} className="mx-auto mt-6 max-w-sm text-left">
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
                style={{ borderColor: BORDER }}
              />
              <button
                type="submit"
                disabled={creating}
                className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                style={{ backgroundColor: GREEN }}
              >
                {creating ? "Creando…" : "Crear grupo"}
              </button>
            </form>
          </section>
        ) : (
          <>
            {/* Tarjeta verde */}
            <div
              className="relative overflow-hidden text-white"
              style={{
                borderRadius: 16,
                padding: 28,
                background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
              }}
            >
              <div
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              />
              <div
                className="pointer-events-none absolute -bottom-14 -left-8 h-44 w-44 rounded-full"
                style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              />

              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className="inline-block rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide"
                      style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                    >
                      Grupo familiar · Home&Heart
                    </span>
                    <h1
                      className="mt-3 text-[24px] text-white"
                      style={{ fontFamily: SERIF, fontWeight: 300 }}
                    >
                      {familia.nombre}
                    </h1>
                    <p className="mt-1 text-sm text-white/60">
                      {activos} miembro{activos !== 1 ? "s" : ""} activo
                      {pendientes > 0 ? ` · ${pendientes} pendiente${pendientes !== 1 ? "s" : ""}` : ""}
                      {familia.created_at
                        ? ` · Desde ${formatFamiliaDate(familia.created_at)}`
                        : ""}
                    </p>
                  </div>
                  <span className="text-2xl" aria-hidden>
                    👨‍👩‍👧
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap items-end gap-4">
                  {miembros.map((miembro) => {
                    const perfil = miembro.profiles_public;
                    const isPending = miembro.estado === "pendiente";
                    const isAdminMember = miembro.rol === "administrador";
                    const nombre =
                      perfil
                        ? [perfil.nombre, perfil.apellido].filter(Boolean).join(" ")
                        : miembro.email_invitado || "Invitado";
                    const rolLabel = isPending
                      ? "Pendiente"
                      : isAdminMember
                        ? "Admin"
                        : "Miembro";

                    return (
                      <div key={miembro.id} className="flex flex-col items-center">
                        <MiembroAvatar
                          perfil={perfil}
                          email={miembro.email_invitado}
                          size={44}
                          bgGray={isPending}
                          borderColor={
                            isPending
                              ? undefined
                              : isAdminMember
                                ? "rgba(255,255,255,0.7)"
                                : "rgba(255,255,255,0.3)"
                          }
                        />
                        <p className="mt-1.5 max-w-[72px] truncate text-center text-[10px] font-medium text-white">
                          {nombre.split(" ")[0]}
                        </p>
                        <p className="text-[8px] text-white/40">{rolLabel}</p>
                      </div>
                    );
                  })}
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={scrollToInvite}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-lg text-white/80 transition-colors hover:bg-white/10"
                      style={{ border: "2px dashed rgba(255,255,255,0.4)" }}
                      aria-label="Invitar miembro"
                    >
                      +
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Miembros */}
            <section
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: BORDER }}
            >
              <h2 className="text-sm font-semibold text-[#1a1a1a]">Miembros</h2>
              <ul className="mt-4 flex flex-col gap-3">
                {miembros.map((miembro) => {
                  const perfil = miembro.profiles_public;
                  const isPending = miembro.estado === "pendiente";
                  const nombre =
                    perfil
                      ? [perfil.nombre, perfil.apellido].filter(Boolean).join(" ")
                      : miembro.email_invitado || "Invitado";
                  const subtitulo = isPending
                    ? `${miembro.email_invitado || "—"} · ${formatMemberDate(miembro.created_at)}`
                    : formatMemberDate(miembro.created_at);

                  return (
                    <li
                      key={miembro.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                      style={{ borderColor: BORDER }}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <MiembroAvatar
                          perfil={perfil}
                          email={miembro.email_invitado}
                          size={40}
                          bgGray={isPending}
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-[#1a1a1a]">{nombre}</p>
                            <RolBadge rol={miembro.rol} estado={miembro.estado} />
                          </div>
                          <p className="text-[11px] text-[#888]">{subtitulo}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {isAdmin && isPending && (
                          <>
                            <button
                              type="button"
                              disabled={resendingId === miembro.id}
                              onClick={() => handleResendInvite(miembro)}
                              className="text-[11px] font-medium text-[#666] underline disabled:opacity-60"
                            >
                              {resendingId === miembro.id ? "Enviando…" : "Reenviar"}
                            </button>
                            <button
                              type="button"
                              disabled={removingId === miembro.id}
                              onClick={() => handleRemoveMember(miembro.id)}
                              className="text-[11px] font-medium text-[#666] underline disabled:opacity-60"
                            >
                              Cancelar
                            </button>
                          </>
                        )}
                        {isAdmin &&
                          miembro.perfil_id !== userId &&
                          !isPending && (
                            <button
                              type="button"
                              disabled={removingId === miembro.id}
                              onClick={() => handleRemoveMember(miembro.id)}
                              className="text-[11px] font-medium text-red-600 underline disabled:opacity-60"
                            >
                              {removingId === miembro.id ? "Eliminando…" : "Eliminar"}
                            </button>
                          )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {isAdmin && (
                <form
                  id="invitar-miembros"
                  onSubmit={handleInvite}
                  className="mt-5 flex flex-col gap-2 border-t pt-5 sm:flex-row"
                  style={{ borderColor: BORDER }}
                >
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email del familiar"
                    className={inputClass}
                    style={{ borderColor: BORDER }}
                  />
                  <button
                    type="submit"
                    disabled={inviting}
                    className="shrink-0 rounded-xl px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {inviting ? "Enviando…" : "Enviar invitación →"}
                  </button>
                </form>
              )}
            </section>

            {/* Grid reservas + viajes */}
            <div className="grid gap-4 lg:grid-cols-2">
              <section
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: BORDER }}
              >
                <h2 className="text-sm font-semibold text-[#1a1a1a]">
                  Reservas del grupo
                </h2>
                {reservas.length === 0 ? (
                  <p className="mt-4 text-sm text-[#666]">
                    Aún no hay reservas del grupo.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-3">
                    {reservas.slice(0, 4).map((booking) => {
                      const service = booking.services ?? {};
                      const cliente = booking.profiles_public ?? {};
                      const reservo =
                        [cliente.nombre, cliente.apellido].filter(Boolean).join(" ") ||
                        "Miembro";
                      const vertical = service.vertical ?? "alojamiento";
                      const estado = getBookingEstado(booking);

                      return (
                        <li
                          key={booking.id}
                          className="flex gap-3 rounded-lg border p-3"
                          style={{ borderColor: BORDER }}
                        >
                          <div
                            className="h-[52px] w-16 shrink-0"
                            style={{
                              borderRadius: 7,
                              background:
                                VERTICAL_GRADIENTS[vertical] ||
                                VERTICAL_GRADIENTS.alojamiento,
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-[#1a1a1a]">
                              {service.titulo || "Servicio"}
                            </p>
                            <p className="text-[11px] text-[#888]">
                              Reservó {reservo}
                            </p>
                            <p className="text-[10px] text-[#aaa]">
                              {formatDateRange(booking.fecha_inicio, booking.fecha_fin)}
                              {" · "}
                              {formatPrice(booking.precio_total)}
                            </p>
                            <div className="mt-1.5">
                              <StatusBadge status={estado} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link
                  href="/historial"
                  className="mt-4 inline-block text-sm font-semibold no-underline"
                  style={{ color: PRIMARY }}
                >
                  Ver todas →
                </Link>
              </section>

              <section
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: BORDER }}
              >
                <h2 className="text-sm font-semibold text-[#1a1a1a]">
                  Viajes del grupo
                </h2>
                {viajes.length === 0 ? (
                  <p className="mt-4 text-sm text-[#666]">
                    Aún no hay viajes del grupo.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2">
                    {viajes.map((viaje) => {
                      const numServicios = (viaje.viaje_reservas ?? []).filter(
                        (vr) => vr.bookings,
                      ).length;
                      return (
                        <li key={viaje.id}>
                          <Link
                            href={`/viaje/${viaje.id}`}
                            className="flex items-center gap-3 rounded-lg border px-3 py-2.5 no-underline transition-colors hover:bg-[#f7f5f2]"
                            style={{ borderColor: BORDER }}
                          >
                            <span className="text-lg">{getViajeEmoji(viaje)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[#1a1a1a]">
                                {viaje.nombre}
                              </p>
                              <p className="text-[11px] text-[#888]">
                                {formatDateRange(viaje.fecha_inicio, viaje.fecha_fin)}
                                {" · "}
                                {numServicios} servicio
                                {numServicios !== 1 ? "s" : ""}
                                {" · "}
                                {activos} miembro{activos !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Link
                  href="/viaje/nuevo"
                  className="mt-4 inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline"
                  style={{ backgroundColor: GREEN }}
                >
                  + Crear nuevo viaje
                </Link>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function FamiliaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
          <MiniNavbar />
          <main className="px-6 py-16 text-center text-sm text-[#666]">Cargando…</main>
        </div>
      }
    >
      <FamiliaPageContent />
    </Suspense>
  );
}
