"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { applyBestDiscountToBase } from "@/app/lib/descuentosDuracion";
import { getUserFamiliaActiva } from "@/app/lib/familia";
import { getHoyDateStr, getPrecioEfectivo, isOfertaActiva } from "@/app/lib/ofertas";
import { supabase } from "@/lib/supabase";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

const CANCEL_POLICIES = {
  flexible: {
    name: "Flexible",
    description:
      "Cancelación gratuita hasta 24h antes · 50% de reembolso dentro de las 24h previas",
    tiers: [
      { label: "Más de 24h antes del inicio", percent: 100 },
      { label: "Menos de 24h antes del inicio", percent: 50 },
      { label: "Tras el inicio del servicio", percent: 0 },
    ],
  },
  moderada: {
    name: "Moderada",
    description:
      "Cancelación gratuita hasta 3 días antes · 50% entre 3 días y 24h antes",
    tiers: [
      { label: "Más de 3 días antes del inicio", percent: 100 },
      { label: "Entre 3 días y 24h antes del inicio", percent: 50 },
      { label: "Menos de 24h antes o tras el inicio", percent: 0 },
    ],
  },
  estricta: {
    name: "Estricta",
    description:
      "Cancelación gratuita hasta 7 días antes · 50% entre 7 y 3 días antes",
    tiers: [
      { label: "Más de 7 días antes del inicio", percent: 100 },
      { label: "Entre 7 y 3 días antes del inicio", percent: 50 },
      { label: "Menos de 3 días antes o tras el inicio", percent: 0 },
    ],
  },
};

const LEGACY_CANCEL_POLICIES = {
  "24h": "flexible",
  "48h": "moderada",
  "7d": "estricta",
};

function normalizeCancelPolicy(policy) {
  return LEGACY_CANCEL_POLICIES[policy] ?? policy;
}

function getCancelPolicy(policyKey) {
  const key = normalizeCancelPolicy(policyKey);
  return CANCEL_POLICIES[key];
}

