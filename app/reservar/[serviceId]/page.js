"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const CANCEL_LABELS = {
  "24h": "Cancelación gratuita hasta 24h antes",
  "48h": "Hasta 48h antes",
  "7d": "Hasta 7 días antes",
  none: "Sin cancelación",
};

const VERTICALS = {
  alojamiento: {
    label: "Alojamiento",
    priceSuffix: "/ noche",
    unit: "noche",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    priceSuffix: "/ hora",
    unit: "hora",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    priceSuffix: "/ día",
    unit: "día",
    Icon: PetIcon,
  },
};

function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function PersonIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function PetIcon({ className }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="7" cy="4" r="1.5" /><circle cx="12" cy="3" r="1.5" /><circle cx="17" cy="4" r="1.5" /><circle cx="4.5" cy="8.5" r="1.5" />
      <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
    </svg>
  );
}

function InfoIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.755.755 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
    </svg>
  );
}

function CheckBadgeIcon({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function formatShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(`${start}T12:00:00`);
  const b = new Date(`${end}T12:00:00`);
  const diff = b.getTime() - a.getTime();
  if (diff < 0) return 0;
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const PLATFORM_MULTIPLIER = 1.14;

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function applyClientPrice(baseSubtotal) {
  if (!baseSubtotal) return 0;
  return Math.round(baseSubtotal * PLATFORM_MULTIPLIER * 100) / 100;
}

function formatEuro(amount) {
  return `${Number(amount).toFixed(2)}€`;
}

export default function ReservarPage() {
  const router = useRouter();
  const params = useParams();
  const serviceId = params.serviceId;

  const [loading, setLoading] = useState(true);
  const [service, setService] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [perfilCliente, setPerfilCliente] = useState(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [hora, setHora] = useState("");
  const [duracionHoras, setDuracionHoras] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [successVariant, setSuccessVariant] = useState("green");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email);

      const { data: perfilClienteData } = await supabase
        .from("profiles")
        .select("nombre")
        .eq("id", user.id)
        .single();

      setPerfilCliente(perfilClienteData);

      const { data, error } = await supabase
        .from("services")
        .select(
          `
          *,
          profiles (
            nombre,
            apellido,
            ciudad,
            idiomas,
            verificado,
            location_zone
          )
        `,
        )
        .eq("id", serviceId)
        .single();

      if (error || !data) {
        setErrorMessage("No se encontró el servicio.");
        setLoading(false);
        return;
      }

      setService(data);
      setLoading(false);
    }

    load();
  }, [router, serviceId]);

  const vertical = service?.vertical ?? "alojamiento";
  const verticalConfig = VERTICALS[vertical] ?? VERTICALS.alojamiento;
  const profile = service?.profiles ?? {};
  const unitPrice = Number(service?.precio) || 0;
  const cancelLabel =
    CANCEL_LABELS[service?.cancellation_policy] ??
    service?.cancellation_policy;

  const priceSummary = useMemo(() => {
    if (!service || !unitPrice) {
      return { total: 0, detail: "Introduce las fechas para calcular el precio" };
    }

    if (vertical === "ninos") {
      const hours = Number(duracionHoras) || 0;
      if (!hours) {
        return { total: 0, detail: "Introduce la duración en horas" };
      }
      const baseSubtotal = unitPrice * hours;
      return {
        total: applyClientPrice(baseSubtotal),
        detail: `${hours} hora${hours > 1 ? "s" : ""}`,
      };
    }

    if (vertical === "alojamiento" || vertical === "mascotas") {
      const days = daysBetween(fechaInicio, fechaFin);
      if (!fechaInicio || !fechaFin || days === 0) {
        return { total: 0, detail: "Introduce fechas de inicio y fin" };
      }
      const unit = vertical === "alojamiento" ? "noche" : "día";
      const baseSubtotal = unitPrice * days;
      return {
        total: applyClientPrice(baseSubtotal),
        detail: `${days} ${unit}${days > 1 ? "s" : ""}`,
      };
    }

    return { total: 0, detail: "" };
  }, [service, unitPrice, vertical, fechaInicio, fechaFin, duracionHoras]);

  async function handleConfirm(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!userId || !service) return;

    if (priceSummary.total <= 0) {
      setErrorMessage("Completa las fechas o la duración para calcular el precio.");
      return;
    }

    setSubmitting(true);

    const isImmediate = service.reserva_inmediata === true;

    const payload = {
      cliente_id: userId,
      service_id: service.id,
      fecha_inicio: fechaInicio || null,
      fecha_fin:
        vertical === "alojamiento" || vertical === "mascotas"
          ? fechaFin || null
          : null,
      hora: vertical === "ninos" ? hora || null : null,
      duracion_horas:
        vertical === "ninos" ? Number(duracionHoras) || null : null,
      mensaje: mensaje.trim() || null,
      precio_total: priceSummary.total,
      estado: isImmediate ? "confirmada" : "pendiente",
    };

    const { error } = await supabase.from("bookings").insert(payload);

    setSubmitting(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "reserva_confirmada",
        cliente_email: userEmail,
        cliente_nombre: perfilCliente?.nombre || "Cliente",
        proveedor_email: service.profiles?.email || userEmail,
        proveedor_nombre: service.profiles?.nombre || "Proveedor",
        servicio_titulo: service.titulo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin || fechaInicio,
        precio_total: priceSummary.total.toString(),
        mensaje: mensaje || "",
      }),
    });

    if (isImmediate) {
      setSuccessVariant("green");
      setSuccessMessage(
        "¡Reserva confirmada! Recibirás los detalles por email.",
      );
    } else {
      setSuccessVariant("blue");
      setSuccessMessage(
        "¡Solicitud enviada! El proveedor confirmará tu reserva pronto.",
      );
    }

    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando servicio…
        </main>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center">
          <p className="text-sm text-red-600">{errorMessage || "Servicio no disponible."}</p>
        </main>
      </div>
    );
  }

  const { Icon } = verticalConfig;
  const zone =
    service.ciudad || profile.location_zone || profile.ciudad || "España";

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <header className="mb-8">
          <h1
            className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl"
            style={{ fontFamily: SERIF }}
          >
            Reservar servicio
          </h1>
          <p className="mt-1 text-base text-[#666]">
            {service.titulo || verticalConfig.label}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* Panel izquierdo — Resumen */}
          <aside
            className="rounded-2xl border bg-white p-6 sm:p-7"
            style={{ borderColor: BRAND.border }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold text-[#1a1a1a]">
                {formatShortName(profile.nombre, profile.apellido) || "Proveedor"}
              </p>
              {profile.verificado === true && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
                >
                  <CheckBadgeIcon className="h-3.5 w-3.5" />
                  Verificado
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-[#888]">{zone}</p>

            <div
              className="mt-6 flex items-center gap-3 border-t pt-6"
              style={{ borderColor: BRAND.border }}
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#888]">
                  {verticalConfig.label}
                </p>
                <p className="text-2xl font-bold" style={{ color: BRAND.primary }}>
                  {unitPrice ? `${unitPrice}€${verticalConfig.priceSuffix}` : "Consultar"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex gap-3 rounded-xl bg-[#fef9c3] px-4 py-3">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#ca8a04]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#92400e]">
                  Política de cancelación
                </p>
                <p className="mt-0.5 text-sm text-[#854d0e]">{cancelLabel}</p>
              </div>
            </div>
          </aside>

          {/* Panel derecho — Formulario */}
          <form
            onSubmit={handleConfirm}
            className="rounded-2xl border bg-white p-6 sm:p-7"
            style={{ borderColor: BRAND.border }}
          >
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Detalles de la reserva</h2>

            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label htmlFor="fecha-inicio" className="mb-1.5 block text-xs font-medium text-[#444]">
                  Fecha de inicio
                </label>
                <input
                  id="fecha-inicio"
                  type="date"
                  required
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  onInput={(e) => setFechaInicio(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              {(vertical === "alojamiento" || vertical === "mascotas") && (
                <div>
                  <label htmlFor="fecha-fin" className="mb-1.5 block text-xs font-medium text-[#444]">
                    Fecha de fin
                  </label>
                  <input
                    id="fecha-fin"
                    type="date"
                    required
                    min={fechaInicio || undefined}
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    onInput={(e) => setFechaFin(e.target.value)}
                    className={inputClass}
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              )}

              {vertical === "ninos" && (
                <>
                  <div>
                    <label htmlFor="hora" className="mb-1.5 block text-xs font-medium text-[#444]">
                      Hora
                    </label>
                    <input
                      id="hora"
                      type="time"
                      required
                      value={hora}
                      onChange={(e) => setHora(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                  <div>
                    <label htmlFor="duracion" className="mb-1.5 block text-xs font-medium text-[#444]">
                      Duración (horas)
                    </label>
                    <input
                      id="duracion"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={duracionHoras}
                      onChange={(e) => setDuracionHoras(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                </>
              )}

              <div>
                <label htmlFor="mensaje" className="mb-1.5 block text-xs font-medium text-[#444]">
                  Cuéntale algo al proveedor (opcional)
                </label>
                <textarea
                  id="mensaje"
                  rows={4}
                  value={mensaje}
                  onChange={(e) => setMensaje(e.target.value)}
                  className={`${inputClass} resize-y`}
                  style={{ borderColor: BRAND.border }}
                />
              </div>
            </div>

            <div
              className="mt-6 rounded-xl px-4 py-4"
              style={{ backgroundColor: BRAND.light }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-[#666]">
                Resumen del precio
              </p>
              <p className="mt-1 text-sm text-[#444]">{priceSummary.detail}</p>
              <p className="mt-2 text-2xl font-bold" style={{ color: BRAND.primary }}>
                {priceSummary.total > 0 ? formatEuro(priceSummary.total) : "—"}
              </p>
              {priceSummary.total > 0 && (
                <p className="mt-1 text-xs text-[#888]">
                  Gastos de gestión incluidos
                </p>
              )}
            </div>

            {successMessage && (
              <p
                className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  successVariant === "blue"
                    ? "bg-[#e8f0fb] text-[#1d4f91]"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {successMessage}
              </p>
            )}
            {errorMessage && (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}

            {service.reserva_inmediata ? (
              <span className="mt-6 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Reserva inmediata ⚡
              </span>
            ) : (
              <span className="mt-6 inline-flex rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800">
                Requiere confirmación 🕐
              </span>
            )}

            <button
              type="submit"
              disabled={submitting || !!successMessage}
              className="mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: BRAND.primary }}
            >
              {submitting ? "Enviando…" : "Confirmar reserva"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