function getServiceStartDateTime(vertical, fechaInicio, hora) {
  if (!fechaInicio) return null;
  if (vertical === "ninos" && !hora) return null;
  const [y, m, d] = fechaInicio.split("-").map(Number);
  if (vertical === "ninos") {
    const [hh, mm] = hora.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function validateBookingDates(vertical, fechaInicio, hora) {
  if (!fechaInicio) return null;

  const hoyStr = new Date().toISOString().split("T")[0];
  if (fechaInicio < hoyStr) {
    return "La fecha de inicio no puede ser en el pasado";
  }

  if (hora) {
    const ahora = new Date();
    const hoyStrLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    if (fechaInicio === hoyStrLocal) {
      const [h, m] = hora.split(":").map(Number);
      const horaSeleccionada = h * 60 + m;
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      if (horaSeleccionada <= horaActual) {
        return `La hora ${hora} ya ha pasado. Por favor elige una hora futura.`;
      }
    }
  }

  return null;
}

/** Porcentaje de reembolso (0–100) si se cancela en cancelAt. */
function getRefundPercent(policy, cancelAt, serviceStartAt) {
  if (!serviceStartAt || cancelAt >= serviceStartAt) return 0;

  const policyKey = normalizeCancelPolicy(policy);
  if (policyKey === "none") return 0;

  const hoursUntil =
    (serviceStartAt.getTime() - cancelAt.getTime()) / (1000 * 60 * 60);
  const daysUntil = hoursUntil / 24;

  switch (policyKey) {
    case "flexible":
      if (hoursUntil > 24) return 100;
      return 50;
    case "moderada":
      if (daysUntil > 3) return 100;
      if (hoursUntil > 24) return 50;
      return 0;
    case "estricta":
      if (daysUntil > 7) return 100;
      if (daysUntil > 3) return 50;
      return 0;
    default:
      return 0;
  }
}

const VERTICALS = {
  alojamiento: {
    label: "Alojamiento",
    priceSuffix: "/ noche",
    unit: "noche",
    color: "#1d4f91",
    light: "#e8f0fb",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    priceSuffix: "/ hora",
    unit: "hora",
    color: "#0e7a5c",
    light: "#e6f4f0",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    priceSuffix: "/ día",
    unit: "día",
    color: "#c47d1a",
    light: "#fdf3e3",
    Icon: PetIcon,
  },
};

const COMPLEMENTARY_VERTICALS = {
  alojamiento: ["ninos", "mascotas"],
  ninos: ["alojamiento", "mascotas"],
  mascotas: ["alojamiento", "ninos"],
};

function HomeIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function PersonIcon({ className, style }) {
  return (
    <svg className={className} style={style} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
    </svg>
  );
}

function PetIcon({ className, style }) {
  return (
    <svg className={className} style={style} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

function getEstanciaUnit(vertical, count) {
  const n = Number(count);
  if (vertical === "alojamiento") return n === 1 ? "noche" : "noches";
  if (vertical === "ninos") return n === 1 ? "hora" : "horas";
  return n === 1 ? "día" : "días";
}

function getServiceDuration(svc, { fechaInicio, fechaFin, duracionHoras, mainVertical }) {
  if (svc.vertical === "ninos") {
    let hours = Number(duracionHoras) || 0;
    if (!hours && mainVertical !== "ninos") {
      const days = daysBetween(fechaInicio, fechaFin || fechaInicio);
      hours = days > 0 ? days : 0;
    }
    return hours;
  }
  return daysBetween(fechaInicio, fechaFin || fechaInicio);
}

function validateEstancia(svc, duration) {
  if (!duration) return null;

  const min =
    svc.estancia_minima != null && svc.estancia_minima !== ""
      ? Number(svc.estancia_minima)
      : null;
  const max =
    svc.estancia_maxima != null && svc.estancia_maxima !== ""
      ? Number(svc.estancia_maxima)
      : null;

  if (min != null && min > 0 && duration < min) {
    return `Este servicio requiere un mínimo de ${min} ${getEstanciaUnit(svc.vertical, min)}`;
  }
  if (max != null && max > 0 && duration > max) {
    return `Este servicio tiene un máximo de ${max} ${getEstanciaUnit(svc.vertical, max)}`;
  }
  return null;
}

function formatEstanciaInfo(vertical, minima, maxima) {
  const parts = [];
  if (minima != null && minima !== "" && Number(minima) > 0) {
    const n = Number(minima);
    parts.push(`Mínimo ${n} ${getEstanciaUnit(vertical, n)}`);
  }
  if (maxima != null && maxima !== "" && Number(maxima) > 0) {
    const n = Number(maxima);
    parts.push(`Máximo ${n} ${getEstanciaUnit(vertical, n)}`);
  }
  return parts;
}

function formatAntelacionLabel(hours) {
  const h = Number(hours);
  if (h >= 24 && h % 24 === 0) {
    const days = h / 24;
    return days === 1 ? "1 día" : `${days} días`;
  }
  return h === 1 ? "1 hora" : `${h} horas`;
}

function validateAntelacion(svc, fechaInicio, hora, mainVertical) {
  const required =
    svc.antelacion_minima != null && svc.antelacion_minima !== ""
      ? Number(svc.antelacion_minima)
      : 24;
  if (!required || !fechaInicio) return null;

  const v = svc.vertical || mainVertical;
  const start = getServiceStartDateTime(v, fechaInicio, hora);
  if (!start) return null;

  const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  if (hoursUntil < required) {
    return `Este servicio requiere reservar con al menos ${formatAntelacionLabel(required)} de antelación`;
  }
  return null;
}

function formatAntelacionInfo(antelacionMinima) {
  const h =
    antelacionMinima != null && antelacionMinima !== ""
      ? Number(antelacionMinima)
      : 24;
  if (!h) return null;
  return `Reservar con al menos ${formatAntelacionLabel(h)} de antelación`;
}

const DIAS_SEMANA_META = [
  { id: "lun", label: "Lun", nombre: "lunes", jsDay: 1 },
  { id: "mar", label: "Mar", nombre: "martes", jsDay: 2 },
  { id: "mie", label: "Mié", nombre: "miércoles", jsDay: 3 },
  { id: "jue", label: "Jue", nombre: "jueves", jsDay: 4 },
  { id: "vie", label: "Vie", nombre: "viernes", jsDay: 5 },
  { id: "sab", label: "Sáb", nombre: "sábados", jsDay: 6 },
  { id: "dom", label: "Dom", nombre: "domingos", jsDay: 0 },
];

const DIAS_DISPONIBLES_DEFAULT = DIAS_SEMANA_META.map((d) => d.id);

function normalizeDiasDisponibles(dias) {
  if (!Array.isArray(dias) || dias.length === 0) return DIAS_DISPONIBLES_DEFAULT;
  return dias;
}

function getDiaIdFromFecha(fechaStr) {
  if (!fechaStr) return null;
  const [y, m, d] = fechaStr.split("-").map(Number);
  const jsDay = new Date(y, m - 1, d).getDay();
  return DIAS_SEMANA_META.find((dia) => dia.jsDay === jsDay)?.id ?? null;
}

function isFechaEnDiasDisponibles(fechaStr, diasDisponibles) {
  const diaId = getDiaIdFromFecha(fechaStr);
  if (!diaId) return true;
  return normalizeDiasDisponibles(diasDisponibles).includes(diaId);
}

function getDiaDisponibleError(fechaStr, diasDisponibles) {
  const diaId = getDiaIdFromFecha(fechaStr);
  const nombre =
    DIAS_SEMANA_META.find((d) => d.id === diaId)?.nombre ?? "ese día";
  return `Este proveedor no está disponible los ${nombre}. Por favor elige otra fecha.`;
}

function validateDiaDisponible(svc, fechaInicio) {
  if (!fechaInicio) return null;
  const disponibles = normalizeDiasDisponibles(svc.dias_disponibles);
  if (isFechaEnDiasDisponibles(fechaInicio, disponibles)) return null;
  return getDiaDisponibleError(fechaInicio, disponibles);
}

async function verificarDisponibilidad(serviceId, fechaInicio, fechaFin) {
  const fin = fechaFin || fechaInicio;
  const { data } = await supabase
    .from("disponibilidad")
    .select("id")
    .eq("service_id", serviceId)
    .lte("fecha_inicio", fin)
    .gte("fecha_fin", fechaInicio);

  return (data?.length ?? 0) === 0;
}

function FechaInicioConDias({
  id,
  value,
  onChange,
  min,
  diasDisponibles,
  onValidationError,
  inputClass,
  borderColor,
}) {
  const inputRef = useRef(null);
  const disponibles = normalizeDiasDisponibles(diasDisponibles);
  const diasLabel = DIAS_SEMANA_META.filter((d) => disponibles.includes(d.id))
    .map((d) => d.label)
    .join(", ");

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (value && !isFechaEnDiasDisponibles(value, disponibles)) {
      el.setCustomValidity(getDiaDisponibleError(value, disponibles));
    } else {
      el.setCustomValidity("");
    }
  }, [value, disponibles]);

  function handleChange(e) {
    const next = e.target.value;
    if (!next) {
      e.target.setCustomValidity("");
      onValidationError("");
      onChange("");
      return;
    }
    if (!isFechaEnDiasDisponibles(next, disponibles)) {
      const err = getDiaDisponibleError(next, disponibles);
      e.target.setCustomValidity(err);
      onValidationError(err);
      return;
    }
    e.target.setCustomValidity("");
    onValidationError("");
    onChange(next);
  }

  return (
    <input
      ref={inputRef}
      id={id}
      type="date"
      required
      min={min}
      value={value}
      onChange={handleChange}
      onInput={handleChange}
      title={
        diasLabel
          ? `Solo puedes reservar en: ${diasLabel}`
          : "Selecciona una fecha disponible"
      }
      className={inputClass}
      style={{ borderColor }}
    />
  );
}

const PLATFORM_MULTIPLIER = 1.14;
const COMMISSION_RATE = 0.14;

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function applyClientPrice(baseSubtotal) {
  if (!baseSubtotal) return 0;
  return Math.round(baseSubtotal * PLATFORM_MULTIPLIER * 100) / 100;
}

function formatEuro(amount) {
  return `${Number(amount).toFixed(2)}€`;
}

function getCardBrandLabel(brand) {
  const labels = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
  };
  return labels[brand] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Tarjeta");
}

function calculateServiceBasePrice(
  svc,
  { fechaInicio, fechaFin, duracionHoras, mainVertical },
  unitPriceOverride = null,
) {
  const useOverride =
    unitPriceOverride != null && Number(unitPriceOverride) > 0;
  const unitPrice = useOverride
    ? Number(unitPriceOverride)
    : Number(svc.precio) || 0;
  if (!unitPrice) return { base: 0, detail: "", ready: false, discountPct: 0, discountSource: null };

  const v = svc.vertical;
  const dateContext = { fechaInicio, fechaFin, duracionHoras, mainVertical };

  function finalizeBase(subtotal, detail, ready, duration) {
    if (useOverride) {
      return {
        base: subtotal,
        detail,
        ready,
        discountPct: 0,
        discountSource: null,
      };
    }
    const { total, pct, source } = applyBestDiscountToBase(
      subtotal,
      svc,
      duration,
    );
    return {
      base: total,
      detail,
      ready,
      discountPct: pct,
      discountSource: source,
    };
  }

  if (v === "ninos") {
    let hours = Number(duracionHoras) || 0;
    if (!hours && mainVertical !== "ninos") {
      const days = daysBetween(fechaInicio, fechaFin || fechaInicio);
      hours = days > 0 ? days : 0;
    }
    if (!hours) {
      return {
        base: 0,
        detail: "Introduce la duración en horas",
        ready: false,
        discountPct: 0,
        discountSource: null,
      };
    }
    const subtotal = unitPrice * hours;
    const duration = getServiceDuration(svc, dateContext);
    return finalizeBase(
      subtotal,
      `${hours} hora${hours > 1 ? "s" : ""}`,
      true,
      duration,
    );
  }

  const start = fechaInicio;
  const end = fechaFin || fechaInicio;
  const days = daysBetween(start, end);
  if (!start || days === 0) {
    return {
      base: 0,
      detail: "Introduce fechas de inicio y fin",
      ready: false,
      discountPct: 0,
      discountSource: null,
    };
  }
  const unit = v === "alojamiento" ? "noche" : "día";
  const subtotal = unitPrice * days;
  const duration = getServiceDuration(svc, dateContext);
  return finalizeBase(
    subtotal,
    `${days} ${unit}${days > 1 ? "s" : ""}`,
    true,
    duration,
  );
}

// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS familia_id uuid REFERENCES familias(id);

function buildBookingPayload({
  svc,
  userId,
  fechaInicio,
  fechaFin,
  hora,
  duracionHoras,
  mensaje,
  precioTotal,
  grupoReserva,
  paymentIntentId,
  familiaId = null,
}) {
  const v = svc.vertical;
  const isImmediate = svc.reserva_inmediata === true;

  return {
    cliente_id: userId,
    service_id: svc.id,
    fecha_inicio: fechaInicio || null,
    fecha_fin: v === "alojamiento" || v === "mascotas" ? fechaFin || fechaInicio || null : null,
    hora: v === "ninos" ? hora || null : null,
    duracion_horas: v === "ninos" ? Number(duracionHoras) || null : null,
    mensaje: mensaje.trim() || null,
    precio_total: precioTotal,
    estado: isImmediate ? "confirmada" : "pendiente",
    grupo_reserva: grupoReserva,
    // -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_intent_id text;
    payment_intent_id: paymentIntentId,
    familia_id: familiaId,
  };
}

function SavedCardCheckout({
  precioTotal,
  paymentMethod,
  stripeCustomerId,
  userId,
  metadata,
  onPaymentSuccess,
  onUseNewCard,
  getBookingDateError,
  disabled,
}) {
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handlePayWithSaved() {
    setPaying(true);
    setError("");

    const dateError = getBookingDateError?.();
    if (dateError) {
      setError(dateError);
      setPaying(false);
      return;
    }

    try {
      const intentRes = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: precioTotal,
          customer: stripeCustomerId,
          payment_method: paymentMethod.id,
          confirm_saved: true,
          metadata: {
            service_id: String(metadata.service_id),
            cliente_id: String(metadata.cliente_id),
            grupo_reserva: String(metadata.grupo_reserva),
          },
        }),
      });
      const intentData = await intentRes.json();

      if (!intentRes.ok || intentData.error) {
        throw new Error(intentData.error || "No se pudo procesar el pago.");
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe no está disponible.");
      }

      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(intentData.clientSecret, {
          payment_method: paymentMethod.id,
        });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      await onPaymentSuccess(
        paymentIntent?.id || intentData.paymentIntentId,
      );
    } catch (err) {
      setError(err.message || "Error al procesar el pago.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mt-6">
      <div
        className="rounded-xl border px-4 py-4"
        style={{ borderColor: BRAND.border, backgroundColor: BRAND.light }}
      >
        <p className="text-sm font-semibold text-[#1a1a1a]">
          {getCardBrandLabel(paymentMethod.card?.brand)} ····{" "}
          {paymentMethod.card?.last4}
        </p>
      </div>
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={paying || disabled}
        onClick={handlePayWithSaved}
        className="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: BRAND.primary }}
      >
        {paying ? "Procesando pago…" : "Pagar con esta tarjeta"}
      </button>
      <button
        type="button"
        onClick={onUseNewCard}
        className="mt-3 w-full text-center text-sm font-medium no-underline hover:underline"
        style={{ color: BRAND.primary }}
      >
        Usar otra tarjeta
      </button>
    </div>
  );
}

function CheckoutForm({
  precioTotal,
  paymentIntentId,
  metadata,
  stripeCustomerId,
  userId,
  userEmail,
  clienteNombre,
  onPaymentSuccess,
  vertical,
  fechaInicio,
  hora,
  setErrorMessage,
  service,
  disabled,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    console.log(
      "handleSubmit - vertical:",
      vertical,
      "fechaInicio:",
      fechaInicio,
      "hora:",
      hora,
    );

    if (service?.vertical === "ninos") {
      if (!hora || hora.trim() === "") {
        setErrorMessage("Por favor selecciona una hora válida");
        return;
      }
      const hoyStr = new Date().toISOString().split("T")[0];
      if (fechaInicio === hoyStr) {
        const [h, m] = hora.split(":").map(Number);
        const minutosSeleccionados = h * 60 + m;
        const ahora = new Date();
        const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
        if (minutosSeleccionados <= minutosActuales) {
          setErrorMessage(`La hora ${hora} ya ha pasado. Elige una hora futura.`);
          return;
        }
      }
    }

    const dateError = validateBookingDates(vertical, fechaInicio, hora);
    if (dateError) {
      setErrorMessage(dateError);
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicioDate = new Date(fechaInicio);

    if (fechaInicioDate < hoy) {
      setErrorMessage("La fecha de inicio no puede ser en el pasado");
      return;
    }

    if (service?.vertical === "ninos" && hora && fechaInicio) {
      const hoyStr = new Date().toISOString().split("T")[0];
      if (fechaInicio === hoyStr) {
        const [horas, minutos] = hora.split(":").map(Number);
        const horaSeleccionada = new Date();
        horaSeleccionada.setHours(horas, minutos, 0, 0);
        const horaMinima = new Date();
        horaMinima.setHours(
          horaMinima.getHours() + 1,
          horaMinima.getMinutes(),
          0,
          0,
        );
        if (horaSeleccionada <= horaMinima) {
          setErrorMessage(
            `La hora debe ser al menos 1 hora desde ahora. Hora minima: ${String(horaMinima.getHours()).padStart(2, "0")}:${String(horaMinima.getMinutes()).padStart(2, "0")}`,
          );
          return;
        }
      }
    }

    if (!stripe || !elements) return;

    setPaying(true);
    setErrorMessage("");

    const intentRes = await fetch("/api/stripe/create-payment-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: precioTotal,
        metadata: {
          service_id: String(metadata.service_id),
          cliente_id: String(metadata.cliente_id),
          grupo_reserva: String(metadata.grupo_reserva),
        },
      }),
    });
    const intentData = await intentRes.json();

    if (!intentRes.ok || intentData.error) {
      setPaying(false);
      setErrorMessage(intentData.error || "No se pudo iniciar el pago.");
      return;
    }

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setPaying(false);
      setErrorMessage(confirmError.message);
      return;
    }

    const confirmedId = paymentIntent?.id || paymentIntentId;
    const paymentMethodId =
      typeof paymentIntent?.payment_method === "string"
        ? paymentIntent.payment_method
        : paymentIntent?.payment_method?.id;

    try {
      await onPaymentSuccess(confirmedId);

      let customerId = stripeCustomerId;
      if (!customerId) {
        const customerRes = await fetch("/api/stripe/customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userEmail,
            nombre: clienteNombre || "Cliente",
          }),
        });
        const customerData = await customerRes.json();
        if (customerRes.ok && customerData.customer_id) {
          customerId = customerData.customer_id;
        }
      }

      if (paymentMethodId && customerId) {
        await fetch("/api/stripe/customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attach",
            payment_method_id: paymentMethodId,
            customer_id: customerId,
          }),
        });

        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar la reserva.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <PaymentElement />
      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={!stripe || paying || disabled}
        className="mt-4 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: BRAND.primary }}
      >
        {paying ? "Procesando pago…" : `Pagar ${precioTotal.toFixed(2)}€`}
      </button>
    </form>
  );
}

export default function ReservarPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const serviceId = params.serviceId;
  const precioEspecialParam = searchParams.get("precio_especial");
  const validaHastaParam = searchParams.get("valida_hasta");

  const [loading, setLoading] = useState(true);
  const [service, setService] = useState(null);
  const [complementaryServices, setComplementaryServices] = useState([]);
  const [bundleIds, setBundleIds] = useState([]);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [perfilCliente, setPerfilCliente] = useState(null);
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [hora, setHora] = useState("");
  const [duracionHoras, setDuracionHoras] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [successVariant, setSuccessVariant] = useState("green");
  const [errorMessage, setErrorMessage] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [grupoReserva, setGrupoReserva] = useState(null);
  const [paymentIntentLoading, setPaymentIntentLoading] = useState(false);
  const [stripeCustomerId, setStripeCustomerId] = useState(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [useNewCard, setUseNewCard] = useState(false);
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [familiaInfo, setFamiliaInfo] = useState(null);
  const [reservarComoFamilia, setReservarComoFamilia] = useState(false);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [disponibilidadChecking, setDisponibilidadChecking] = useState(false);
  const [calendarioError, setCalendarioError] = useState("");

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
        .select("nombre, apellido, stripe_customer_id")
        .eq("id", user.id)
        .single();

      setPerfilCliente(perfilClienteData);

      const familiaActiva = await getUserFamiliaActiva(supabase, user.id);
      if (familiaActiva) {
        setFamiliaInfo(familiaActiva.familia);
      }

      setPaymentMethodsLoading(true);
      try {
        const nombre = [perfilClienteData?.nombre, perfilClienteData?.apellido]
          .filter(Boolean)
          .join(" ");
        const customerRes = await fetch("/api/stripe/customer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            nombre: nombre || "Cliente",
            customer_id: perfilClienteData?.stripe_customer_id || undefined,
          }),
        });
        const customerData = await customerRes.json();

        if (customerRes.ok && customerData.customer_id) {
          setStripeCustomerId(customerData.customer_id);
          setSavedPaymentMethods(customerData.paymentMethods ?? []);
          setSelectedPaymentMethod(customerData.paymentMethods?.[0] ?? null);
          setUseNewCard(!(customerData.paymentMethods?.length > 0));

          if (customerData.customer_id !== perfilClienteData?.stripe_customer_id) {
            await supabase
              .from("profiles")
              .update({ stripe_customer_id: customerData.customer_id })
              .eq("id", user.id);
          }
        }
      } catch {
        setSavedPaymentMethods([]);
        setUseNewCard(true);
      } finally {
        setPaymentMethodsLoading(false);
      }

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

      const complementaryVerticals =
        COMPLEMENTARY_VERTICALS[data.vertical] ?? [];
      const city = data.ciudad?.trim();

      if (city && complementaryVerticals.length > 0) {
        const suggestions = [];

        for (const compVertical of complementaryVerticals) {
          const { data: compData } = await supabase
            .from("services")
            .select(
              `
              id,
              titulo,
              vertical,
              precio,
              estancia_minima,
              estancia_maxima,
              antelacion_minima,
              dias_disponibles,
              reserva_inmediata,
              ciudad,
              proveedor_id,
              direccion_exacta,
              telefono_contacto,
              modalidad,
              oferta_descuento,
              oferta_valida_hasta,
              descuentos_duracion,
              profiles (
                nombre,
                apellido
              )
            `,
            )
            .eq("disponible", true)
            .eq("vertical", compVertical)
            .ilike("ciudad", `%${city}%`)
            .neq("proveedor_id", data.proveedor_id)
            .limit(3);

          if (compData?.length) {
            suggestions.push(...compData);
          }
        }

        setComplementaryServices(suggestions);
      }

      setLoading(false);
    }

    load();
  }, [router, serviceId]);

  const vertical = service?.vertical ?? "alojamiento";
  const verticalConfig = VERTICALS[vertical] ?? VERTICALS.alojamiento;

  const getMinHora = () => {
    if (!fechaInicio) return undefined;
    const hoy = new Date().toISOString().split("T")[0];
    if (fechaInicio === hoy) {
      const ahora = new Date();
      ahora.setHours(ahora.getHours() + 1);
      return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
    }
    return undefined;
  };
  const profile = service?.profiles ?? {};
  const unitPrice = Number(service?.precio) || 0;
  const precioEspecialChat = useMemo(() => {
    const precio = Number(precioEspecialParam);
    if (!precio || precio <= 0 || !validaHastaParam) return null;
    if (validaHastaParam < getHoyDateStr()) return null;
    return precio;
  }, [precioEspecialParam, validaHastaParam]);
  const precioEfectivo = service ? getPrecioEfectivo(service) : 0;
  const ofertaActiva =
    service && !precioEspecialChat ? isOfertaActiva(service) : false;
  const cancelPolicy = getCancelPolicy(service?.cancellation_policy);

  const serviceStartAt = useMemo(
    () => getServiceStartDateTime(vertical, fechaInicio, hora),
    [vertical, fechaInicio, hora],
  );

  const refundPercentNow = useMemo(() => {
    if (!serviceStartAt) return null;
    return getRefundPercent(
      service?.cancellation_policy,
      new Date(),
      serviceStartAt,
    );
  }, [service?.cancellation_policy, serviceStartAt]);

  const bundleServices = useMemo(
    () => complementaryServices.filter((s) => bundleIds.includes(s.id)),
    [complementaryServices, bundleIds],
  );

  const selectedServices = useMemo(
    () => (service ? [service, ...bundleServices] : []),
    [service, bundleServices],
  );

  useEffect(() => {
    if (!fechaInicio || !service || selectedServices.length === 0) {
      setCalendarioError("");
      setDisponibilidadChecking(false);
      return;
    }

    const fin = fechaFin || fechaInicio;
    let cancelled = false;
    setDisponibilidadChecking(true);

    async function checkDisponibilidad() {
      const results = await Promise.all(
        selectedServices.map((svc) =>
          verificarDisponibilidad(svc.id, fechaInicio, fin),
        ),
      );

      if (cancelled) return;

      const todasDisponibles = results.every(Boolean);
      setCalendarioError(
        todasDisponibles
          ? ""
          : "Este proveedor ya tiene una reserva en esas fechas. Por favor elige otras fechas.",
      );
      setDisponibilidadChecking(false);
    }

    checkDisponibilidad();
    return () => {
      cancelled = true;
    };
  }, [fechaInicio, fechaFin, service, selectedServices]);

  const priceSummary = useMemo(() => {
    if (!service) {
      return {
        lines: [],
        subtotal: 0,
        commission: 0,
        total: 0,
        ready: false,
        detail: "Introduce las fechas para calcular el precio",
      };
    }

    const dateContext = { fechaInicio, fechaFin, duracionHoras, mainVertical: vertical };
    const lines = selectedServices.map((svc) => {
      const unitOverride =
        svc.id === service.id ? precioEspecialChat : null;
      const calc = calculateServiceBasePrice(svc, dateContext, unitOverride);
      let ready = calc.ready;
      let detail = calc.detail;

      if (fechaInicio) {
        const diaError = validateDiaDisponible(svc, fechaInicio);
        if (diaError) {
          ready = false;
          detail = diaError;
        }
      }

      if (calc.ready && ready) {
        const duration = getServiceDuration(svc, dateContext);
        const estanciaError = validateEstancia(svc, duration);
        if (estanciaError) {
          ready = false;
          detail = estanciaError;
        } else {
          const antelacionError = validateAntelacion(
            svc,
            fechaInicio,
            hora,
            vertical,
          );
          if (antelacionError) {
            ready = false;
            detail = antelacionError;
          }
        }
      }
      const svcConfig = VERTICALS[svc.vertical] ?? VERTICALS.alojamiento;
      const name =
        svc.titulo ||
        `${svcConfig.label} · ${formatShortName(svc.profiles?.nombre, svc.profiles?.apellido)}`;
      return {
        id: svc.id,
        name,
        base: calc.base,
        total: applyClientPrice(calc.base),
        detail,
        ready,
        vertical: svc.vertical,
        discountPct: calc.discountPct ?? 0,
        discountSource: calc.discountSource ?? null,
      };
    });

    const failedLine = lines.find((line) => !line.ready);
    if (failedLine) {
      return {
        lines,
        subtotal: 0,
        commission: 0,
        total: 0,
        ready: false,
        detail: failedLine.detail || "Introduce las fechas para calcular el precio",
      };
    }

    const subtotal = lines.reduce((sum, line) => sum + line.base, 0);
    const commission = Math.round(subtotal * COMMISSION_RATE * 100) / 100;
    const total = Math.round((subtotal + commission) * 100) / 100;

    return {
      lines,
      subtotal,
      commission,
      total,
      ready: true,
      detail: lines[0]?.detail || "",
    };
  }, [
    service,
    selectedServices,
    vertical,
    fechaInicio,
    fechaFin,
    duracionHoras,
    precioEspecialChat,
  ]);

  const precioListo =
    priceSummary.ready && !calendarioError && !disponibilidadChecking;
  const precioTotal = precioListo ? priceSummary.total : 0;
  const precioDetail =
    calendarioError ||
    (disponibilidadChecking
      ? "Comprobando disponibilidad…"
      : priceSummary.detail);

  const paymentMetadata = useMemo(() => {
    if (!userId || !serviceId || !grupoReserva) return null;
    return {
      service_id: serviceId,
      cliente_id: userId,
      grupo_reserva: grupoReserva,
    };
  }, [userId, serviceId, grupoReserva]);

  useEffect(() => {
    if (precioTotal <= 0 || !userId || !serviceId) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setGrupoReserva(null);
      return;
    }

    const dateError = validateBookingDates(vertical, fechaInicio, hora);
    if (dateError) {
      setErrorMessage(dateError);
      setClientSecret(null);
      setPaymentIntentId(null);
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    if (calendarioError || disponibilidadChecking) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    const grupo = crypto.randomUUID();
    setGrupoReserva(grupo);

    if (savedPaymentMethods.length > 0 && !useNewCard) {
      setClientSecret(null);
      setPaymentIntentId(null);
      setPaymentIntentLoading(false);
      return;
    }

    let cancelled = false;
    setPaymentIntentLoading(true);
    setClientSecret(null);
    setPaymentIntentId(null);

    async function createIntent() {
      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: precioTotal,
            customer: stripeCustomerId || undefined,
            metadata: {
              service_id: String(serviceId),
              cliente_id: String(userId),
              grupo_reserva: grupo,
            },
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok || data.error) {
          setClientSecret(null);
          setPaymentIntentId(null);
          setErrorMessage(data.error || "No se pudo preparar el pago.");
          return;
        }
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      } finally {
        if (!cancelled) setPaymentIntentLoading(false);
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
  }, [
    precioTotal,
    userId,
    serviceId,
    useNewCard,
    savedPaymentMethods.length,
    stripeCustomerId,
    vertical,
    fechaInicio,
    hora,
    calendarioError,
    disponibilidadChecking,
  ]);

  const completeBooking = useCallback(
    async (confirmedPaymentIntentId) => {
      if (!userId || !service || !grupoReserva) {
        throw new Error("Datos de reserva incompletos.");
      }

      if (!precioListo || priceSummary.total <= 0) {
        throw new Error("Completa las fechas o la duración para calcular el precio.");
      }

      const dateContext = {
        fechaInicio,
        fechaFin,
        duracionHoras,
        mainVertical: vertical,
      };

      const bookingRows = selectedServices.map((svc) => {
        const calc = calculateServiceBasePrice(svc, dateContext);
        return buildBookingPayload({
          svc,
          userId,
          fechaInicio,
          fechaFin,
          hora,
          duracionHoras,
          mensaje,
          precioTotal: applyClientPrice(calc.base),
          grupoReserva,
          paymentIntentId: confirmedPaymentIntentId,
          familiaId:
            reservarComoFamilia && familiaInfo?.id ? familiaInfo.id : null,
        });
      });

      const fin = fechaFin || fechaInicio;
      const disponibilidadChecks = await Promise.all(
        selectedServices.map((svc) =>
          verificarDisponibilidad(svc.id, fechaInicio, fin),
        ),
      );
      if (!disponibilidadChecks.every(Boolean)) {
        throw new Error(
          "Este proveedor ya tiene una reserva en esas fechas. Por favor elige otras fechas.",
        );
      }

      const { data: insertedBookings, error } = await supabase
        .from("bookings")
        .insert(bookingRows)
        .select("id, service_id");

      if (error) {
        throw new Error(error.message);
      }

      if (insertedBookings?.length) {
        await supabase.from("disponibilidad").insert(
          insertedBookings.map((booking) => ({
            service_id: booking.service_id,
            fecha_inicio: fechaInicio,
            fecha_fin: fin,
            booking_id: booking.id,
          })),
        );
      }

      const { data: proveedorProfile } = await supabase
        .from("profiles")
        .select("email_contacto, nombre")
        .eq("id", service.proveedor_id)
        .single();

      const mainBooking =
        insertedBookings?.find((b) => b.service_id === service.id) ||
        insertedBookings?.[0];

      await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "reserva_nueva",
          proveedor_email: proveedorProfile?.email_contacto,
          proveedor_nombre: proveedorProfile?.nombre,
          cliente_nombre: perfilCliente?.nombre || "Un cliente",
          servicio_titulo: service.titulo,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || fechaInicio,
          precio_total: priceSummary.total.toFixed(2),
          booking_id: mainBooking?.id,
        }),
      });

      const emailServicios = selectedServices.map((svc) => {
        const calc = calculateServiceBasePrice(svc, dateContext);
        return {
          titulo: svc.titulo || VERTICALS[svc.vertical]?.label,
          proveedor_nombre: svc.profiles?.nombre || "Proveedor",
          proveedor_email: svc.profiles?.email || userEmail,
          precio: applyClientPrice(calc.base).toFixed(2),
          direccion_exacta: svc.direccion_exacta,
          telefono_proveedor: svc.telefono_contacto,
          modalidad: svc.modalidad,
        };
      });

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
          precio_total: priceSummary.total.toFixed(2),
          subtotal: priceSummary.subtotal.toFixed(2),
          comision: priceSummary.commission.toFixed(2),
          mensaje: mensaje || "",
          direccion_exacta: service.direccion_exacta,
          telefono_proveedor: service.telefono_contacto,
          modalidad: service.modalidad,
          servicios: emailServicios,
        }),
      });

      router.push("/dashboard");
    },
    [
      userId,
      service,
      grupoReserva,
      priceSummary,
      selectedServices,
      fechaInicio,
      fechaFin,
      hora,
      duracionHoras,
      mensaje,
      vertical,
      userEmail,
      perfilCliente,
      router,
      reservarComoFamilia,
      familiaInfo,
    ],
  );

  function toggleBundleService(id) {
    setBundleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
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
                  style={{ backgroundColor: verticalConfig.light, color: verticalConfig.color }}
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
                style={{ backgroundColor: verticalConfig.light, color: verticalConfig.color }}
              >
                <Icon className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-[#888]">
                  {verticalConfig.label}
                </p>
                {precioEspecialChat ? (
                  <div>
                    <p className="text-sm font-medium text-green-700">
                      Precio especial acordado con el proveedor 🏷️
                    </p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-2">
                      <p className="text-lg text-[#888] line-through">
                        {unitPrice
                          ? `${unitPrice}€${verticalConfig.priceSuffix}`
                          : "Consultar"}
                      </p>
                      <p className="text-2xl font-bold text-green-700">
                        {precioEspecialChat}€{verticalConfig.priceSuffix}
                      </p>
                    </div>
                  </div>
                ) : ofertaActiva ? (
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-lg text-[#888] line-through">
                      {unitPrice ? `${unitPrice}€${verticalConfig.priceSuffix}` : "Consultar"}
                    </p>
                    <p className="text-2xl font-bold text-green-700">
                      {precioEfectivo
                        ? `${precioEfectivo}€${verticalConfig.priceSuffix}`
                        : "Consultar"}
                    </p>
                  </div>
                ) : (
                  <p className="text-2xl font-bold" style={{ color: verticalConfig.color }}>
                    {unitPrice ? `${unitPrice}€${verticalConfig.priceSuffix}` : "Consultar"}
                  </p>
                )}
              </div>
            </div>

            {cancelPolicy && (
              <div className="mt-5 flex gap-3 rounded-xl bg-[#fef9c3] px-4 py-3">
                <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#ca8a04]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#92400e]">
                    Política de cancelación
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#854d0e]">
                    {cancelPolicy.name}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[#854d0e]">
                    {cancelPolicy.description}
                  </p>
                </div>
              </div>
            )}

            {formatEstanciaInfo(
              vertical,
              service.estancia_minima,
              service.estancia_maxima,
            ).length > 0 && (
              <div
                className="mt-4 flex gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: verticalConfig.light }}
              >
                <InfoIcon
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: verticalConfig.color }}
                />
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: verticalConfig.color }}
                  >
                    Estancia
                  </p>
                  {formatEstanciaInfo(
                    vertical,
                    service.estancia_minima,
                    service.estancia_maxima,
                  ).map((line) => (
                    <p
                      key={line}
                      className="mt-0.5 text-sm leading-relaxed text-[#444]"
                    >
                      {line}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {formatAntelacionInfo(service.antelacion_minima) && (
              <div
                className="mt-4 flex gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: verticalConfig.light }}
              >
                <InfoIcon
                  className="mt-0.5 h-5 w-5 shrink-0"
                  style={{ color: verticalConfig.color }}
                />
                <div>
                  <p
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: verticalConfig.color }}
                  >
                    Antelación
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-[#444]">
                    {formatAntelacionInfo(service.antelacion_minima)}
                  </p>
                </div>
              </div>
            )}
          </aside>

          <div
            className="rounded-2xl border bg-white p-6 sm:p-7"
            style={{ borderColor: BRAND.border }}
          >
            <h2 className="text-lg font-semibold text-[#1a1a1a]">Detalles de la reserva</h2>

            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label htmlFor="fecha-inicio" className="mb-1.5 block text-xs font-medium text-[#444]">
                  Fecha de inicio
                </label>
                <FechaInicioConDias
                  id="fecha-inicio"
                  value={fechaInicio}
                  min={new Date().toISOString().split("T")[0]}
                  diasDisponibles={service?.dias_disponibles}
                  onChange={setFechaInicio}
                  onValidationError={setErrorMessage}
                  inputClass={inputClass}
                  borderColor={BRAND.border}
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
                      min={getMinHora()}
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

            {complementaryServices.length > 0 && (
              <section className="mt-6 border-t pt-6" style={{ borderColor: BRAND.border }}>
                <h3 className="text-base font-semibold text-[#1a1a1a]">
                  ¿Quieres añadir más servicios para esas fechas?
                </h3>
                <p className="mt-1 text-sm text-[#888]">
                  Todo en una sola reserva y un solo pago.
                </p>

                <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-2">
                  {complementaryServices.map((comp) => {
                    const compConfig = VERTICALS[comp.vertical] ?? VERTICALS.alojamiento;
                    const CompIcon = compConfig.Icon;
                    const isAdded = bundleIds.includes(comp.id);
                    const providerName = formatShortName(
                      comp.profiles?.nombre,
                      comp.profiles?.apellido,
                    );

                    return (
                      <div
                        key={comp.id}
                        className="flex w-[220px] shrink-0 flex-col rounded-xl border bg-white p-3"
                        style={{ borderColor: BRAND.border }}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              backgroundColor: compConfig.light,
                              color: compConfig.color,
                            }}
                          >
                            <CompIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                              {providerName || "Proveedor"}
                            </p>
                            <p className="text-xs font-bold" style={{ color: compConfig.color }}>
                              {comp.precio
                                ? `${comp.precio}€${compConfig.priceSuffix}`
                                : "Consultar"}
                            </p>
                          </div>
                        </div>

                        {comp.titulo && (
                          <p className="mt-2 line-clamp-2 text-xs text-[#666]">{comp.titulo}</p>
                        )}

                        <div className="mt-2">
                          {comp.reserva_inmediata ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                              Inmediata ⚡
                            </span>
                          ) : (
                            <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-semibold text-yellow-800">
                              Con confirmación 🕐
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleBundleService(comp.id)}
                          className="mt-3 w-full rounded-lg py-2 text-xs font-semibold transition-colors"
                          style={
                            isAdded
                              ? { backgroundColor: "#16a34a", color: "#fff" }
                              : {
                                  border: `1.5px solid ${compConfig.color}`,
                                  color: compConfig.color,
                                  backgroundColor: "#fff",
                                }
                          }
                        >
                          {isAdded ? "Añadido ✓" : "Añadir +"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div
              className="mt-6 rounded-xl px-4 py-4"
              style={{ backgroundColor: verticalConfig.light }}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-[#666]">
                Resumen del precio
              </p>

              {precioListo ? (
                <>
                  <div className="mt-3 flex flex-col gap-2">
                    {priceSummary.lines.map((line) => {
                      const lineConfig = VERTICALS[line.vertical] ?? verticalConfig;
                      return (
                        <div
                          key={line.id}
                          className="flex items-start justify-between gap-3 text-sm"
                        >
                          <span className="text-[#444]">{line.name}</span>
                          <span className="shrink-0 font-semibold" style={{ color: lineConfig.color }}>
                            {formatEuro(line.total)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <p
                    className="mt-3 text-2xl font-bold"
                    style={{ color: verticalConfig.color }}
                  >
                    {formatEuro(priceSummary.total)}
                  </p>

                  <p className="mt-1 text-xs text-[#888]">
                    Gastos de gestión incluidos
                  </p>
                  {precioEspecialChat && (
                    <p className="mt-2 text-sm font-medium text-green-700">
                      Precio especial acordado con el proveedor 🏷️
                    </p>
                  )}
                  {priceSummary.lines.some(
                    (line) =>
                      line.discountSource === "duration" && line.discountPct > 0,
                  ) && (
                    <div className="mt-3 flex flex-col gap-1">
                      {priceSummary.lines
                        .filter(
                          (line) =>
                            line.discountSource === "duration" &&
                            line.discountPct > 0,
                        )
                        .map((line) => (
                          <p
                            key={line.id}
                            className="text-sm font-medium text-green-700"
                          >
                            Descuento por estancia larga: -{line.discountPct}%
                            {priceSummary.lines.length > 1
                              ? ` (${line.name})`
                              : ""}
                          </p>
                        ))}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-[#444]">{precioDetail}</p>
                  <p className="mt-2 text-2xl font-bold" style={{ color: verticalConfig.color }}>
                    —
                  </p>
                </>
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

            {cancelPolicy && (
              <div
                className="mt-6 rounded-xl border-2 px-4 py-4"
                style={{
                  borderColor: verticalConfig.color,
                  backgroundColor: verticalConfig.light,
                }}
              >
                <p
                  className="text-sm font-bold"
                  style={{ color: verticalConfig.color }}
                >
                  Política de cancelación — {cancelPolicy.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-[#444]">
                  {cancelPolicy.description}
                </p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {cancelPolicy.tiers.map((tier) => (
                    <li
                      key={tier.label}
                      className="flex items-center justify-between gap-3 rounded-lg bg-white/80 px-3 py-2 text-sm"
                    >
                      <span className="text-[#444]">{tier.label}</span>
                      <span
                        className="shrink-0 font-bold tabular-nums"
                        style={{ color: verticalConfig.color }}
                      >
                        {tier.percent}% reembolso
                      </span>
                    </li>
                  ))}
                </ul>
                {refundPercentNow !== null && precioListo && (
                  <p
                    className="mt-4 border-t pt-3 text-sm font-medium"
                    style={{
                      borderColor: `${verticalConfig.color}33`,
                      color: verticalConfig.color,
                    }}
                  >
                    Si cancelaras ahora: {refundPercentNow}% de reembolso (
                    {formatEuro(
                      Math.round(
                        (priceSummary.total * refundPercentNow) / 100 * 100,
                      ) / 100,
                    )}
                    )
                  </p>
                )}
              </div>
            )}

            {precioListo && priceSummary.total > 0 && familiaInfo && (
              <div
                className="my-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                style={{ borderColor: BRAND.border, backgroundColor: BRAND.warm }}
              >
                <label
                  htmlFor="reservar-familia"
                  className="text-sm font-medium text-[#444]"
                >
                  Reservar bajo el grupo familiar {familiaInfo.nombre}
                </label>
                <button
                  type="button"
                  id="reservar-familia"
                  role="switch"
                  aria-checked={reservarComoFamilia}
                  onClick={() => setReservarComoFamilia((prev) => !prev)}
                  className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                  style={{
                    backgroundColor: reservarComoFamilia
                      ? BRAND.primary
                      : "#d1d5db",
                  }}
                >
                  <span
                    className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                    style={{
                      left: reservarComoFamilia ? "22px" : "2px",
                    }}
                  />
                </button>
              </div>
            )}

            {precioListo && priceSummary.total > 0 && (
              <div className="my-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="acepta-politica"
                  required
                  checked={aceptaPolitica}
                  onChange={(e) => setAceptaPolitica(e.target.checked)}
                  className="mt-1 cursor-pointer"
                />
                <label htmlFor="acepta-politica" className="text-sm text-[#444]">
                  He leído y acepto la política de cancelación{" "}
                  <span className="font-medium text-[#1d4f91]">
                    {service?.cancellation_policy === "flexible"
                      ? "Flexible"
                      : service?.cancellation_policy === "moderada"
                        ? "Moderada"
                        : "Estricta"}
                  </span>{" "}
                  y las condiciones de este servicio
                </label>
              </div>
            )}

            {precioListo && priceSummary.total > 0 ? (
              paymentMethodsLoading || paymentIntentLoading ? (
                <p className="mt-6 text-center text-sm text-[#666]">
                  Preparando formulario de pago…
                </p>
              ) : savedPaymentMethods.length > 0 &&
                !useNewCard &&
                selectedPaymentMethod &&
                paymentMetadata &&
                stripeCustomerId ? (
                <SavedCardCheckout
                  precioTotal={priceSummary.total}
                  paymentMethod={selectedPaymentMethod}
                  stripeCustomerId={stripeCustomerId}
                  userId={userId}
                  metadata={paymentMetadata}
                  onPaymentSuccess={completeBooking}
                  onUseNewCard={() => setUseNewCard(true)}
                  getBookingDateError={() =>
                    validateBookingDates(vertical, fechaInicio, hora)
                  }
                  disabled={!!successMessage || !aceptaPolitica}
                />
              ) : clientSecret && paymentMetadata ? (
                <>
                  <Elements
                    key={clientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <CheckoutForm
                      precioTotal={priceSummary.total}
                      paymentIntentId={paymentIntentId}
                      metadata={paymentMetadata}
                      stripeCustomerId={stripeCustomerId}
                      userId={userId}
                      userEmail={userEmail}
                      clienteNombre={[perfilCliente?.nombre, perfilCliente?.apellido]
                        .filter(Boolean)
                        .join(" ")}
                      onPaymentSuccess={completeBooking}
                      vertical={vertical}
                      fechaInicio={fechaInicio}
                      hora={hora}
                      setErrorMessage={setErrorMessage}
                      service={service}
                      disabled={!!successMessage || !aceptaPolitica}
                    />
                  </Elements>
                  {savedPaymentMethods.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setUseNewCard(false)}
                      className="mt-3 w-full text-center text-sm font-medium no-underline hover:underline"
                      style={{ color: BRAND.primary }}
                    >
                      Usar tarjeta guardada
                    </button>
                  )}
                </>
              ) : (
                <p className="mt-6 text-center text-sm text-red-600">
                  No se pudo cargar el pago. Revisa las fechas e inténtalo de nuevo.
                </p>
              )
            ) : (
              <p className="mt-6 text-center text-sm text-[#888]">
                Completa las fechas para habilitar el pago.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
