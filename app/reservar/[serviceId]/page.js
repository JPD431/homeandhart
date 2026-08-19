"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CalendarioRangoFechas from "@/app/components/CalendarioRangoFechas";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  DNI_SUBIR_RUTA,
  getClienteReservaDniBlockMessage,
  getDniRevisionEstado,
  isClienteVerificado,
} from "@/app/lib/dni";
import {
  hasTelefono,
  TELEFONO_REQUIRED_CLIENT_MSG,
  TELEFONO_INVALID_MSG,
  telefonoForStorage,
} from "@/app/lib/profile-telefono";
import {
  initialLugarServicio,
  LUGAR_CASA_CLIENTE,
  LUGAR_CASA_PROVEEDOR,
  lugarServicioInfoLabel,
  needsClienteDireccionBlock,
  needsLugarSelector,
} from "@/app/lib/lugar-servicio";
import { getUserFamiliaActiva } from "@/app/lib/familia";
import {
  buildBundleStateSnapshot,
  clearBundleStateFromSession,
  createBundleStatePersister,
  restoreBundleStateFromSession,
  writeBundleStateToSession,
} from "@/app/lib/bundle-persist";
import { getPrecioEfectivo, isOfertaActiva } from "@/app/lib/ofertas";
import {
  applyClientPrice,
  billingNeedsDuracionHoras,
  billingNeedsFechaFin,
  billingNeedsHora,
  calculateServiceBasePrice,
  COMMISSION_RATE,
  getEstanciaUnit,
  getServiceDuration,
  getServiceModalidadesRows,
  resolveBillingForService,
} from "@/app/lib/pricing-reserva";
import {
  formatHuespedesPrecioDesglose,
  getUnidadesPrecioCopy,
  serviceHasHuespedesModelo,
  serviceNeedsUnidadesSelector,
} from "@/app/lib/huespedes-precio";
import {
  MODALIDAD_COBRO_OPTIONS,
  getModalidadCobroPriceSuffix,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";
import {
  getRefundPercent,
  getServiceStartDateTime,
  normalizeCancelPolicy,
} from "@/app/lib/cancelacion-politica";
import { supabase } from "@/app/lib/supabase";
import {
  cancelOrphanPaymentIntent,
  friendlyStripePaymentError,
} from "@/app/lib/stripe-payment-errors";
import { cargarTarifasPorFecha } from "@/app/lib/tarifas";
import {
  getServiceBookabilityIssue,
  isServiceBookable,
} from "@/app/lib/service-bookable";
import { resolveServiceCardPricing } from "@/app/lib/service-card-display";
import { VERIFICADO_BADGE_TOOLTIP_ES } from "@/app/lib/verification-copy";
import { verticalEmojiLabel } from "@/app/lib/vertical-emojis";
import {
  LodgingIcon,
  PersonIcon,
  PetIcon,
} from "@/app/components/vertical-icons";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

function getReservasSinComisionCliente(perfil) {
  return Number(perfil?.reservas_sin_comision_cliente) || 0;
}

function getCancelPoliciesT(t) {
  const r = t.reservar;
  return {
    flexible: {
      name: r.cancelFlexibleName,
      description: r.cancelFlexibleDesc,
      tiers: [
        { label: r.cancelFlexibleTier0, percent: 100 },
        { label: r.cancelFlexibleTier1, percent: 50 },
        { label: r.cancelFlexibleTier2, percent: 0 },
      ],
    },
    moderada: {
      name: r.cancelModeradaName,
      description: r.cancelModeradaDesc,
      tiers: [
        { label: r.cancelModeradaTier0, percent: 100 },
        { label: r.cancelModeradaTier1, percent: 50 },
        { label: r.cancelModeradaTier2, percent: 0 },
      ],
    },
    estricta: {
      name: r.cancelEstrictaName,
      description: r.cancelEstrictaDesc,
      tiers: [
        { label: r.cancelEstrictaTier0, percent: 100 },
        { label: r.cancelEstrictaTier1, percent: 50 },
        { label: r.cancelEstrictaTier2, percent: 0 },
      ],
    },
  };
}

function getCancelPolicy(policyKey, cancelPolicies) {
  const key = normalizeCancelPolicy(policyKey);
  return cancelPolicies[key];
}

function parseInheritedSearchDate(value) {
  if (!value || typeof value !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }

  const hoy = new Date();
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  if (value < hoyStr) return null;

  return value;
}

function validateBookingDates(vertical, fechaInicio, hora, t) {
  if (!fechaInicio) return null;

  const hoyStr = new Date().toISOString().split("T")[0];
  if (fechaInicio < hoyStr) {
    return t ? t.reservar.errFechaEnPasado : "La fecha de inicio no puede ser en el pasado";
  }

  if (hora) {
    const ahora = new Date();
    const hoyStrLocal = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
    if (fechaInicio === hoyStrLocal) {
      const [h, m] = hora.split(":").map(Number);
      const horaSeleccionada = h * 60 + m;
      const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
      if (horaSeleccionada <= horaActual) {
        return t ? t.reservar.errHoraPasada(hora) : `La hora ${hora} ya ha pasado. Por favor elige una hora futura.`;
      }
    }
  }

  return null;
}

const VERTICALS = {
  alojamiento: {
    label: "Alojamiento",
    priceSuffix: "/ noche",
    unit: "noche",
    color: "#1d4f91",
    light: "#e8f0fb",
    Icon: LodgingIcon,
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

function getVerticalsT(t) {
  const r = t.reservar;
  return {
    alojamiento: { ...VERTICALS.alojamiento, label: r.vertAlojamientoLabel, priceSuffix: r.vertAlojamientoPriceSuffix, unit: r.vertAlojamientoUnit },
    ninos: { ...VERTICALS.ninos, label: r.vertNinosLabel, priceSuffix: r.vertNinosPriceSuffix, unit: r.vertNinosUnit },
    mascotas: { ...VERTICALS.mascotas, label: r.vertMascotasLabel, priceSuffix: r.vertMascotasPriceSuffix, unit: r.vertMascotasUnit },
  };
}

const COMPLEMENTARY_VERTICALS = {
  alojamiento: ["ninos", "mascotas"],
  ninos: ["alojamiento", "mascotas"],
  mascotas: ["alojamiento", "ninos"],
};

const ALL_BUNDLE_VERTICAL_IDS = ["alojamiento", "ninos", "mascotas"];

/** Nombres cortos para el mensaje del carrito (minúsculas en frase). */
const CART_VERTICAL_SHORT_LABELS = {
  alojamiento: "alojamiento",
  ninos: "niñera",
  mascotas: "mascotas",
};

function getCartShortLabelsT(t) {
  const r = t.reservar;
  return {
    alojamiento: r.cartShortAlojamiento,
    ninos: r.cartShortNinos,
    mascotas: r.cartShortMascotas,
  };
}

/** Verticales que aún se pueden añadir (una por tipo en el carrito). */
function getAvailableComplementaryVerticals(servicesInCart) {
  const taken = new Set(
    (servicesInCart ?? []).map((s) => s.vertical).filter(Boolean),
  );
  return ALL_BUNDLE_VERTICAL_IDS.filter((v) => !taken.has(v));
}

/**
 * "Ya tienes X en el carrito" — solo verticales presentes, con comas y "y" final.
 */
function formatCartVerticalsInCartMessage(servicesInCart, t) {
  const shortLabels = t ? getCartShortLabelsT(t) : CART_VERTICAL_SHORT_LABELS;
  const present = new Set(
    (servicesInCart ?? []).map((s) => s.vertical).filter(Boolean),
  );
  const labels = ALL_BUNDLE_VERTICAL_IDS.filter((id) => present.has(id)).map(
    (id) => shortLabels[id] || id,
  );

  if (labels.length === 0) {
    return t ? t.reservar.yaServiciosEnCarrito : "Ya tienes servicios en el carrito.";
  }
  if (labels.length === 1) {
    return `Ya tienes ${labels[0]} en el carrito.`;
  }
  if (labels.length === 2) {
    return `Ya tienes ${labels[0]} y ${labels[1]} en el carrito.`;
  }
  return `Ya tienes ${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]} en el carrito.`;
}

const RESERVAR_SERVICE_COLUMNS = `
  id,
  titulo,
  vertical,
  precio,
  disponible,
  cancellation_policy,
  descripcion,
  estancia_minima,
  estancia_maxima,
  antelacion_minima,
  dias_disponibles,
  reserva_inmediata,
  disponible_para_viajar,
  ciudad,
  proveedor_id,
  modalidad,
  oferta_descuento,
  oferta_valida_hasta,
  descuentos_duracion,
  capacidad_maxima,
  huespedes_incluidos,
  precio_huesped_extra
`;

const RESERVAR_SERVICE_SELECT = `
  ${RESERVAR_SERVICE_COLUMNS},
  profiles_public!inner (
    nombre,
    apellido,
    verificado,
    cobros_activos
  )
`;

const RESERVAR_MAIN_SERVICE_SELECT = `
  ${RESERVAR_SERVICE_COLUMNS},
  profiles_public!inner (
    nombre,
    apellido,
    ciudad,
    idiomas,
    verificado,
    location_zone,
    cobros_activos
  )
`;

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

function validateEstancia(svc, duration, t) {
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
    return t
      ? t.reservar.errMinEstancia(min, getEstanciaUnit(svc.vertical, min))
      : `Este servicio requiere un mínimo de ${min} ${getEstanciaUnit(svc.vertical, min)}`;
  }
  if (max != null && max > 0 && duration > max) {
    return t
      ? t.reservar.errMaxEstancia(max, getEstanciaUnit(svc.vertical, max))
      : `Este servicio tiene un máximo de ${max} ${getEstanciaUnit(svc.vertical, max)}`;
  }
  return null;
}

function formatEstanciaInfo(vertical, minima, maxima, t) {
  const parts = [];
  if (minima != null && minima !== "" && Number(minima) > 0) {
    const n = Number(minima);
    parts.push(t ? t.reservar.infoMin(n, getEstanciaUnit(vertical, n)) : `Mínimo ${n} ${getEstanciaUnit(vertical, n)}`);
  }
  if (maxima != null && maxima !== "" && Number(maxima) > 0) {
    const n = Number(maxima);
    parts.push(t ? t.reservar.infoMax(n, getEstanciaUnit(vertical, n)) : `Máximo ${n} ${getEstanciaUnit(vertical, n)}`);
  }
  return parts;
}

function formatAntelacionLabel(hours, t) {
  const h = Number(hours);
  if (h >= 24 && h % 24 === 0) {
    const days = h / 24;
    if (t) return days === 1 ? t.reservar.unDia : t.reservar.nDias(days);
    return days === 1 ? "1 día" : `${days} días`;
  }
  if (t) return h === 1 ? t.reservar.unaHora : t.reservar.nHoras(h);
  return h === 1 ? "1 hora" : `${h} horas`;
}

function validateAntelacion(svc, fechaInicio, hora, mainVertical, t) {
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
    const label = formatAntelacionLabel(required, t);
    return t
      ? t.reservar.errAntelacion(label)
      : `Este servicio requiere reservar con al menos ${label} de antelación`;
  }
  return null;
}

function formatAntelacionInfo(antelacionMinima, t) {
  const h =
    antelacionMinima != null && antelacionMinima !== ""
      ? Number(antelacionMinima)
      : 24;
  if (!h) return null;
  const label = formatAntelacionLabel(h, t);
  return t
    ? t.reservar.infoAntelacion(label)
    : `Reservar con al menos ${label} de antelación`;
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

function getDiasSemanaT(t) {
  const r = t.reservar;
  return [
    { id: "lun", label: r.diaLunLabel, nombre: r.diaLunNombre, jsDay: 1 },
    { id: "mar", label: r.diaMarLabel, nombre: r.diaMarNombre, jsDay: 2 },
    { id: "mie", label: r.diaMieLabel, nombre: r.diaMieNombre, jsDay: 3 },
    { id: "jue", label: r.diaJueLabel, nombre: r.diaJueNombre, jsDay: 4 },
    { id: "vie", label: r.diaVieLabel, nombre: r.diaVieNombre, jsDay: 5 },
    { id: "sab", label: r.diaSabLabel, nombre: r.diaSabNombre, jsDay: 6 },
    { id: "dom", label: r.diaDomLabel, nombre: r.diaDomNombre, jsDay: 0 },
  ];
}

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

function getDiaDisponibleError(fechaStr, diasDisponibles, t) {
  const diaId = getDiaIdFromFecha(fechaStr);
  const diasMeta = t ? getDiasSemanaT(t) : DIAS_SEMANA_META;
  const nombre = diasMeta.find((d) => d.id === diaId)?.nombre ?? "ese día";
  return t
    ? t.reservar.errDiaNoDisponible(nombre)
    : `Este proveedor no está disponible los ${nombre}. Por favor elige otra fecha.`;
}

function validateDiaDisponible(svc, fechaInicio, t) {
  if (!fechaInicio) return null;
  const disponibles = normalizeDiasDisponibles(svc.dias_disponibles);
  if (isFechaEnDiasDisponibles(fechaInicio, disponibles)) return null;
  return getDiaDisponibleError(fechaInicio, disponibles, t);
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
  t,
}) {
  const inputRef = useRef(null);
  const disponibles = normalizeDiasDisponibles(diasDisponibles);
  const diasMeta = t ? getDiasSemanaT(t) : DIAS_SEMANA_META;
  const diasLabel = diasMeta.filter((d) => disponibles.includes(d.id))
    .map((d) => d.label)
    .join(", ");

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (value && !isFechaEnDiasDisponibles(value, disponibles)) {
      el.setCustomValidity(getDiaDisponibleError(value, disponibles, t));
    } else {
      el.setCustomValidity("");
    }
  }, [value, disponibles, t]);

  function handleChange(e) {
    const next = e.target.value;
    if (!next) {
      e.target.setCustomValidity("");
      onValidationError("");
      onChange("");
      return;
    }
    if (!isFechaEnDiasDisponibles(next, disponibles)) {
      const err = getDiaDisponibleError(next, disponibles, t);
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
          ? (t ? t.reservar.soloPuedesReservarEn(diasLabel) : `Solo puedes reservar en: ${diasLabel}`)
          : (t ? t.reservar.seleccionaFechaDisponible : "Selecciona una fecha disponible")
      }
      className={inputClass}
      style={{ borderColor }}
    />
  );
}

const MAX_CREDITO_PORCENTAJE = 0.6;
const MIN_STRIPE_EUR = 0.5;

const SERVICE_MODALIDADES_SELECT =
  "modalidad, precio, horas_unidad, suplemento_extra";

/** Paso 2a: campos de reserva por servicio en el carrito. */
function emptyCartBookingFields(service = null) {
  const modalidad = service?.modalidad ?? null;
  const lugar = initialLugarServicio(modalidad, service?.vertical);
  return {
    fechaInicio: "",
    fechaFin: "",
    hora: "",
    duracionHoras: "",
    modalidadCobro: null,
    numHuespedes: null,
    lugarServicio: lugar,
    direccionCliente: "",
    direccionClienteADefinir: lugar === LUGAR_CASA_CLIENTE ? true : null,
  };
}

function buildCartEntry(service, fields = {}) {
  const base = emptyCartBookingFields(service);
  return {
    service,
    fechaInicio: fields.fechaInicio ?? base.fechaInicio,
    fechaFin: fields.fechaFin ?? base.fechaFin,
    hora: fields.hora ?? base.hora,
    duracionHoras: fields.duracionHoras ?? base.duracionHoras,
    modalidadCobro:
      fields.modalidadCobro !== undefined
        ? fields.modalidadCobro
        : base.modalidadCobro,
    numHuespedes:
      fields.numHuespedes !== undefined
        ? fields.numHuespedes
        : base.numHuespedes,
    lugarServicio:
      fields.lugarServicio !== undefined
        ? fields.lugarServicio
        : base.lugarServicio,
    direccionCliente:
      fields.direccionCliente !== undefined
        ? fields.direccionCliente
        : base.direccionCliente,
    direccionClienteADefinir:
      fields.direccionClienteADefinir !== undefined
        ? fields.direccionClienteADefinir
        : base.direccionClienteADefinir,
  };
}

/**
 * Selector de lugar (solo modalidad=ambas) + dirección opcional del cliente.
 */
function LugarServicioBookingFields({
  modalidad,
  vertical = null,
  lugarServicio,
  direccionCliente,
  direccionClienteADefinir,
  onChange,
  compact = false,
  t,
}) {
  // Alojamiento: sin selector/bloque (lugar = casa_proveedor implícito).
  // Niñera/mascotas: modalidad siempre definida.
  if (!modalidad && vertical !== "alojamiento") return null;
  if (vertical === "alojamiento") return null;

  const showSelector = needsLugarSelector(modalidad);
  const effectiveLugar =
    lugarServicio ?? initialLugarServicio(modalidad, vertical);
  const infoLabel = !showSelector
    ? lugarServicioInfoLabel(effectiveLugar, modalidad)
    : null;
  const showDireccion = needsClienteDireccionBlock(effectiveLugar);
  const labelClass =
    "mb-2 text-[8px] font-medium uppercase tracking-wide text-[#bbb]";
  const btnMin = compact ? 40 : 44;
  const aDefinirChecked =
    direccionClienteADefinir !== false;

  if (!showSelector && !infoLabel && !showDireccion) return null;

  return (
    <div className={compact ? "mb-3" : "mt-4"}>
      {showSelector && (
        <div className="mb-3">
          <p className={labelClass}>{t ? t.reservar.dondeQuieresServicio : "¿Dónde quieres el servicio?"}</p>
          <div className="flex flex-col gap-2">
            {[
              {
                value: LUGAR_CASA_PROVEEDOR,
                label: t ? t.reservar.enCasaProfesional : "En casa del profesional",
              },
              {
                value: LUGAR_CASA_CLIENTE,
                label: t ? t.reservar.enMiCasa : "En mi casa",
              },
            ].map((opt) => {
              const selected = effectiveLugar === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange({
                      lugarServicio: opt.value,
                      direccionCliente:
                        opt.value === LUGAR_CASA_CLIENTE
                          ? direccionCliente || ""
                          : "",
                      direccionClienteADefinir:
                        opt.value === LUGAR_CASA_CLIENTE ? true : null,
                    });
                  }}
                  className="w-full border px-3 text-left transition-opacity hover:opacity-90"
                  style={{
                    minHeight: btnMin,
                    borderColor: selected ? "#1d4f91" : "#e8e4de",
                    backgroundColor: selected ? "#e8f0fb" : "#fff",
                    borderRadius: 6,
                    padding: compact ? "8px 10px" : "10px 12px",
                  }}
                >
                  <span className="block text-[12px] font-semibold text-[#1a1a1a]">
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {infoLabel && (
        <p
          className="mb-3 text-[11px] leading-relaxed"
          style={{ color: "#666" }}
        >
          {infoLabel}
        </p>
      )}

      {showDireccion && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: "#e8e4de", backgroundColor: "#faf9f7" }}
        >
          <p className={labelClass}>{t ? t.reservar.dondeOpcional : "¿Dónde? (opcional)"}</p>
          <label className="mb-2 flex cursor-pointer items-start gap-2 text-[12px] text-[#444]">
            <input
              type="checkbox"
              checked={aDefinirChecked}
              onChange={(e) => {
                if (e.target.checked) {
                  onChange({
                    direccionClienteADefinir: true,
                    direccionCliente: "",
                  });
                } else {
                  onChange({
                    direccionClienteADefinir: false,
                  });
                }
              }}
              className="mt-0.5"
            />
            <span>{t ? t.reservar.aDefinirCoordinar : "A definir / lo coordino con el proveedor"}</span>
          </label>
          {!aDefinirChecked && (
            <input
              type="text"
              value={direccionCliente || ""}
              onChange={(e) =>
                onChange({
                  direccionCliente: e.target.value,
                  direccionClienteADefinir: e.target.value.trim()
                    ? false
                    : true,
                })
              }
              placeholder={t ? t.reservar.calleNumeroCiudad : "Calle, número, ciudad…"}
              className="w-full border px-3 py-2 text-[13px]"
              style={{
                borderColor: "#e8e4de",
                borderRadius: 6,
                backgroundColor: "#fff",
              }}
            />
          )}
          <p className="mt-1.5 text-[10px] text-[#999]">
            {t ? t.reservar.direccionNoObligatoria : "No es obligatorio. Si aún no sabes la dirección, déjala a definir y coordináis por teléfono."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Carga service_modalidades y las adjunta en service.modalidades. */
async function loadServiceWithModalidades(serviceRow) {
  if (!serviceRow?.id) return serviceRow;
  if (!supportsModalidadCobro(serviceRow.vertical)) {
    return { ...serviceRow, modalidades: serviceRow.modalidades ?? [] };
  }
  if (Array.isArray(serviceRow.modalidades)) {
    return serviceRow;
  }
  const { data: modRows } = await supabase
    .from("service_modalidades")
    .select(SERVICE_MODALIDADES_SELECT)
    .eq("service_id", serviceRow.id);
  return { ...serviceRow, modalidades: modRows ?? [] };
}

function defaultModalidadCobroFromService(serviceWithMods) {
  const rows = getServiceModalidadesRows(serviceWithMods);
  if (rows.length === 1) return rows[0].modalidad;
  return null;
}

function defaultNumHuespedesFromService(serviceWithMods) {
  if (!serviceNeedsUnidadesSelector(serviceWithMods)) return null;
  const n = Math.floor(Number(serviceWithMods.huespedes_incluidos));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Prefill editable al añadir un complementario: fechas del main como sugerencia.
 * Hora/duración/modalidad son propias de cada vertical → no se copian del main.
 */
function suggestedBookingFieldsFromMain(mainFields, serviceWithMods) {
  const base = emptyCartBookingFields(serviceWithMods);
  return {
    ...base,
    fechaInicio: mainFields?.fechaInicio || "",
    fechaFin: mainFields?.fechaFin || "",
    modalidadCobro: defaultModalidadCobroFromService(serviceWithMods),
    numHuespedes: defaultNumHuespedesFromService(serviceWithMods),
  };
}

/** Paso 2b: ¿hace falta elegir modalidad (2+ filas)? */
function cartEntryNeedsModalidad(entry) {
  const svc = entry?.service;
  if (!svc || !supportsModalidadCobro(svc.vertical)) return false;
  return getServiceModalidadesRows(svc).length > 1;
}

function getCartEntryBilling(entry) {
  const svc = entry?.service;
  if (!svc) return { kind: "legacy" };
  return resolveBillingForService(svc, entry.modalidadCobro);
}

/** Contexto de fechas/modalidad para calculateServiceBasePrice desde una línea del carrito. */
function buildDateContextFromCartEntry(entry) {
  const svc = entry.service;
  return {
    fechaInicio: entry.fechaInicio,
    fechaFin: entry.fechaFin,
    duracionHoras: entry.duracionHoras,
    mainVertical: svc.vertical,
    numHuespedes: entry.numHuespedes,
    modalidadCobro: entry.modalidadCobro,
    requireModalidad: cartEntryNeedsModalidad(entry),
  };
}

function getMinHoraForFecha(fecha) {
  if (!fecha) return undefined;
  const hoy = new Date().toISOString().split("T")[0];
  if (fecha === hoy) {
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 1);
    return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  }
  return undefined;
}

/**
 * Paso 2b: bloque de inputs de una línea del carrito (complementarios).
 * Lee/escribe cartByServiceId vía onPatch.
 */
function CartLineBookingFields({
  entry,
  fechasOcupadas,
  calendarOpen,
  onToggleCalendar,
  onPatch,
  onValidationError,
  t,
}) {
  const svc = entry?.service;
  if (!svc) return null;

  const vertical = svc.vertical;
  const modalidades = getServiceModalidadesRows(svc);
  const showModalidadSelector = modalidades.length > 1;
  const billing = getCartEntryBilling(entry);
  const showDateInputs = !showModalidadSelector || Boolean(entry.modalidadCobro);

  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: "#c5e0d8" }}>
      <LugarServicioBookingFields
        compact
        modalidad={svc.modalidad}
        vertical={svc.vertical}
        lugarServicio={entry.lugarServicio}
        direccionCliente={entry.direccionCliente}
        direccionClienteADefinir={entry.direccionClienteADefinir}
        onChange={onPatch}
        t={t}
      />

      {showModalidadSelector && (
        <div className="mb-3">
          <p className="mb-2 text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
            {t ? t.reservar.comoQuieresReservar : "¿Cómo quieres reservar?"}
          </p>
          <div className="flex flex-col gap-2">
            {modalidades.map((row) => {
              const opt = MODALIDAD_COBRO_OPTIONS.find(
                (o) => o.value === row.modalidad,
              );
              const selected = entry.modalidadCobro === row.modalidad;
              const precio = Number(row.precio);
              const precioLabel = Number.isFinite(precio)
                ? `${precio % 1 === 0 ? precio : precio.toFixed(2)}€${getModalidadCobroPriceSuffix(row.modalidad)}`
                : "";
              return (
                <button
                  key={row.modalidad}
                  type="button"
                  onClick={() => {
                    const patch = { modalidadCobro: row.modalidad };
                    if (row.modalidad === "hora") patch.fechaFin = "";
                    if (row.modalidad === "dia") {
                      patch.hora = "";
                      patch.duracionHoras = "";
                    }
                    if (row.modalidad === "medio_dia") {
                      patch.duracionHoras = "";
                    }
                    onPatch(patch);
                  }}
                  className="min-h-[40px] w-full border px-3 py-2 text-left transition-opacity hover:opacity-90"
                  style={{
                    borderColor: selected ? "#1d4f91" : "#e8e4de",
                    backgroundColor: selected ? "#e8f0fb" : "#fff",
                    borderRadius: 6,
                  }}
                >
                  <span className="block text-[12px] font-semibold text-[#1a1a1a]">
                    {opt?.label || row.modalidad}
                    {precioLabel ? (
                      <span className="ml-2 font-medium text-[#1d4f91]">
                        {precioLabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {showDateInputs && (
        <div className="relative">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onToggleCalendar}
              className="min-h-[40px] w-full border text-left transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "#fff",
                borderColor: "#e8e4de",
                borderRadius: 6,
                padding: "8px 10px",
              }}
            >
              <p className="text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                {billingNeedsFechaFin(billing, vertical) ? (t ? t.reservar.inicio : "Inicio") : (t ? t.reservar.fecha : "Fecha")}
              </p>
              <p className="mt-0.5 text-[12px] text-[#2a3a4a]">
                {entry.fechaInicio
                  ? formatFechaDisplay(entry.fechaInicio, t)
                  : (t ? t.reservar.seleccionar : "Seleccionar")}
              </p>
            </button>
            <button
              type="button"
              onClick={onToggleCalendar}
              className="min-h-[40px] w-full border text-left transition-opacity hover:opacity-80"
              style={{
                backgroundColor: "#fff",
                borderColor: "#e8e4de",
                borderRadius: 6,
                padding: "8px 10px",
              }}
            >
              <p className="text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                {billingNeedsFechaFin(billing, vertical) ? (t ? t.reservar.fin : "Fin") : (t ? t.reservar.separador : "—")}
              </p>
              <p className="mt-0.5 text-[12px] text-[#2a3a4a]">
                {entry.fechaFin
                  ? formatFechaDisplay(entry.fechaFin, t)
                  : billingNeedsFechaFin(billing, vertical)
                    ? (t ? t.reservar.seleccionar : "Seleccionar")
                    : (t ? t.reservar.separador : "—")}
              </p>
            </button>
          </div>

          {calendarOpen && (
            <div
              className="absolute left-0 right-0 z-20 mt-2 rounded-lg border bg-white p-3 shadow-lg"
              style={{ borderColor: "#e8e4de" }}
            >
              <CalendarioRangoFechas
                fechaInicio={entry.fechaInicio}
                fechaFin={entry.fechaFin}
                onChange={({ desde, hasta }) => {
                  if (desde) {
                    const diaError = validateDiaDisponible(svc, desde, t);
                    if (diaError) {
                      onValidationError?.(diaError);
                      return;
                    }
                    onValidationError?.("");
                  }
                  onPatch({ fechaInicio: desde, fechaFin: hasta });
                }}
                onRangeComplete={onToggleCalendar}
                fechasOcupadas={fechasOcupadas}
              />
            </div>
          )}
        </div>
      )}

      {showDateInputs &&
        (billingNeedsHora(billing) ||
          billingNeedsDuracionHoras(billing) ||
          (billing.kind === "legacy" && vertical === "ninos")) && (
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(billingNeedsHora(billing) ||
              (billing.kind === "legacy" && vertical === "ninos")) && (
              <div>
                <label className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                  {t ? t.reservar.horaDeInicio : "Hora de inicio"}
                </label>
                <input
                  type="time"
                  min={getMinHoraForFecha(entry.fechaInicio)}
                  value={entry.hora || ""}
                  onChange={(e) => onPatch({ hora: e.target.value })}
                  className={inputClass}
                  style={{ borderColor: "#e8e4de", borderRadius: 6 }}
                />
              </div>
            )}
            {(billingNeedsDuracionHoras(billing) ||
              (billing.kind === "legacy" && vertical === "ninos")) && (
              <div>
                <label className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                  {t ? t.reservar.duracionHoras : "Duración (horas)"}
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={entry.duracionHoras || ""}
                  onChange={(e) => onPatch({ duracionHoras: e.target.value })}
                  className={inputClass}
                  style={{ borderColor: "#e8e4de", borderRadius: 6 }}
                />
              </div>
            )}
          </div>
        )}

      {serviceNeedsUnidadesSelector(svc) && (
        <div className="mt-2">
          <label className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
            {getUnidadesPrecioCopy(svc.vertical, entry.modalidadCobro).selectorLabel}
          </label>
          <select
            value={entry.numHuespedes ?? ""}
            onChange={(e) => onPatch({ numHuespedes: Number(e.target.value) })}
            className={inputClass}
            style={{ borderColor: "#e8e4de", borderRadius: 6 }}
          >
            {Array.from(
              { length: Math.floor(Number(svc.capacidad_maxima)) || 1 },
              (_, i) => i + 1,
            ).map((n) => {
              const copy = getUnidadesPrecioCopy(svc.vertical, entry.modalidadCobro);
              const word = n === 1 ? copy.unitSingular : copy.unitPlural;
              return (
                <option key={n} value={n}>
                  {n} {word}
                </option>
              );
            })}
          </select>
          {(() => {
            const desglose = formatHuespedesPrecioDesglose(
              svc,
              entry.numHuespedes,
              entry.modalidadCobro,
            );
            return desglose ? (
              <p className="mt-1.5 text-[11px] leading-snug text-[#666]">
                {desglose}
              </p>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

function roundMoney(amount) {
  return Math.round(amount * 100) / 100;
}

/** Reparte creditoAplicado del grupo entre servicios según precio_total (igual que servidor). */
function splitCreditoPorServicio(preciosPorServicio, creditoAplicado, totalGrupo) {
  const creditoMap = new Map();

  if (!creditoAplicado || creditoAplicado <= 0 || !preciosPorServicio.length) {
    for (const { service_id } of preciosPorServicio) {
      creditoMap.set(service_id, 0);
    }
    return creditoMap;
  }

  let assigned = 0;

  for (let i = 0; i < preciosPorServicio.length; i++) {
    const { service_id, precio_total } = preciosPorServicio[i];

    if (i === preciosPorServicio.length - 1) {
      creditoMap.set(service_id, roundMoney(creditoAplicado - assigned));
    } else {
      const share = roundMoney(
        creditoAplicado * (precio_total / totalGrupo),
      );
      creditoMap.set(service_id, share);
      assigned += share;
    }
  }

  return creditoMap;
}

function buildPaymentPlan(priceSummary, creditoAplicado) {
  const preciosPorServicio = priceSummary.lines.map((line) => ({
    service_id: line.id,
    precio_total: line.total,
  }));
  const creditoMap = splitCreditoPorServicio(
    preciosPorServicio,
    creditoAplicado,
    priceSummary.total,
  );

  return preciosPorServicio.map(({ service_id, precio_total }) => {
    const creditoServicio = creditoMap.get(service_id) ?? 0;
    const tarjeta = roundMoney(precio_total - creditoServicio);
    return {
      service_id,
      precio_total,
      creditoServicio,
      tarjeta,
      needsPi: tarjeta > 0,
    };
  });
}

function validateBundlePaymentPlan(plan) {
  for (const item of plan) {
    if (item.needsPi && item.tarjeta < MIN_STRIPE_EUR) {
      return `El importe con tarjeta (${item.tarjeta.toFixed(2)}€) es inferior al mínimo de Stripe (0,50€).`;
    }
  }
  return null;
}

async function createServicePaymentIntent({
  amount,
  serviceId,
  clienteId,
  grupoReserva,
  customer,
  paymentMethod,
  confirmSaved,
  setupFutureUsage,
}) {
  const res = await fetch("/api/stripe/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount,
      customer: customer || undefined,
      payment_method: paymentMethod || undefined,
      confirm_saved: confirmSaved || undefined,
      setup_future_usage: setupFutureUsage || undefined,
      metadata: {
        service_id: String(serviceId),
        cliente_id: String(clienteId),
        grupo_reserva: String(grupoReserva),
      },
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw Object.assign(
      new Error(data.error || "No se pudo crear la retención de pago."),
      data,
    );
  }
  return data;
}

async function rollbackBundlePaymentIntents(paymentIntentIds) {
  for (const paymentIntentId of paymentIntentIds) {
    try {
      await fetch("/api/stripe/cancel-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId }),
      });
    } catch (err) {
      console.error("[bundle] No se pudo cancelar PI en rollback:", paymentIntentId, err);
    }
  }
}

function extractPaymentMethodId(paymentIntent) {
  if (!paymentIntent?.payment_method) return null;
  return typeof paymentIntent.payment_method === "string"
    ? paymentIntent.payment_method
    : paymentIntent.payment_method?.id ?? null;
}

function paymentsPayloadFromPlan(plan, createdPis) {
  return plan.map((item) => ({
    service_id: item.service_id,
    payment_intent_id: item.needsPi
      ? createdPis.find((c) => c.service_id === item.service_id)?.paymentIntentId ?? null
      : null,
  }));
}

async function ensureStripeCustomer({
  stripeCustomerId,
  userEmail,
  clienteNombre,
  userId,
  onCustomerId,
}) {
  if (stripeCustomerId) return stripeCustomerId;

  const customerRes = await fetch("/api/stripe/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userEmail,
      nombre: clienteNombre || "Cliente",
    }),
  });
  const customerData = await customerRes.json();

  if (!customerRes.ok || !customerData.customer_id) {
    throw new Error(customerData.error || "No se pudo preparar el cliente de pago.");
  }

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerData.customer_id })
    .eq("id", userId);

  onCustomerId?.(customerData.customer_id);
  return customerData.customer_id;
}

async function attachPaymentMethodToCustomer({
  paymentMethodId,
  stripeCustomerId,
  userEmail,
  clienteNombre,
  userId,
}) {
  if (!paymentMethodId) return;

  let customerId = stripeCustomerId;
  if (!customerId) {
    customerId = await ensureStripeCustomer({
      stripeCustomerId: null,
      userEmail,
      clienteNombre,
      userId,
    });
  }

  if (!customerId) return;

  const attachRes = await fetch("/api/stripe/customer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "attach",
      payment_method_id: paymentMethodId,
      customer_id: customerId,
    }),
  });
  const attachData = await attachRes.json().catch(() => ({}));

  if (!attachRes.ok && attachData.error) {
    const msg = attachData.error.toLowerCase();
    const alreadyAttached =
      msg.includes("already been attached") || msg.includes("already attached");
    if (!alreadyAttached) {
      throw new Error(attachData.error);
    }
  }

  await supabase
    .from("profiles")
    .update({ stripe_customer_id: customerId })
    .eq("id", userId);
}

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function formatEuro(amount) {
  return `${Number(amount).toFixed(2)}€`;
}

const GOLD = "#c8922a";

const BUNDLE_TABS = [
  { id: "alojamiento", label: verticalEmojiLabel("alojamiento", "Alojamiento") },
  { id: "ninos", label: verticalEmojiLabel("ninos", "Niñera") },
  { id: "mascotas", label: verticalEmojiLabel("mascotas", "Mascotas") },
];

function formatFechaDisplay(dateStr, t) {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-").map(Number);
  const months = t
    ? t.reservar.mesesCortos
    : ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d} ${months[m - 1]} ${y}`;
}

function formatFechasRango(inicio, fin, t) {
  if (!inicio) return t ? t.reservar.seleccionaFechas : "Selecciona fechas";
  const finStr = fin && fin !== inicio ? ` – ${formatFechaDisplay(fin, t)}` : "";
  return `${formatFechaDisplay(inicio, t)}${finStr}`;
}

function hasPetFriendly(service) {
  const desc = (service.descripcion || "").toLowerCase();
  return /pet[-_\s]?friendly/i.test(desc);
}

function getServiceDisplayTags(service) {
  const tags = [];
  if (service.vertical === "alojamiento") {
    tags.push({ text: "NRU ✓", light: "#e8f0fb", color: "#163a6b" });
  }
  if (
    service.vertical === "alojamiento" &&
    (service.disponible_para_viajar || hasPetFriendly(service))
  ) {
    tags.push({ text: "Pet-friendly 🐾", light: "#e6f4f0", color: "#085041" });
  }
  if (service.reserva_inmediata) {
    tags.push({ text: "Reserva inmediata ⚡", light: "#fdf3e3", color: "#92400e" });
  }
  return tags;
}

function getInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function getFreeCancelDeadline(serviceStartAt, policyKey) {
  if (!serviceStartAt) return null;
  const key = normalizeCancelPolicy(policyKey);
  const deadline = new Date(serviceStartAt);
  if (key === "flexible") {
    deadline.setHours(deadline.getHours() - 24);
  } else if (key === "moderada") {
    deadline.setDate(deadline.getDate() - 3);
  } else if (key === "estricta") {
    deadline.setDate(deadline.getDate() - 7);
  } else {
    return null;
  }
  return deadline;
}

function formatCancelDeadline(date, t) {
  if (!date) return null;
  const d = date.getDate();
  const months = t
    ? t.reservar.mesesLargos
    : ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d} de ${months[date.getMonth()]}`;
}

function StarRating({ value, size = 10 }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= rounded ? GOLD : "none"}
          stroke={star <= rounded ? GOLD : "#ddd"}
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      ))}
    </div>
  );
}

function ServiceTag({ text, light, color, title }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: light, color }}
      title={title}
    >
      {text}
    </span>
  );
}

function ProgressBar({ datesReady, aceptaPolitica, precioListo, t }) {
  const steps = [
    { id: 1, label: t ? t.reservar.pasoFechas : "Elige fechas" },
    { id: 2, label: t ? t.reservar.pasoConfirma : "Confirma" },
    { id: 3, label: t ? t.reservar.pasoPaga : "Paga" },
  ];

  function getStepStatus(stepId) {
    if (stepId === 1) {
      if (datesReady) return "completed";
      return "active";
    }
    if (stepId === 2) {
      if (aceptaPolitica && datesReady) return "completed";
      if (datesReady) return "active";
      return "pending";
    }
    if (stepId === 3) {
      if (precioListo && aceptaPolitica && datesReady) return "active";
      if (aceptaPolitica && datesReady) return "active";
      return "pending";
    }
    return "pending";
  }

  return (
    <div
      className="border-b bg-white"
      style={{ borderColor: "#e8e4de", padding: "16px 24px" }}
    >
      <div className="mx-auto flex max-w-[1100px] items-center justify-center overflow-x-auto px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          const isLast = index === steps.length - 1;
          return (
            <div key={step.id} className="flex shrink-0 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className="flex h-9 w-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[11px] font-semibold sm:h-7 sm:w-7 sm:min-h-0 sm:min-w-0"
                  style={
                    status === "completed"
                      ? { backgroundColor: "#1d4f91", color: "#fff" }
                      : status === "active"
                        ? {
                            backgroundColor: "#1d4f91",
                            color: "#fff",
                            boxShadow: "0 0 0 4px rgba(29,79,145,.2)",
                          }
                        : {
                            backgroundColor: "#f7f5f2",
                            border: "1px solid #e8e4de",
                            color: "#bbb",
                          }
                  }
                >
                  {status === "completed" ? "✓" : step.id}
                </div>
                <span
                  className="hidden text-[10px] font-medium sm:block"
                  style={{ color: status === "pending" ? "#bbb" : "#1d4f91" }}
                >
                  {step.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className="mx-2 h-px w-8 sm:mx-3 sm:w-16 md:w-24"
                  style={{
                    backgroundColor: status === "completed" ? "#1d4f91" : "#e8e4de",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ number, title }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
        style={{ backgroundColor: "#1d4f91" }}
      >
        {number}
      </span>
      <h2
        className="text-[14px] font-semibold text-[#1a1a1a]"
        style={{ fontFamily: SERIF }}
      >
        {title}
      </h2>
    </div>
  );
}

function getCardBrandLabel(brand) {
  const labels = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
  };
  return labels[brand] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Tarjeta");
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
  t,
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

    let createdPiId = null;
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
        throw Object.assign(
          new Error(intentData.error || "No se pudo procesar el pago."),
          intentData,
        );
      }

      createdPiId = intentData.paymentIntentId || null;

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe no está disponible.");
      }

      const { error: confirmError, paymentIntent } =
        await stripe.confirmCardPayment(intentData.clientSecret, {
          payment_method: paymentMethod.id,
        });

      if (confirmError) {
        await cancelOrphanPaymentIntent(
          createdPiId || intentData.paymentIntentId,
        );
        createdPiId = null;
        throw confirmError;
      }

      const confirmedId = paymentIntent?.id || intentData.paymentIntentId;
      try {
        await onPaymentSuccess(confirmedId);
      } catch (completeErr) {
        await cancelOrphanPaymentIntent(confirmedId);
        createdPiId = null;
        throw completeErr;
      }
    } catch (err) {
      if (createdPiId) {
        await cancelOrphanPaymentIntent(createdPiId);
      }
      setError(friendlyStripePaymentError(err));
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
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <p className="mt-1 text-[12px] text-red-600/90">
            {t ? t.reservar.tusFechasDatos : "Tus fechas y datos se mantienen. Puedes reintentar el pago."}
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={paying || disabled}
        onClick={handlePayWithSaved}
        className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
      >
        {paying
          ? (t ? t.reservar.procesandoPago : "Procesando pago…")
          : error
            ? (t ? t.reservar.reintentarPago(precioTotal.toFixed(2)) : `Reintentar pago · ${precioTotal.toFixed(2)}€ →`)
            : (t ? t.reservar.pagarPrecio(precioTotal.toFixed(2)) : `Pagar ${precioTotal.toFixed(2)}€ →`)}
      </button>
      <button
        type="button"
        onClick={onUseNewCard}
        className="mt-3 w-full text-center text-sm font-medium no-underline hover:underline"
        style={{ color: BRAND.primary }}
      >
        {t ? t.reservar.usarOtraTarjeta : "Usar otra tarjeta"}
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
  onNeedNewPaymentIntent,
  vertical,
  fechaInicio,
  hora,
  setErrorMessage,
  service,
  disabled,
  t,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (service?.vertical === "ninos") {
      if (!hora || hora.trim() === "") {
        setErrorMessage(t ? t.reservar.seleccionaHoraValida : "Por favor selecciona una hora válida");
        return;
      }
      const hoyStr = new Date().toISOString().split("T")[0];
      if (fechaInicio === hoyStr) {
        const [h, m] = hora.split(":").map(Number);
        const minutosSeleccionados = h * 60 + m;
        const ahora = new Date();
        const minutosActuales = ahora.getHours() * 60 + ahora.getMinutes();
        if (minutosSeleccionados <= minutosActuales) {
          setErrorMessage(t ? t.reservar.errHoraPasadaForm(hora) : `La hora ${hora} ya ha pasado. Elige una hora futura.`);
          return;
        }
      }
    }

    const dateError = validateBookingDates(vertical, fechaInicio, hora, t);
    if (dateError) {
      setErrorMessage(dateError);
      return;
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fechaInicioDate = new Date(fechaInicio);

    if (fechaInicioDate < hoy) {
      setErrorMessage(t ? t.reservar.errFechaEnPasado : "La fecha de inicio no puede ser en el pasado");
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
          const horaMinStr = `${String(horaMinima.getHours()).padStart(2, "0")}:${String(horaMinima.getMinutes()).padStart(2, "0")}`;
          setErrorMessage(
            t ? t.reservar.errHoraMinima(horaMinStr) : `La hora debe ser al menos 1 hora desde ahora. Hora minima: ${horaMinStr}`,
          );
          return;
        }
      }
    }

    if (!stripe || !elements) return;
    if (!paymentIntentId) {
      const msg = t ? t.reservar.pagoNoListo : "El pago aún no está listo. Espera un momento o recarga la página.";
      setError(msg);
      setErrorMessage(msg);
      return;
    }

    setPaying(true);
    setError("");
    setErrorMessage("");

    // Reutiliza el PI ya montado en Elements (no crear otro al reintentar).
    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });

    if (confirmError) {
      const msg = friendlyStripePaymentError(confirmError);
      setError(msg);
      setErrorMessage(msg);
      setPaying(false);
      // Tras ciertos fallos el PI queda inutilizable → pedir uno nuevo.
      const unrecoverable =
        confirmError.code === "payment_intent_unexpected_state" ||
        confirmError.type === "invalid_request_error";
      if (unrecoverable) {
        await cancelOrphanPaymentIntent(paymentIntentId);
        onNeedNewPaymentIntent?.();
      }
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
      // Pago retenido pero reserva no creada → cancelar hold y regenerar PI.
      await cancelOrphanPaymentIntent(confirmedId);
      const detail =
        typeof err?.message === "string" &&
        err.message &&
        !/payment_intent|client_secret|stripe\.com/i.test(err.message)
          ? err.message
          : null;
      const msg = detail
        ? `No se pudo guardar la reserva (${detail}). Hemos liberado la retención: puedes reintentar el pago; tus datos se mantienen.`
        : "El pago se retuvo pero no se pudo guardar la reserva. Hemos liberado la retención: reintenta el pago; tus datos se mantienen.";
      setError(msg);
      setErrorMessage(msg);
      onNeedNewPaymentIntent?.();
    } finally {
      setPaying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <PaymentElement />
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <p className="mt-1 text-[12px] text-red-600/90">
            {t ? t.reservar.tusFechasServicioDatos : "Tus fechas, servicio y datos se mantienen. Puedes reintentar sin empezar de cero."}
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || paying || disabled}
        className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
      >
        {paying
          ? (t ? t.reservar.procesandoPago : "Procesando pago…")
          : error
            ? (t ? t.reservar.reintentarPago(precioTotal.toFixed(2)) : `Reintentar pago · ${precioTotal.toFixed(2)}€ →`)
            : (t ? t.reservar.pagarPrecio(precioTotal.toFixed(2)) : `Pagar ${precioTotal.toFixed(2)}€ →`)}
      </button>
    </form>
  );
}

function BundleSavedCardCheckout({
  priceSummary,
  creditoAplicado,
  totalAPagar,
  paymentMethod,
  stripeCustomerId,
  userId,
  grupoReserva,
  onComplete,
  onUseNewCard,
  getBookingDateError,
  disabled,
  t,
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

    if (!grupoReserva) {
      setError(t ? t.reservar.datosIncompletosRecarga : "Datos de reserva incompletos. Recarga la página e inténtalo de nuevo.");
      setPaying(false);
      return;
    }

    const plan = buildPaymentPlan(priceSummary, creditoAplicado);
    const planError = validateBundlePaymentPlan(plan);
    if (planError) {
      setError(planError);
      setPaying(false);
      return;
    }

    const needsPiItems = plan.filter((item) => item.needsPi);

    try {
      if (needsPiItems.length === 0) {
        await onComplete(
          plan.map((item) => ({
            service_id: item.service_id,
            payment_intent_id: null,
          })),
        );
        return;
      }

      const created = [];
      for (const item of needsPiItems) {
        const data = await createServicePaymentIntent({
          amount: item.tarjeta,
          serviceId: item.service_id,
          clienteId: userId,
          grupoReserva,
          customer: stripeCustomerId,
          paymentMethod: paymentMethod.id,
          confirmSaved: true,
        });
        created.push({
          service_id: item.service_id,
          paymentIntentId: data.paymentIntentId,
          clientSecret: data.clientSecret,
        });
      }

      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error("Stripe no está disponible.");
      }

      const confirmedIds = [];
      try {
        for (const item of created) {
          const { error: confirmError, paymentIntent } =
            await stripe.confirmCardPayment(item.clientSecret, {
              payment_method: paymentMethod.id,
            });

          if (confirmError) {
            throw confirmError;
          }

          confirmedIds.push(paymentIntent?.id || item.paymentIntentId);
        }

        try {
          await onComplete(paymentsPayloadFromPlan(plan, created));
        } catch (completeErr) {
          await rollbackBundlePaymentIntents(confirmedIds);
          throw completeErr;
        }
      } catch (confirmErr) {
        await rollbackBundlePaymentIntents(
          created.map((item) => item.paymentIntentId),
        );
        throw confirmErr;
      }
    } catch (err) {
      setError(friendlyStripePaymentError(err));
    } finally {
      setPaying(false);
    }
  }

  const retencionesCount = buildPaymentPlan(priceSummary, creditoAplicado).filter(
    (item) => item.needsPi,
  ).length;

  return (
    <div className="mt-6">
      <p className="text-[11px] leading-relaxed text-[#666]">
        {retencionesCount > 1
          ? (t ? t.reservar.nRetencionesEnTarjeta(retencionesCount) : `${retencionesCount} retenciones en tarjeta, una por servicio.`)
          : (t ? t.reservar.retencionTarjeta : "Retención en tarjeta por servicio.")}
      </p>
      <div
        className="mt-3 rounded-xl border px-4 py-4"
        style={{ borderColor: BRAND.border, backgroundColor: BRAND.light }}
      >
        <p className="text-sm font-semibold text-[#1a1a1a]">
          {getCardBrandLabel(paymentMethod.card?.brand)} ····{" "}
          {paymentMethod.card?.last4}
        </p>
      </div>
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <p className="mt-1 text-[12px] text-red-600/90">
            {t ? t.reservar.tusServiciosFechas : "Tus servicios y fechas se mantienen. Puedes reintentar el pago."}
          </p>
        </div>
      )}
      <button
        type="button"
        disabled={paying || disabled}
        onClick={handlePayWithSaved}
        className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
      >
        {paying
          ? (t ? t.reservar.procesandoPago : "Procesando pago…")
          : error
            ? (t ? t.reservar.reintentarPago(totalAPagar.toFixed(2)) : `Reintentar pago · ${totalAPagar.toFixed(2)}€ →`)
            : (t ? t.reservar.pagarPrecio(totalAPagar.toFixed(2)) : `Pagar ${totalAPagar.toFixed(2)}€ →`)}
      </button>
      <button
        type="button"
        onClick={onUseNewCard}
        className="mt-3 w-full text-center text-sm font-medium no-underline hover:underline"
        style={{ color: BRAND.primary }}
      >
        {t ? t.reservar.usarOtraTarjeta : "Usar otra tarjeta"}
      </button>
    </div>
  );
}

function BundleNewCardCheckoutForm({
  priceSummary,
  creditoAplicado,
  totalAPagar,
  userId,
  grupoReserva,
  stripeCustomerId,
  setStripeCustomerId,
  userEmail,
  clienteNombre,
  onComplete,
  vertical,
  fechaInicio,
  hora,
  setErrorMessage,
  service,
  disabled,
  t,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (service?.vertical === "ninos") {
      if (!hora || hora.trim() === "") {
        setErrorMessage(t ? t.reservar.seleccionaHoraValida : "Por favor selecciona una hora válida");
        return;
      }
    }

    const dateError = validateBookingDates(vertical, fechaInicio, hora, t);
    if (dateError) {
      setErrorMessage(dateError);
      return;
    }

    if (!grupoReserva) {
      setErrorMessage(t ? t.reservar.datosIncompletosRecarga : "Datos de reserva incompletos. Recarga la página e inténtalo de nuevo.");
      return;
    }

    if (!stripe || !elements) return;

    const plan = buildPaymentPlan(priceSummary, creditoAplicado);
    const planError = validateBundlePaymentPlan(plan);
    if (planError) {
      setErrorMessage(planError);
      return;
    }

    const needsPiItems = plan.filter((item) => item.needsPi);

    setPaying(true);
    setErrorMessage("");
    setError("");

    try {
      if (needsPiItems.length === 0) {
        await onComplete(
          plan.map((item) => ({
            service_id: item.service_id,
            payment_intent_id: null,
          })),
        );
        return;
      }

      const { error: submitError } = await elements.submit();
      if (submitError) {
        throw new Error(submitError.message);
      }

      const customerId = await ensureStripeCustomer({
        stripeCustomerId,
        userEmail,
        clienteNombre,
        userId,
        onCustomerId: setStripeCustomerId,
      });

      const created = [];
      for (let i = 0; i < needsPiItems.length; i++) {
        const item = needsPiItems[i];
        const data = await createServicePaymentIntent({
          amount: item.tarjeta,
          serviceId: item.service_id,
          clienteId: userId,
          grupoReserva,
          customer: customerId,
          setupFutureUsage: i === 0 ? "off_session" : undefined,
        });
        created.push({
          service_id: item.service_id,
          paymentIntentId: data.paymentIntentId,
          clientSecret: data.clientSecret,
        });
      }

      const confirmedIds = [];
      let paymentMethodId = null;

      try {
        const first = created[0];
        const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret: first.clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/dashboard`,
          },
          redirect: "if_required",
        });

        if (confirmError) {
          throw confirmError;
        }

        confirmedIds.push(paymentIntent?.id || first.paymentIntentId);
        paymentMethodId = extractPaymentMethodId(paymentIntent);

        await attachPaymentMethodToCustomer({
          paymentMethodId,
          stripeCustomerId: customerId,
          userEmail,
          clienteNombre,
          userId,
        });

        for (let i = 1; i < created.length; i++) {
          const item = created[i];
          const { error: cardError, paymentIntent: pi } =
            await stripe.confirmCardPayment(item.clientSecret, {
              payment_method: paymentMethodId,
            });

          if (cardError) {
            throw cardError;
          }

          confirmedIds.push(pi?.id || item.paymentIntentId);
        }

        try {
          await onComplete(paymentsPayloadFromPlan(plan, created));
        } catch (completeErr) {
          await rollbackBundlePaymentIntents(
            created.map((item) => item.paymentIntentId),
          );
          throw completeErr;
        }
      } catch (confirmErr) {
        await rollbackBundlePaymentIntents(
          created.map((item) => item.paymentIntentId),
        );
        throw confirmErr;
      }
    } catch (err) {
      const msg = friendlyStripePaymentError(err);
      setErrorMessage(msg);
      setError(msg);
    } finally {
      setPaying(false);
    }
  }

  const retencionesCount = buildPaymentPlan(priceSummary, creditoAplicado).filter(
    (item) => item.needsPi,
  ).length;

  return (
    <form onSubmit={handleSubmit} className="mt-6">
      <p className="mb-3 text-[11px] leading-relaxed text-[#666]">
        {retencionesCount > 1
          ? (t ? t.reservar.nRetencionesEnTarjeta(retencionesCount) : `${retencionesCount} retenciones en tarjeta, una por servicio.`)
          : (t ? t.reservar.retencionTarjeta : "Retención en tarjeta por servicio.")}
      </p>
      <PaymentElement />
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          <p className="mt-1 text-[12px] text-red-600/90">
            {t ? t.reservar.tusServiciosFechas : "Tus servicios y fechas se mantienen. Puedes reintentar el pago."}
          </p>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || paying || disabled}
        className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
      >
        {paying
          ? (t ? t.reservar.procesandoPago : "Procesando pago…")
          : error
            ? (t ? t.reservar.reintentarPago(totalAPagar.toFixed(2)) : `Reintentar pago · ${totalAPagar.toFixed(2)}€ →`)
            : (t ? t.reservar.pagarPrecio(totalAPagar.toFixed(2)) : `Pagar ${totalAPagar.toFixed(2)}€ →`)}
      </button>
    </form>
  );
}

function BundleNewCardCheckout(props) {
  const deferredAmountCents = Math.max(Math.round(props.totalAPagar * 100), 50);

  return (
    <Elements
      stripe={stripePromise}
      options={{
        mode: "payment",
        amount: deferredAmountCents,
        currency: "eur",
        captureMethod: "manual",
        setupFutureUsage: "off_session",
      }}
    >
      <BundleNewCardCheckoutForm {...props} t={props.t} />
    </Elements>
  );
}

export default function ReservarPage() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const serviceId = params.serviceId;
  // Oferta de chat vía ?precio_especial= ya no afecta al cobro (F1: solo BD).
  const cancelarBookingId = searchParams.get("cancelar_booking");

  const [loading, setLoading] = useState(true);
  const [service, setService] = useState(null);
  const [complementaryServices, setComplementaryServices] = useState([]);
  const [bundleServices, setBundleServices] = useState([]);
  /** Paso 2b: datos + precio por servicio (modalidades + campos de reserva). */
  const [cartByServiceId, setCartByServiceId] = useState({});
  const [mainServiceId, setMainServiceId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [perfilCliente, setPerfilCliente] = useState(null);
  /**
   * Campos flat del MAIN = espejo UI de cartByServiceId[main].
   * Fuente de verdad para precio/pago/disponibilidad por línea: cartByServiceId.
   * Estos states alimentan el formulario del servicio de la URL y se sincronizan
   * hacia cart[main] (no al revés salvo restore desde sessionStorage).
   */
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [hora, setHora] = useState("");
  const [duracionHoras, setDuracionHoras] = useState("");
  const [modalidadCobro, setModalidadCobro] = useState(null);
  const [numHuespedes, setNumHuespedes] = useState(null);
  const [lugarServicio, setLugarServicio] = useState(null);
  const [direccionCliente, setDireccionCliente] = useState("");
  const [direccionClienteADefinir, setDireccionClienteADefinir] =
    useState(null);
  const [mensaje, setMensaje] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [successVariant, setSuccessVariant] = useState("green");
  const [errorMessage, setErrorMessage] = useState("");
  const [unavailableMessage, setUnavailableMessage] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  /** Fuerza recrear el PI de Elements tras fallo irrecuperable. */
  const [paymentRetryKey, setPaymentRetryKey] = useState(0);
  const paymentFinalizedRef = useRef(false);
  const activePaymentIntentIdRef = useRef(null);
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
  /** Paso 1 datos obligatorios: borrador si falta profiles.telefono */
  const [telefonoDraft, setTelefonoDraft] = useState("");
  const [telefonoSaving, setTelefonoSaving] = useState(false);
  const [telefonoSaveError, setTelefonoSaveError] = useState("");
  const [disponibilidadChecking, setDisponibilidadChecking] = useState(false);
  const [tarifasPorServicio, setTarifasPorServicio] = useState({});
  const [tarifasLoading, setTarifasLoading] = useState(false);
  const [calendarioError, setCalendarioError] = useState("");
  /** Fechas bloqueadas por service_id (calendario de cada línea). */
  const [fechasOcupadasByServiceId, setFechasOcupadasByServiceId] = useState(
    {},
  );
  const [calendarOpen, setCalendarOpen] = useState(false);
  /** Calendario abierto en un bloque complementario (serviceId). */
  const [cartCalendarOpenId, setCartCalendarOpenId] = useState(null);
  const [bundleTab, setBundleTab] = useState("alojamiento");
  const [tabServices, setTabServices] = useState([]);
  const [tabServicesLoading, setTabServicesLoading] = useState(false);
  const [providerAvgRating, setProviderAvgRating] = useState(null);
  const [providerReviewCount, setProviderReviewCount] = useState(0);
  const [tabReviewsMap, setTabReviewsMap] = useState({});
  const [filteredComplementary, setFilteredComplementary] = useState([]);
  const bundleDatesAppliedRef = useRef(false);
  const bundleAddedMsgTimerRef = useRef(null);
  /** Paso 2d: evita que load() pise carrito restaurado de sessionStorage. */
  const cartHydratedRef = useRef(false);
  const bundleRestoredRef = useRef(false);
  const bundlePersistRef = useRef(null);
  /** Snapshot siempre fresco para el persister (evita closure stale). */
  const latestBundleSnapshotRef = useRef(null);

  useEffect(() => {
    return () => {
      if (bundleAddedMsgTimerRef.current) {
        clearTimeout(bundleAddedMsgTimerRef.current);
      }
      bundlePersistRef.current?.dispose();
    };
  }, []);

  const bundleStateSetters = useMemo(
    () => ({
      setFechaInicio,
      setFechaFin,
      setHora,
      setDuracionHoras,
      setModalidadCobro,
      setNumHuespedes,
      setLugarServicio,
      setDireccionCliente,
      setDireccionClienteADefinir,
      setMensaje,
      setAceptaPolitica,
      setBundleServices,
      setCartByServiceId,
      setMainServiceId,
      bundleDatesAppliedRef,
    }),
    [],
  );

  function tryRestoreBundleFromSession() {
    const restored = restoreBundleStateFromSession(serviceId, bundleStateSetters);
    if (restored) {
      cartHydratedRef.current = true;
      bundleRestoredRef.current = true;
    }
    return restored;
  }

  // Restaurar carrito al montar (F5 o volver de /buscar).
  useEffect(() => {
    tryRestoreBundleFromSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar / serviceId
  }, [serviceId]);

  // bfcache: botón atrás del navegador puede restaurar snapshot React viejo.
  useEffect(() => {
    function onPageShow(event) {
      if (!event.persisted) return;
      tryRestoreBundleFromSession();
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  // Persistir carrito en sessionStorage (F5 + navegación a buscar).
  useEffect(() => {
    if (!serviceId || loading || !service?.id) return;

    latestBundleSnapshotRef.current = buildBundleStateSnapshot({
      origenServiceId: serviceId,
      mainServiceId: mainServiceId || serviceId,
      bundleServices,
      cartByServiceId,
      fechaInicio,
      fechaFin,
      hora,
      duracionHoras,
      modalidadCobro,
      numHuespedes,
      lugarServicio,
      direccionCliente,
      direccionClienteADefinir,
      mensaje,
      aceptaPolitica,
    });

    if (!bundlePersistRef.current) {
      bundlePersistRef.current = createBundleStatePersister(
        () => latestBundleSnapshotRef.current,
      );
    }

    bundlePersistRef.current.schedulePersist();

    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        bundlePersistRef.current?.flushPersist();
      }
    }
    window.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [
    serviceId,
    loading,
    service?.id,
    mainServiceId,
    bundleServices,
    cartByServiceId,
    fechaInicio,
    fechaFin,
    hora,
    duracionHoras,
    modalidadCobro,
    numHuespedes,
    lugarServicio,
    direccionCliente,
    direccionClienteADefinir,
    mensaje,
    aceptaPolitica,
  ]);

  useEffect(() => {
    if (bundleDatesAppliedRef.current) return;

    const parsedDesde = parseInheritedSearchDate(searchParams.get("desde"));
    if (!parsedDesde) return;

    const parsedHasta = parseInheritedSearchDate(searchParams.get("hasta"));
    setFechaInicio(parsedDesde);
    if (parsedHasta && parsedHasta >= parsedDesde) {
      setFechaFin(parsedHasta);
    }
  }, [searchParams]);

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
        .select(
          "nombre, apellido, telefono, stripe_customer_id, reservas_sin_comision_cliente, credito_disponible, doc_dni_url, dni_estado",
        )
        .eq("id", user.id)
        .single();

      setPerfilCliente(perfilClienteData);
      if (perfilClienteData?.telefono) {
        setTelefonoDraft(String(perfilClienteData.telefono));
      }

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
        .select(RESERVAR_MAIN_SERVICE_SELECT)
        .eq("id", serviceId)
        .single();

      if (error || !data) {
        setErrorMessage(t?.reservar?.servicioNoEncontrado ?? "No se encontró el servicio.");
        setLoading(false);
        return;
      }

      const bookabilityIssue = getServiceBookabilityIssue(data);
      if (bookabilityIssue) {
        setUnavailableMessage(bookabilityIssue);
        setLoading(false);
        return;
      }

      setService(data);

      // Modalidades de cobro (niñera/mascotas)
      let serviceWithMods = data;
      const hadPersistedCart = cartHydratedRef.current;

      if (supportsModalidadCobro(data.vertical)) {
        const { data: modRows } = await supabase
          .from("service_modalidades")
          .select(SERVICE_MODALIDADES_SELECT)
          .eq("service_id", data.id);
        serviceWithMods = { ...data, modalidades: modRows ?? [] };
        setService(serviceWithMods);
        if (!hadPersistedCart) {
          const rows = modRows ?? [];
          if (rows.length === 1) {
            setModalidadCobro(rows[0].modalidad);
          } else if (rows.length > 1) {
            setModalidadCobro(null);
          } else {
            setModalidadCobro(null);
          }
        }
      } else {
        setService(serviceWithMods);
        if (!hadPersistedCart) {
          setModalidadCobro(null);
        }
      }

      const mainNumHuespedes = defaultNumHuespedesFromService(serviceWithMods);
      if (!hadPersistedCart) {
        if (mainNumHuespedes != null) {
          setNumHuespedes(mainNumHuespedes);
        } else {
          setNumHuespedes(null);
        }
        const lugarInit = initialLugarServicio(
          serviceWithMods.modalidad,
          serviceWithMods.vertical,
        );
        setLugarServicio(lugarInit);
        setDireccionCliente("");
        setDireccionClienteADefinir(
          lugarInit === LUGAR_CASA_CLIENTE ? true : null,
        );
      }

      setMainServiceId(serviceWithMods.id);

      // Entrada de carrito del main: no pisar líneas restauradas (Paso 2d).
      setCartByServiceId((prev) => {
        const existing = prev[serviceWithMods.id];
        if (hadPersistedCart && existing) {
          return {
            ...prev,
            [serviceWithMods.id]: buildCartEntry(serviceWithMods, {
              ...existing,
              service: {
                ...serviceWithMods,
                modalidades:
                  serviceWithMods.modalidades ??
                  existing.service?.modalidades ??
                  [],
              },
            }),
          };
        }
        return {
          ...prev,
          [serviceWithMods.id]: buildCartEntry(serviceWithMods, {
            ...(existing || emptyCartBookingFields()),
            modalidadCobro: defaultModalidadCobroFromService(serviceWithMods),
            numHuespedes: mainNumHuespedes,
          }),
        };
      });

      const { data: ratings } = await supabase
        .from("reviews")
        .select("valoracion, cliente_id")
        .eq("proveedor_id", data.proveedor_id);

      const { computeProveedorRating, formatProveedorRatingAvg } = await import(
        "@/app/lib/reviews"
      );
      const ratingAgg = computeProveedorRating(ratings);
      setProviderReviewCount(ratingAgg.count);
      const avgFmt = formatProveedorRatingAvg(ratingAgg);
      if (avgFmt) setProviderAvgRating(avgFmt);

      const complementaryVerticals =
        COMPLEMENTARY_VERTICALS[data.vertical] ?? [];
      const city = data.ciudad?.trim();
      const defaultTab =
        complementaryVerticals[0] ?? "alojamiento";
      setBundleTab(defaultTab);

      if (city && complementaryVerticals.length > 0) {
        const suggestions = [];

        for (const compVertical of complementaryVerticals) {
          const { data: compData } = await supabase
            .from("services")
            .select(RESERVAR_SERVICE_SELECT)
            .eq("disponible", true)
            .eq("profiles_public.verificado", true)
            .eq("profiles_public.cobros_activos", true)
            .eq("vertical", compVertical)
            .ilike("ciudad", `%${city}%`)
            .neq("id", data.id)
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

  useEffect(() => {
    const bundleAddId = searchParams.get("bundle_add");
    if (!bundleAddId || loading || !service || !userId) return;

    async function addBundleFromUrl() {
      if (bundleAddId === service.id) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("bundle_add");
        const query = params.toString();
        router.replace(
          query ? `/reservar/${serviceId}?${query}` : `/reservar/${serviceId}`,
          { scroll: false },
        );
        return;
      }

      const { data, error } = await supabase
        .from("services")
        .select(RESERVAR_SERVICE_SELECT)
        .eq("id", bundleAddId)
        .single();

      const params = new URLSearchParams(searchParams.toString());
      params.delete("bundle_add");
      const query = params.toString();
      router.replace(
        query ? `/reservar/${serviceId}?${query}` : `/reservar/${serviceId}`,
        { scroll: false },
      );

      if (error || !data) return;

      const bundleIssue = getServiceBookabilityIssue(data);
      if (bundleIssue) {
        setErrorMessage(bundleIssue);
        return;
      }

      if (!isServiceBookable(data)) return;

      // Una sola vertical por carrito (no dos niñeras / dos alojamientos).
      if (
        data.vertical &&
        (data.vertical === service.vertical ||
          bundleServices.some((s) => s.vertical === data.vertical))
      ) {
        setErrorMessage(
          t?.reservar?.errMismoTipoEnCarrito ?? "Ya tienes un servicio de este tipo en el carrito. Elige otra vertical.",
        );
        return;
      }

      // bundleServices sin modalidades → precio/UI igual que hoy (retrocompat 2a).
      // cartByServiceId sí guarda modalidades para el paso 2b.
      const withMods = await loadServiceWithModalidades(data);
      setBundleServices((prev) =>
        prev.some((s) => s.id === data.id) ? prev : [...prev, data],
      );
      setCartByServiceId((prev) => ({
        ...prev,
        [withMods.id]: buildCartEntry(withMods, {
          // Prefill editable: fechas del main como sugerencia (el cliente puede cambiarlas).
          ...suggestedBookingFieldsFromMain(
            { fechaInicio, fechaFin },
            withMods,
          ),
        }),
      }));
      const nombreServicio =
        data.titulo ||
        `${verticals[data.vertical]?.label ?? "Servicio"} · ${formatShortName(data.profiles_public?.nombre, data.profiles_public?.apellido)}`;
      // Aviso temporal: no bloquea el botón de pagar (disabled no depende de successMessage).
      setSuccessVariant("green");
      setSuccessMessage(t?.reservar?.anadidoConfirmacion
        ? t.reservar.anadidoConfirmacion(nombreServicio)
        : `✓ ${nombreServicio} añadido a tu reserva`);
      if (bundleAddedMsgTimerRef.current) {
        clearTimeout(bundleAddedMsgTimerRef.current);
      }
      bundleAddedMsgTimerRef.current = setTimeout(() => {
        setSuccessMessage("");
        bundleAddedMsgTimerRef.current = null;
      }, 4000);
    }

    addBundleFromUrl();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fechas del main solo como prefill al añadir
  }, [searchParams, loading, service, userId, serviceId, router]);

  useEffect(() => {
    if (!cancelarBookingId || !userId || loading) return;

    async function ejecutarCancelacionGarantia() {
      const res = await fetch("/api/bookings/cancelar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: cancelarBookingId }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setErrorMessage(data.error || "No se pudo cancelar la reserva.");
        return;
      }

      router.replace("/dashboard");
    }

    ejecutarCancelacionGarantia();
  }, [cancelarBookingId, userId, loading, router]);

  const vertical = service?.vertical ?? "alojamiento";
  const cancelPolicies = useMemo(() => getCancelPoliciesT(t), [t]);
  const verticals = useMemo(() => getVerticalsT(t), [t]);
  const verticalConfig = verticals[vertical] ?? verticals.alojamiento;

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
  const profile = service?.profiles_public ?? {};
  const unitPrice = Number(service?.precio) || 0;
  // Ofertas de chat (query precio_especial) NO rebajan el cobro: no hay fila en BD.
  // Solo se aplican ofertas de services.oferta_descuento vía getPrecioEfectivo / calculateServiceBasePrice.
  const precioEfectivo = service ? getPrecioEfectivo(service) : 0;
  const ofertaActiva = service ? isOfertaActiva(service) : false;
  const cancelPolicy = getCancelPolicy(service?.cancellation_policy, cancelPolicies);

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

  const allBundleCandidates = useMemo(() => {
    const map = new Map();
    [...complementaryServices, ...tabServices, ...filteredComplementary].forEach(
      (s) => map.set(s.id, s),
    );
    return Array.from(map.values());
  }, [complementaryServices, tabServices, filteredComplementary]);

  const selectedServices = useMemo(
    () => (service ? [service, ...bundleServices] : []),
    [service, bundleServices],
  );

  // Paso 2b: sincronizar SOLO el main (UI flat → cart). Las líneas complementarias
  // tienen sus propios campos y ya no se sobrescriben con las fechas del main.
  useEffect(() => {
    if (!service?.id) return;
    setCartByServiceId((prev) => {
      const mainEntry = prev[service.id];
      const nextService = {
        ...service,
        modalidades:
          service.modalidades ?? mainEntry?.service?.modalidades ?? [],
      };
      const nextMain = buildCartEntry(nextService, {
        fechaInicio,
        fechaFin,
        hora,
        duracionHoras,
        modalidadCobro,
        numHuespedes,
        lugarServicio,
        direccionCliente,
        direccionClienteADefinir,
      });
      if (
        mainEntry &&
        mainEntry.fechaInicio === nextMain.fechaInicio &&
        mainEntry.fechaFin === nextMain.fechaFin &&
        mainEntry.hora === nextMain.hora &&
        mainEntry.duracionHoras === nextMain.duracionHoras &&
        mainEntry.modalidadCobro === nextMain.modalidadCobro &&
        mainEntry.numHuespedes === nextMain.numHuespedes &&
        mainEntry.lugarServicio === nextMain.lugarServicio &&
        mainEntry.direccionCliente === nextMain.direccionCliente &&
        mainEntry.direccionClienteADefinir ===
          nextMain.direccionClienteADefinir &&
        mainEntry.service === nextService
      ) {
        return prev;
      }
      return { ...prev, [service.id]: nextMain };
    });
  }, [
    service,
    fechaInicio,
    fechaFin,
    hora,
    duracionHoras,
    modalidadCobro,
    numHuespedes,
    lugarServicio,
    direccionCliente,
    direccionClienteADefinir,
  ]);

  // Paso 2a: si hay servicios en el carrito sin modalidades cargadas, hidratarlas.
  useEffect(() => {
    let cancelled = false;
    async function hydrateMissingModalidades() {
      const entries = Object.values(cartByServiceId);
      const needing = entries.filter((e) => {
        const svc = e?.service;
        if (!svc?.id) return false;
        if (!supportsModalidadCobro(svc.vertical)) return false;
        return !Array.isArray(svc.modalidades);
      });
      if (needing.length === 0) return;

      const updates = await Promise.all(
        needing.map(async (e) => {
          const withMods = await loadServiceWithModalidades(e.service);
          return [withMods.id, withMods];
        }),
      );
      if (cancelled) return;
      setCartByServiceId((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const [id, withMods] of updates) {
          if (!next[id]) continue;
          if (Array.isArray(next[id].service?.modalidades)) continue;
          next[id] = {
            ...next[id],
            service: withMods,
            modalidadCobro:
              next[id].modalidadCobro ??
              defaultModalidadCobroFromService(withMods),
            numHuespedes:
              next[id].numHuespedes ??
              defaultNumHuespedesFromService(withMods),
          };
          changed = true;
        }
        return changed ? next : prev;
      });
    }
    hydrateMissingModalidades();
    return () => {
      cancelled = true;
    };
  }, [cartByServiceId]);

  // Asegurar entrada de carrito al restaurar bundleServices desde sessionStorage.
  useEffect(() => {
    if (!service?.id || bundleServices.length === 0) return;
    let cancelled = false;
    async function ensureBundleCartEntries() {
      const missing = bundleServices.filter((s) => !cartByServiceId[s.id]);
      if (missing.length === 0) return;
      const built = {};
      for (const svc of missing) {
        const withMods = await loadServiceWithModalidades(svc);
        if (cancelled) return;
        built[withMods.id] = buildCartEntry(withMods, {
          ...(cartByServiceId[withMods.id] || emptyCartBookingFields()),
          modalidadCobro:
            cartByServiceId[withMods.id]?.modalidadCobro ??
            defaultModalidadCobroFromService(withMods),
          numHuespedes:
            cartByServiceId[withMods.id]?.numHuespedes ??
            defaultNumHuespedesFromService(withMods),
        });
      }
      if (cancelled || Object.keys(built).length === 0) return;
      setCartByServiceId((prev) => ({ ...prev, ...built }));
    }
    ensureBundleCartEntries();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al cambiar ids del bundle
  }, [service?.id, bundleServices.map((s) => s.id).join(",")]);

  const isBundle = selectedServices.length > 1;

  const selectedServiceIdsKey = useMemo(
    () => selectedServices.map((s) => s.id).join(","),
    [selectedServices],
  );

  // Seguridad: cartByServiceId solo con main + complementarios actuales (sin huérfanos).
  useEffect(() => {
    if (!service?.id) return;
    const keep = new Set(selectedServices.map((s) => s.id).filter(Boolean));
    setCartByServiceId((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => keep.has(k))) return prev;
      const next = {};
      for (const k of keys) {
        if (keep.has(k)) next[k] = prev[k];
      }
      return next;
    });
    setTarifasPorServicio((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => keep.has(k))) return prev;
      const next = {};
      for (const k of keys) {
        if (keep.has(k)) next[k] = prev[k];
      }
      return next;
    });
    setFechasOcupadasByServiceId((prev) => {
      const keys = Object.keys(prev);
      if (keys.every((k) => keep.has(k))) return prev;
      const next = {};
      for (const k of keys) {
        if (keep.has(k)) next[k] = prev[k];
      }
      return next;
    });
  }, [service?.id, selectedServiceIdsKey]);

  /** Clave de fechas por línea (tarifas / disponibilidad por servicio). */
  const cartDatesKey = useMemo(
    () =>
      selectedServices
        .map((s) => {
          const e = cartByServiceId[s.id];
          return `${s.id}:${e?.fechaInicio || ""}:${e?.fechaFin || ""}`;
        })
        .join("|"),
    [selectedServices, cartByServiceId],
  );

  const fechasOcupadas = fechasOcupadasByServiceId[service?.id] ?? [];

  const patchCartEntry = useCallback((serviceId, patch) => {
    setCartByServiceId((prev) => {
      const cur = prev[serviceId];
      if (!cur) return prev;
      return {
        ...prev,
        [serviceId]: { ...cur, ...patch },
      };
    });
  }, []);

  useEffect(() => {
    setAceptaPolitica(false);
  }, [selectedServiceIdsKey]);

  const bookabilityBlock = useMemo(() => {
    for (const svc of selectedServices) {
      const issue = getServiceBookabilityIssue(svc);
      if (issue) return issue;
    }
    return null;
  }, [selectedServices]);

  const clienteNoVerificado = !isClienteVerificado(perfilCliente);
  const clienteSinTelefono = !hasTelefono(perfilCliente);
  const dniRevisionEstado = getDniRevisionEstado(perfilCliente);
  const dniBlockMessage = getClienteReservaDniBlockMessage(perfilCliente);
  const dniSubirHref = useMemo(() => {
    const qs = searchParams?.toString();
    const current = qs ? `${pathname}?${qs}` : pathname;
    return `${DNI_SUBIR_RUTA}?next=${encodeURIComponent(current)}`;
  }, [pathname, searchParams]);
  const showDniUploadLink =
    dniRevisionEstado === "sin_dni" || dniRevisionEstado === "rechazado";

  // Paso 2b: disponibilidad con las fechas DE CADA línea (no las del main).
  useEffect(() => {
    const checks = selectedServices
      .map((svc) => {
        const entry = cartByServiceId[svc.id];
        if (!entry?.fechaInicio) return null;
        return {
          svc,
          inicio: entry.fechaInicio,
          fin: entry.fechaFin || entry.fechaInicio,
        };
      })
      .filter(Boolean);

    if (checks.length === 0) {
      setCalendarioError("");
      setDisponibilidadChecking(false);
      return;
    }

    let cancelled = false;
    setDisponibilidadChecking(true);

    async function checkDisponibilidad() {
      const results = await Promise.all(
        checks.map((c) => verificarDisponibilidad(c.svc.id, c.inicio, c.fin)),
      );
      if (cancelled) return;

      const conflicts = checks.filter((_, i) => !results[i]);
      if (conflicts.length === 0) {
        setCalendarioError("");
      } else {
        const names = conflicts
          .map((c) => {
            const cfg = verticals[c.svc.vertical] ?? verticals.alojamiento;
            return (
              c.svc.titulo ||
              `${cfg.label} · ${formatShortName(c.svc.profiles_public?.nombre, c.svc.profiles_public?.apellido)}`
            );
          })
          .join(", ");
        setCalendarioError(
          `Ya hay una reserva en esas fechas: ${names}. Elige otras fechas.`,
        );
      }
      setDisponibilidadChecking(false);
    }

    checkDisponibilidad();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartDatesKey cubre fechas por línea
  }, [cartDatesKey, selectedServiceIdsKey]);

  // Paso 2b: tarifas por fecha DE CADA servicio con SUS fechas.
  useEffect(() => {
    const jobs = selectedServices
      .map((svc) => {
        const entry = cartByServiceId[svc.id];
        if (!entry?.fechaInicio) return null;
        return {
          id: svc.id,
          fechaInicio: entry.fechaInicio,
          fechaFin: entry.fechaFin || entry.fechaInicio,
        };
      })
      .filter(Boolean);

    if (jobs.length === 0) {
      setTarifasPorServicio({});
      setTarifasLoading(false);
      return;
    }

    let cancelled = false;
    setTarifasLoading(true);

    (async () => {
      try {
        const pairs = await Promise.all(
          jobs.map(async (job) => {
            const map = await cargarTarifasPorFecha(
              supabase,
              job.id,
              job.fechaInicio,
              job.fechaFin,
            );
            return [job.id, map];
          }),
        );
        if (!cancelled) setTarifasPorServicio(Object.fromEntries(pairs));
      } catch {
        if (!cancelled) setTarifasPorServicio({});
      } finally {
        if (!cancelled) setTarifasLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cartDatesKey cubre fechas por línea
  }, [cartDatesKey, selectedServiceIdsKey]);

  // Paso 2b: fechas ocupadas de TODOS los servicios del carrito (calendarios propios).
  useEffect(() => {
    const ids = selectedServices.map((s) => s.id).filter(Boolean);
    if (ids.length === 0) {
      setFechasOcupadasByServiceId({});
      return;
    }

    let cancelled = false;
    async function cargarOcupadas() {
      const pairs = await Promise.all(
        ids.map(async (id) => {
          const { data } = await supabase
            .from("disponibilidad")
            .select("fecha_inicio, fecha_fin")
            .eq("service_id", id);
          return [id, data || []];
        }),
      );
      if (!cancelled) {
        setFechasOcupadasByServiceId(Object.fromEntries(pairs));
      }
    }
    cargarOcupadas();
    return () => {
      cancelled = true;
    };
  }, [selectedServiceIdsKey]);

  // Paso 2b: precio por línea desde cartByServiceId (datos + modalidades + tarifas propias).
  const priceSummary = useMemo(() => {
    if (!service) {
      return {
        lines: [],
        subtotal: 0,
        commission: 0,
        total: 0,
        ready: false,
        detail: t?.reservar?.introduceFechas ?? "Introduce las fechas para calcular el precio",
      };
    }

    const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;
    const lines = selectedServices.map((svc) => {
      const entry = cartByServiceId[svc.id];
      const svcForPrice = entry?.service ?? svc;
      const svcConfig = verticals[svcForPrice.vertical] ?? verticals.alojamiento;
      const name =
        svcForPrice.titulo ||
        `${svcConfig.label} · ${formatShortName(svcForPrice.profiles_public?.nombre, svcForPrice.profiles_public?.apellido)}`;

      if (!entry?.fechaInicio) {
        return {
          id: svc.id,
          name,
          base: 0,
          total: 0,
          detail: t?.reservar?.faltanDatos ?? "Faltan datos",
          ready: false,
          vertical: svcForPrice.vertical,
          discountPct: 0,
          discountSource: null,
          modalidadCobro: entry?.modalidadCobro ?? null,
          duration: 0,
          unitBase: null,
          unitClient: null,
        };
      }

      if (
        needsLugarSelector(svcForPrice.modalidad) &&
        !entry.lugarServicio
      ) {
        return {
          id: svc.id,
          name,
          base: 0,
          total: 0,
          detail: t?.reservar?.eligeDondeSePresta ?? "Elige dónde se presta el servicio",
          ready: false,
          vertical: svcForPrice.vertical,
          discountPct: 0,
          discountSource: null,
          modalidadCobro: entry?.modalidadCobro ?? null,
          duration: 0,
          unitBase: null,
          unitClient: null,
        };
      }

      const dateContext = buildDateContextFromCartEntry(entry);
      const calc = calculateServiceBasePrice(
        svcForPrice,
        dateContext,
        null,
        tarifasPorServicio[svc.id] ?? {},
      );
      let ready = calc.ready;
      let detail = calc.detail;
      let durationForUnit = 0;

      const diaError = validateDiaDisponible(svcForPrice, entry.fechaInicio);
      if (diaError) {
        ready = false;
        detail = diaError;
      }

      if (calc.ready && ready) {
        durationForUnit = getServiceDuration(svcForPrice, dateContext);
        const estanciaError = validateEstancia(svcForPrice, durationForUnit);
        if (estanciaError) {
          ready = false;
          detail = estanciaError;
          durationForUnit = 0;
        } else {
          const antelacionError = validateAntelacion(
            svcForPrice,
            entry.fechaInicio,
            entry.hora,
            svcForPrice.vertical,
          );
          if (antelacionError) {
            ready = false;
            detail = antelacionError;
            durationForUnit = 0;
          }
        }
      }

      const lineBase = calc.base;
      const lineTotal = clienteSinComision
        ? calc.base
        : applyClientPrice(calc.base);
      const unitBase =
        ready && durationForUnit > 0
          ? Math.round((lineBase / durationForUnit) * 100) / 100
          : null;
      const unitClient =
        ready && durationForUnit > 0
          ? Math.round((lineTotal / durationForUnit) * 100) / 100
          : null;

      return {
        id: svc.id,
        name,
        base: lineBase,
        total: lineTotal,
        detail,
        ready,
        vertical: svcForPrice.vertical,
        discountPct: calc.discountPct ?? 0,
        discountSource: calc.discountSource ?? null,
        modalidadCobro: calc.modalidadCobro ?? entry.modalidadCobro ?? null,
        duration: durationForUnit || 0,
        unitBase,
        unitClient,
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
        detail: failedLine.detail || (t?.reservar?.introduceFechas ?? "Introduce las fechas para calcular el precio"),
      };
    }

    const subtotal = lines.reduce((sum, line) => sum + line.base, 0);
    const commission = clienteSinComision
      ? 0
      : Math.round(subtotal * COMMISSION_RATE * 100) / 100;
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
    cartByServiceId,
    perfilCliente,
    tarifasPorServicio,
    verticals,
    t,
  ]);

  const mainBilling = useMemo(() => {
    if (!service) return { kind: "legacy" };
    return resolveBillingForService(service, modalidadCobro);
  }, [service, modalidadCobro]);

  const modalidadesActivas = useMemo(
    () => (service ? getServiceModalidadesRows(service) : []),
    [service],
  );

  const showModalidadSelector = modalidadesActivas.length > 1;

  const clienteSinComision = getReservasSinComisionCliente(perfilCliente) > 0;

  const incompletePriceLine = priceSummary.lines.find((l) => !l.ready);

  const precioListo =
    priceSummary.ready &&
    !calendarioError &&
    !disponibilidadChecking &&
    !tarifasLoading;

  const { creditoAplicado, totalAPagar } = useMemo(() => {
    if (!precioListo || priceSummary.total <= 0) {
      return { creditoAplicado: 0, totalAPagar: 0 };
    }
    const creditoCliente = Number(perfilCliente?.credito_disponible) || 0;
    const topeCredito =
      Math.round(priceSummary.total * MAX_CREDITO_PORCENTAJE * 100) / 100;
    const creditoAplicado = Math.min(creditoCliente, topeCredito);
    const totalAPagar =
      Math.round((priceSummary.total - creditoAplicado) * 100) / 100;
    return { creditoAplicado, totalAPagar };
  }, [precioListo, priceSummary.total, perfilCliente?.credito_disponible]);

  const precioDetail =
    calendarioError ||
    (disponibilidadChecking
      ? (t?.reservar?.comprobandoDisponibilidad ?? "Comprobando disponibilidad…")
      : incompletePriceLine
        ? incompletePriceLine.detail === (t?.reservar?.faltanDatos ?? "Faltan datos")
          ? (t?.reservar?.completaLosDatos
              ? t.reservar.completaLosDatos(incompletePriceLine.name)
              : `Completa los datos de: ${incompletePriceLine.name}`)
          : incompletePriceLine.detail
        : priceSummary.detail);

  const datesReady = useMemo(() => {
    if (!fechaInicio) return false;
    if (showModalidadSelector && !modalidadCobro) return false;
    if (needsLugarSelector(service?.modalidad) && !lugarServicio) return false;

    const billing = mainBilling;
    if (billing.kind === "modalidad") {
      if (billingNeedsFechaFin(billing, vertical) && !fechaFin) return false;
      if (billingNeedsHora(billing) && !hora) return false;
      if (billingNeedsDuracionHoras(billing) && !duracionHoras) return false;
      return true;
    }

    if (vertical === "ninos") {
      return Boolean(hora && duracionHoras);
    }
    if (vertical === "alojamiento" || vertical === "mascotas") {
      return Boolean(fechaFin);
    }
    return true;
  }, [
    fechaInicio,
    fechaFin,
    hora,
    duracionHoras,
    vertical,
    modalidadCobro,
    showModalidadSelector,
    mainBilling,
    service?.modalidad,
    lugarServicio,
  ]);

  const payBlockedReason = useMemo(() => {
    if (clienteNoVerificado) return dniBlockMessage || "Verifica tu identidad";
    if (clienteSinTelefono) return TELEFONO_REQUIRED_CLIENT_MSG;
    if (bookabilityBlock) return bookabilityBlock;
    if (calendarioError) return calendarioError;
    if (incompletePriceLine) {
      return incompletePriceLine.detail === (t?.reservar?.faltanDatos ?? "Faltan datos")
        ? (t?.reservar?.completaDatos
            ? t.reservar.completaDatos(incompletePriceLine.name)
            : `Completa datos: ${incompletePriceLine.name}`)
        : incompletePriceLine.detail;
    }
    if (!aceptaPolitica) return t?.reservar?.aceptaPoliticaMensaje ?? "Acepta la política de cancelación";
    return null;
  }, [
    clienteNoVerificado,
    dniBlockMessage,
    clienteSinTelefono,
    bookabilityBlock,
    calendarioError,
    incompletePriceLine,
    aceptaPolitica,
    t,
  ]);

  const loadServicesForVertical = useCallback(
    async (tabVertical, inicio, fin, excludeIds = []) => {
      if (!service || !inicio) return [];
      const city = service.ciudad?.trim();
      if (!city) return [];

      let query = supabase
        .from("services")
        .select(RESERVAR_SERVICE_SELECT)
        .eq("disponible", true)
        .eq("profiles_public.verificado", true)
        .eq("profiles_public.cobros_activos", true)
        .eq("vertical", tabVertical)
        .ilike("ciudad", `%${city}%`)
        .neq("id", service.id)
        .limit(12);

      const ids = [...new Set(excludeIds.filter((id) => id && id !== service.id))];
      if (ids.length === 1) {
        query = query.neq("id", ids[0]);
      } else if (ids.length > 1) {
        query = query.not("id", "in", `(${ids.join(",")})`);
      }

      const { data: compData } = await query;

      if (!compData?.length) return [];

      const end = fin || inicio;
      const available = await Promise.all(
        compData.map(async (svc) => {
          if (ids.includes(svc.id)) return null;
          const avail = await verificarDisponibilidad(svc.id, inicio, end);
          const diaError = validateDiaDisponible(svc, inicio);
          return avail && !diaError ? svc : null;
        }),
      );
      return available.filter(Boolean);
    },
    [service],
  );

  const cartServiceIdsKey = useMemo(
    () => selectedServices.map((s) => s.id).join(","),
    [selectedServices],
  );

  const cartVerticalsKey = useMemo(
    () =>
      [...new Set(selectedServices.map((s) => s.vertical).filter(Boolean))]
        .sort()
        .join(","),
    [selectedServices],
  );

  const availableBundleTabs = useMemo(() => {
    const available = new Set(
      getAvailableComplementaryVerticals(selectedServices),
    );
    const tabLabelMap = {
      alojamiento: t?.reservar?.tabAlojamiento ?? "Alojamiento",
      ninos: t?.reservar?.tabNinos ?? "Niñera",
      mascotas: t?.reservar?.tabMascotas ?? "Mascotas",
    };
    return BUNDLE_TABS
      .filter((tab) => available.has(tab.id))
      .map((tab) => ({
        ...tab,
        label: verticalEmojiLabel(tab.id, tabLabelMap[tab.id] ?? tab.id),
      }));
  }, [selectedServices, t]);

  // Si la pestaña activa ya está cubierta por el carrito, saltar a una disponible.
  useEffect(() => {
    if (availableBundleTabs.length === 0) return;
    if (!availableBundleTabs.some((t) => t.id === bundleTab)) {
      setBundleTab(availableBundleTabs[0].id);
    }
  }, [availableBundleTabs, bundleTab]);

  useEffect(() => {
    if (!datesReady || !fechaInicio || !service) {
      setFilteredComplementary([]);
      return;
    }

    let cancelled = false;
    async function filterComplementary() {
      const fin = fechaFin || fechaInicio;
      const cartIds = new Set(selectedServices.map((s) => s.id));
      const cartVerticals = new Set(
        selectedServices.map((s) => s.vertical).filter(Boolean),
      );
      const candidates = complementaryServices.filter(
        (svc) =>
          svc?.id &&
          !cartIds.has(svc.id) &&
          svc.vertical &&
          !cartVerticals.has(svc.vertical),
      );
      const results = await Promise.all(
        candidates.map(async (svc) => {
          const avail = await verificarDisponibilidad(svc.id, fechaInicio, fin);
          const diaError = validateDiaDisponible(svc, fechaInicio);
          return avail && !diaError ? svc : null;
        }),
      );
      if (!cancelled) {
        setFilteredComplementary(results.filter(Boolean));
      }
    }

    filterComplementary();
    return () => {
      cancelled = true;
    };
  }, [
    complementaryServices,
    fechaInicio,
    fechaFin,
    datesReady,
    service,
    cartServiceIdsKey,
    cartVerticalsKey,
  ]);

  useEffect(() => {
    if (!datesReady || !fechaInicio || !service) {
      setTabServices([]);
      return;
    }

    const cartVerticals = new Set(
      selectedServices.map((s) => s.vertical).filter(Boolean),
    );
    if (cartVerticals.has(bundleTab)) {
      setTabServices([]);
      setTabServicesLoading(false);
      return;
    }

    let cancelled = false;
    setTabServicesLoading(true);

    async function loadTab() {
      const fin = fechaFin || fechaInicio;
      const excludeIds = selectedServices.map((s) => s.id);
      const services = await loadServicesForVertical(
        bundleTab,
        fechaInicio,
        fin,
        excludeIds,
      );
      if (cancelled) return;

      setTabServices(services);

      if (services.length > 0) {
        const proveedorIds = [...new Set(services.map((s) => s.proveedor_id))];
        const { data: reviews } = await supabase
          .from("reviews")
          .select("proveedor_id, valoracion, cliente_id")
          .in("proveedor_id", proveedorIds);

        const {
          aggregateRatingsByProveedor,
          formatProveedorRatingAvg,
        } = await import("@/app/lib/reviews");
        const aggregated = aggregateRatingsByProveedor(reviews);
        const map = {};
        for (const pid of proveedorIds) {
          const r = aggregated[pid];
          map[pid] = {
            count: r?.count || 0,
            avg: formatProveedorRatingAvg(r),
          };
        }
        if (!cancelled) setTabReviewsMap(map);
      } else {
        setTabReviewsMap({});
      }

      if (!cancelled) setTabServicesLoading(false);
    }

    loadTab();
    return () => {
      cancelled = true;
    };
  }, [
    bundleTab,
    datesReady,
    fechaInicio,
    fechaFin,
    service,
    loadServicesForVertical,
    cartServiceIdsKey,
    cartVerticalsKey,
  ]);

  const paymentMetadata = useMemo(() => {
    if (!userId || !serviceId || !grupoReserva) return null;
    return {
      service_id: serviceId,
      cliente_id: userId,
      grupo_reserva: grupoReserva,
    };
  }, [userId, serviceId, grupoReserva]);

  useEffect(() => {
    const releasePreparedIntent = () => {
      const id = activePaymentIntentIdRef.current;
      if (id && !paymentFinalizedRef.current) {
        cancelOrphanPaymentIntent(id);
      }
      activePaymentIntentIdRef.current = null;
      setClientSecret(null);
      setPaymentIntentId(null);
    };

    if (totalAPagar <= 0 || !userId || !serviceId) {
      releasePreparedIntent();
      setGrupoReserva(null);
      return;
    }

    if (clienteNoVerificado) {
      releasePreparedIntent();
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    if (clienteSinTelefono) {
      releasePreparedIntent();
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    const dateError = validateBookingDates(vertical, fechaInicio, hora, t);
    if (dateError) {
      setErrorMessage(dateError);
      releasePreparedIntent();
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    if (calendarioError || disponibilidadChecking) {
      releasePreparedIntent();
      setGrupoReserva(null);
      setPaymentIntentLoading(false);
      return;
    }

    const grupo = crypto.randomUUID();
    setGrupoReserva(grupo);

    if (selectedServices.length > 1) {
      releasePreparedIntent();
      setPaymentIntentLoading(false);
      return;
    }

    if (savedPaymentMethods.length > 0 && !useNewCard) {
      releasePreparedIntent();
      setPaymentIntentLoading(false);
      return;
    }

    let cancelled = false;
    let createdIdForEffect = null;
    setPaymentIntentLoading(true);
    setClientSecret(null);
    setPaymentIntentId(null);

    const previousPiId = activePaymentIntentIdRef.current;
    activePaymentIntentIdRef.current = null;
    if (previousPiId && !paymentFinalizedRef.current) {
      cancelOrphanPaymentIntent(previousPiId);
    }

    async function createIntent() {
      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: totalAPagar,
            customer: stripeCustomerId || undefined,
            metadata: {
              service_id: String(serviceId),
              cliente_id: String(userId),
              grupo_reserva: grupo,
            },
          }),
        });
        const data = await res.json();
        if (cancelled) {
          if (data.paymentIntentId) {
            await cancelOrphanPaymentIntent(data.paymentIntentId);
          }
          return;
        }
        if (!res.ok || data.error) {
          setClientSecret(null);
          setPaymentIntentId(null);
          setErrorMessage(
            friendlyStripePaymentError(
              data.error || "No se pudo preparar el pago.",
            ),
          );
          return;
        }
        createdIdForEffect = data.paymentIntentId;
        activePaymentIntentIdRef.current = data.paymentIntentId;
        setClientSecret(data.clientSecret);
        setPaymentIntentId(data.paymentIntentId);
      } finally {
        if (!cancelled) setPaymentIntentLoading(false);
      }
    }

    createIntent();
    return () => {
      cancelled = true;
      if (
        createdIdForEffect &&
        !paymentFinalizedRef.current &&
        activePaymentIntentIdRef.current === createdIdForEffect
      ) {
        cancelOrphanPaymentIntent(createdIdForEffect);
        activePaymentIntentIdRef.current = null;
      }
    };
  }, [
    totalAPagar,
    userId,
    serviceId,
    useNewCard,
    savedPaymentMethods.length,
    stripeCustomerId,
    vertical,
    fechaInicio,
    hora,
    clienteNoVerificado,
    clienteSinTelefono,
    calendarioError,
    disponibilidadChecking,
    selectedServices.length,
    paymentRetryKey,
  ]);

  // Si el usuario abandona el checkout, cancela el PI preparado (sin reserva).
  useEffect(() => {
    return () => {
      if (
        !paymentFinalizedRef.current &&
        activePaymentIntentIdRef.current
      ) {
        cancelOrphanPaymentIntent(activePaymentIntentIdRef.current);
      }
    };
  }, []);

  const completeBooking = useCallback(
    async (confirmedPaymentIntentId) => {
      if (!userId || !service || !grupoReserva) {
        throw new Error(t?.reservar?.errDatosReservaIncompletos ?? "Datos de reserva incompletos.");
      }

      if (!precioListo || priceSummary.total <= 0) {
        throw new Error(t?.reservar?.errCompletarFechas ?? "Completa las fechas o la duración para calcular el precio.");
      }

      const service_contexts = selectedServices.map((s) => {
        const entry = cartByServiceId[s.id];
        const svcForUnits = entry?.service ?? s;
        return {
          service_id: s.id,
          fecha_inicio: entry?.fechaInicio || fechaInicio,
          fecha_fin:
            entry?.fechaFin ||
            entry?.fechaInicio ||
            fechaFin ||
            fechaInicio,
          hora: entry?.hora ?? hora ?? "",
          duracion_horas: entry?.duracionHoras ?? duracionHoras ?? "",
          modalidad_cobro: entry?.modalidadCobro ?? modalidadCobro ?? null,
          num_huespedes: serviceNeedsUnidadesSelector(svcForUnits)
            ? entry?.numHuespedes ?? numHuespedes ?? null
            : null,
          lugar_servicio:
            entry?.lugarServicio ?? lugarServicio ?? null,
          direccion_cliente:
            entry?.direccionCliente ?? direccionCliente ?? null,
          direccion_cliente_a_definir:
            entry?.direccionClienteADefinir ??
            direccionClienteADefinir ??
            null,
          payment_intent_id:
            s.id === service.id ? confirmedPaymentIntentId : null,
        };
      });

      const res = await fetch("/api/bookings/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_intent_id: confirmedPaymentIntentId,
          grupo_reserva: grupoReserva,
          main_service_id: service.id,
          service_ids: selectedServices.map((s) => s.id),
          service_contexts,
          // Legacy flat (retrocompat / emails): contexto del main
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || fechaInicio,
          hora,
          duracion_horas: duracionHoras,
          mensaje,
          familia_id:
            reservarComoFamilia && familiaInfo?.id ? familiaInfo.id : null,
          num_huespedes: serviceNeedsUnidadesSelector(service)
            ? numHuespedes
            : null,
          modalidad_cobro: modalidadCobro || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        throw new Error(data.error || (t?.reservar?.errCompletarReserva ?? "No se pudo completar la reserva."));
      }

      paymentFinalizedRef.current = true;
      activePaymentIntentIdRef.current = null;
      clearBundleStateFromSession();
      cartHydratedRef.current = false;
      bundleRestoredRef.current = false;
      router.push("/dashboard");
    },
    [
      userId,
      service,
      grupoReserva,
      priceSummary.total,
      selectedServices,
      cartByServiceId,
      fechaInicio,
      fechaFin,
      hora,
      duracionHoras,
      numHuespedes,
      modalidadCobro,
      lugarServicio,
      direccionCliente,
      direccionClienteADefinir,
      mensaje,
      router,
      reservarComoFamilia,
      familiaInfo,
      precioListo,
      t,
    ],
  );

  const completeBundleBooking = useCallback(
    async (payments) => {
      if (!userId || !service || !grupoReserva) {
        throw new Error(t?.reservar?.errDatosReservaIncompletos ?? "Datos de reserva incompletos.");
      }

      if (!precioListo || priceSummary.total <= 0) {
        throw new Error(t?.reservar?.errCompletarFechas ?? "Completa las fechas o la duración para calcular el precio.");
      }

      const paymentsList = Array.isArray(payments) ? payments : [];
      const service_contexts = selectedServices.map((s) => {
        const entry = cartByServiceId[s.id];
        const svcForUnits = entry?.service ?? s;
        const pay = paymentsList.find((p) => p.service_id === s.id);
        return {
          service_id: s.id,
          fecha_inicio: entry?.fechaInicio || fechaInicio,
          fecha_fin:
            entry?.fechaFin ||
            entry?.fechaInicio ||
            fechaFin ||
            fechaInicio,
          hora: entry?.hora ?? "",
          duracion_horas: entry?.duracionHoras ?? "",
          modalidad_cobro: entry?.modalidadCobro ?? null,
          num_huespedes: serviceNeedsUnidadesSelector(svcForUnits)
            ? entry?.numHuespedes ?? null
            : null,
          lugar_servicio: entry?.lugarServicio ?? null,
          direccion_cliente: entry?.direccionCliente ?? null,
          direccion_cliente_a_definir:
            entry?.direccionClienteADefinir ?? null,
          payment_intent_id: pay?.payment_intent_id ?? null,
        };
      });

      const res = await fetch("/api/bookings/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payments,
          grupo_reserva: grupoReserva,
          main_service_id: service.id,
          service_ids: selectedServices.map((s) => s.id),
          service_contexts,
          // Legacy flat: main (no se usa para precio si hay service_contexts)
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin || fechaInicio,
          hora,
          duracion_horas: duracionHoras,
          mensaje,
          familia_id:
            reservarComoFamilia && familiaInfo?.id ? familiaInfo.id : null,
          num_huespedes: serviceNeedsUnidadesSelector(service)
            ? numHuespedes
            : null,
          modalidad_cobro: modalidadCobro || null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        throw new Error(data.error || (t?.reservar?.errCompletarReserva ?? "No se pudo completar la reserva."));
      }

      paymentFinalizedRef.current = true;
      activePaymentIntentIdRef.current = null;
      clearBundleStateFromSession();
      cartHydratedRef.current = false;
      bundleRestoredRef.current = false;
      router.push("/dashboard");
    },
    [
      userId,
      service,
      grupoReserva,
      priceSummary.total,
      selectedServices,
      cartByServiceId,
      fechaInicio,
      fechaFin,
      hora,
      duracionHoras,
      numHuespedes,
      modalidadCobro,
      mensaje,
      router,
      reservarComoFamilia,
      familiaInfo,
      precioListo,
      t,
    ],
  );

  function toggleBundleService(idOrSvc) {
    const id =
      typeof idOrSvc === "object" && idOrSvc != null
        ? idOrSvc.id
        : idOrSvc;
    if (!id) return;

    // El main (URL /reservar/[serviceId]) no se puede quitar del carrito.
    if (id === service?.id || id === mainServiceId || id === serviceId) {
      return;
    }

    const existing = bundleServices.find((s) => s.id === id);
    if (existing) {
      removeComplementaryFromCart(id);
      return;
    }

    // Misma resolución para lista superior y buscador por vertical:
    // preferir el objeto pasado (tarjeta clicada), si no buscar en todas las fuentes.
    const svc =
      (typeof idOrSvc === "object" && idOrSvc?.id ? idOrSvc : null) ||
      tabServices.find((s) => s.id === id) ||
      filteredComplementary.find((s) => s.id === id) ||
      complementaryServices.find((s) => s.id === id) ||
      allBundleCandidates.find((s) => s.id === id);
    if (!svc) {
      setErrorMessage(t?.reservar?.errAnadirServicio ?? "No se pudo añadir este servicio. Prueba de nuevo.");
      return;
    }
    const issue = getServiceBookabilityIssue(svc);
    if (issue) {
      setErrorMessage(issue);
      return;
    }

    // Una sola vertical por carrito.
    if (
      svc.vertical &&
      selectedServices.some((s) => s.vertical === svc.vertical)
    ) {
      const label =
        verticals[svc.vertical]?.label || "este tipo";
      setErrorMessage(
        t?.reservar?.errServicioMismoTipo
          ? t.reservar.errServicioMismoTipo(label.toLowerCase())
          : `Ya tienes un servicio de ${label.toLowerCase()} en el carrito.`,
      );
      return;
    }

    setErrorMessage("");
    // UI: objeto del listado (sin modalidades obligatorias).
    setBundleServices((prev) =>
      prev.some((s) => s.id === id) ? prev : [...prev, svc],
    );

    // Carrito: modalidades + fechas sugeridas del main (editables por línea).
    (async () => {
      const withMods = await loadServiceWithModalidades(svc);
      setCartByServiceId((prev) => ({
        ...prev,
        [withMods.id]: buildCartEntry(
          withMods,
          suggestedBookingFieldsFromMain(
            { fechaInicio, fechaFin },
            withMods,
          ),
        ),
      }));
    })();
  }

  /**
   * Quitar un complementario: limpia bundleServices + cartByServiceId +
   * tarifas/ocupadas, y persiste ya sin ese servicio.
   * El main (service de la URL) NUNCA se quita — la página es su flujo.
   */
  function removeComplementaryFromCart(complementaryId) {
    const id = complementaryId;
    if (!id) return;
    if (id === service?.id || id === mainServiceId || id === serviceId) {
      return;
    }

    const nextBundle = bundleServices.filter((s) => s.id !== id);
    const nextCart = { ...cartByServiceId };
    delete nextCart[id];

    // Conservar solo main + complementarios restantes (sin huérfanos).
    const keepIds = new Set([
      service?.id,
      serviceId,
      mainServiceId,
      ...nextBundle.map((s) => s.id),
    ].filter(Boolean));
    for (const key of Object.keys(nextCart)) {
      if (!keepIds.has(key)) delete nextCart[key];
    }

    setBundleServices(nextBundle);
    setCartByServiceId(nextCart);

    setTarifasPorServicio((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setFechasOcupadasByServiceId((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (cartCalendarOpenId === id) setCartCalendarOpenId(null);

    // Persistencia inmediata (sin esperar debounce) con el estado ya limpio.
    const snapshot = buildBundleStateSnapshot({
      origenServiceId: serviceId,
      mainServiceId: mainServiceId || serviceId,
      bundleServices: nextBundle,
      cartByServiceId: nextCart,
      fechaInicio,
      fechaFin,
      hora,
      duracionHoras,
      modalidadCobro,
      numHuespedes,
      lugarServicio,
      direccionCliente,
      direccionClienteADefinir,
      mensaje,
      aceptaPolitica,
    });
    latestBundleSnapshotRef.current = snapshot;
    writeBundleStateToSession(snapshot);
  }

  function handleRangeChange({ desde, hasta }) {
    if (desde) {
      const diaError = validateDiaDisponible(service, desde);
      if (diaError) {
        setErrorMessage(diaError);
        return;
      }
      setErrorMessage("");
    }
    setFechaInicio(desde);
    setFechaFin(hasta);
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: "#f7f5f2" }}>
        <header className="border-b bg-white px-6 py-4" style={{ borderColor: "#e8e4de" }}>
          <p className="text-[18px] text-[#111]" style={{ fontFamily: SERIF }}>
            Home<span className="italic" style={{ color: "#1d4f91" }}>&</span>Heart
          </p>
        </header>
        <main className="mx-auto max-w-[1100px] px-6 py-16 text-center text-sm text-[#666]">
          {t?.reservar?.cargandoServicio ?? "Cargando servicio…"}
        </main>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: "#f7f5f2" }}>
        <header className="border-b bg-white px-6 py-4" style={{ borderColor: "#e8e4de" }}>
          <p className="text-[18px] text-[#111]" style={{ fontFamily: SERIF }}>
            Home<span className="italic" style={{ color: "#1d4f91" }}>&</span>Heart
          </p>
        </header>
        <main className="mx-auto max-w-[560px] px-6 py-16 text-center">
          {unavailableMessage ? (
            <>
              <div
                className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: "#e8f0fb" }}
              >
                <InfoIcon className="h-8 w-8 text-[#1d4f91]" />
              </div>
              <h1
                className="text-[22px] font-semibold text-[#111]"
                style={{ fontFamily: SERIF }}
              >
                {unavailableMessage}
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[#666]">
                {t?.reservar?.servicioNoDispDesc ?? "Puede que el proveedor esté completando su perfil o que el servicio esté temporalmente pausado. Explora otras opciones disponibles en tu zona."}
              </p>
              <Link
                href="/buscar"
                className="mt-8 inline-block min-h-[44px] px-6 py-3 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
              >
                {t?.reservar?.volverBuscarServicios ?? "Volver a buscar servicios"}
              </Link>
            </>
          ) : (
            <p className="text-sm text-red-600">
              {errorMessage || (t?.reservar?.servicioNoDisponible ?? "Servicio no disponible.")}
            </p>
          )}
        </main>
      </div>
    );
  }

  const { Icon } = verticalConfig;
  const zone =
    service.ciudad || profile.location_zone || profile.ciudad || "España";
  const fullProviderName =
    formatShortName(profile.nombre, profile.apellido) || "Proveedor";
  const serviceTags = getServiceDisplayTags(service);
  const freeCancelDeadline = getFreeCancelDeadline(
    serviceStartAt,
    service.cancellation_policy,
  );
  const freeCancelDateStr = formatCancelDeadline(freeCancelDeadline, t);
  function goToBuscarBundle() {
    writeBundleStateToSession(
      buildBundleStateSnapshot({
        origenServiceId: serviceId,
        mainServiceId: mainServiceId || serviceId,
        bundleServices,
        cartByServiceId,
        fechaInicio,
        fechaFin,
        hora,
        duracionHoras,
        modalidadCobro,
        numHuespedes,
        lugarServicio,
        direccionCliente,
        direccionClienteADefinir,
        mensaje,
        aceptaPolitica,
      }),
    );
    const params = new URLSearchParams();
    if (fechaInicio) params.set("desde", fechaInicio);
    if (fechaFin) params.set("hasta", fechaFin);
    params.set("bundle", "true");
    params.set("origen", serviceId);
    router.push(`/buscar?${params.toString()}`);
  }
  const mainPriceLine =
    priceSummary.lines.find((l) => l.id === service.id) ?? priceSummary.lines[0];
  const bundleLines = priceSummary.lines.filter((l) => l.id !== service.id);
  // Unidad del resumen = precio por línea / duración (misma modalidad + suplemento).
  // NO recalcular con services.precio legacy (eso producía 15€→17,10€ ignorando medio_dia).
  const unitClientPrice =
    mainPriceLine?.unitClient != null ? mainPriceLine.unitClient : null;

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: "#f7f5f2", color: "#1a1a1a" }}
    >
      <header
        className="border-b bg-white px-4 py-3 sm:px-6 sm:py-4"
        style={{ borderColor: "#e8e4de" }}
      >
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-3">
          <Link
            href={`/proveedor/${service.proveedor_id}`}
            className="inline-flex min-h-[44px] items-center text-[12px] no-underline transition-opacity hover:opacity-80"
            style={{ color: "#888" }}
          >
            {t?.reservar?.volverPerfil ?? "← Volver al perfil"}
          </Link>
          <Link href="/" className="no-underline">
            <p className="text-[18px] leading-none text-[#111]" style={{ fontFamily: SERIF }}>
              Home<span className="italic" style={{ color: "#1d4f91" }}>&</span>Heart
            </p>
          </Link>
        </div>
      </header>

      <ProgressBar
        datesReady={datesReady}
        aceptaPolitica={aceptaPolitica}
        precioListo={precioListo}
        t={t}
      />

      <main className="mx-auto max-w-[1100px] p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
          {/* Columna izquierda */}
          <div className="flex flex-col gap-5">
            {/* Sección 1 — Tu reserva */}
            <section
              className="rounded-[10px] border bg-white p-5"
              style={{ borderColor: "#e8e4de" }}
            >
              <SectionHeader number={1} title={t?.reservar?.tuReserva ?? "Tu reserva"} />
              {(() => {
                const mainLine = priceSummary.lines.find((l) => l.id === service.id);
                const mainOk = mainLine?.ready;
                return (
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: mainOk ? "#e6f4f0" : "#fdf3e3",
                        color: mainOk ? "#0e7a5c" : "#92400e",
                      }}
                    >
                      {mainOk ? "OK" : (t?.reservar?.faltanDatos ?? "Faltan datos")}
                    </span>
                  </div>
                );
              })()}

              <div className="flex gap-3">
                <div
                  className="flex h-16 w-20 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `linear-gradient(135deg, ${verticalConfig.color}22, ${verticalConfig.color}55)`,
                    borderRadius: 8,
                  }}
                >
                  <Icon className="h-7 w-7" style={{ color: verticalConfig.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[13px] font-semibold text-[#1a1a1a]">
                      {fullProviderName}
                    </p>
                    {profile.verificado === true && (
                      <ServiceTag
                        text="Verificada ✓"
                        light="#e8f0fb"
                        color="#163a6b"
                        title={VERIFICADO_BADGE_TOOLTIP_ES}
                      />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-[#888]">
                    {service.titulo || verticalConfig.label} · {zone}
                  </p>
                  {serviceTags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {serviceTags.map((tag) => (
                        <ServiceTag key={tag.text} {...tag} />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {showModalidadSelector && (
                <div className="mt-4">
                  <p className="mb-2 text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                    {t?.reservar?.comoQuieresReservar ?? "¿Cómo quieres reservar?"}
                  </p>
                  <div className="flex flex-col gap-2">
                    {modalidadesActivas.map((row) => {
                      const opt = MODALIDAD_COBRO_OPTIONS.find(
                        (o) => o.value === row.modalidad,
                      );
                      const selected = modalidadCobro === row.modalidad;
                      const precio = Number(row.precio);
                      const precioLabel = Number.isFinite(precio)
                        ? `${precio % 1 === 0 ? precio : precio.toFixed(2)}€${getModalidadCobroPriceSuffix(row.modalidad)}`
                        : "";
                      return (
                        <button
                          key={row.modalidad}
                          type="button"
                          onClick={() => {
                            setModalidadCobro(row.modalidad);
                            if (row.modalidad === "hora") setFechaFin("");
                            if (row.modalidad === "dia") {
                              setHora("");
                              setDuracionHoras("");
                            }
                            if (row.modalidad === "medio_dia") {
                              setDuracionHoras("");
                            }
                          }}
                          className="min-h-[44px] w-full border px-3 py-2.5 text-left transition-opacity hover:opacity-90"
                          style={{
                            borderColor: selected ? "#1d4f91" : "#e8e4de",
                            backgroundColor: selected ? "#e8f0fb" : "#fff",
                            borderRadius: 6,
                          }}
                        >
                          <span className="block text-[13px] font-semibold text-[#1a1a1a]">
                            {opt?.label || row.modalidad}
                            {precioLabel ? (
                              <span className="ml-2 font-medium text-[#1d4f91]">
                                {precioLabel}
                              </span>
                            ) : null}
                          </span>
                          {opt?.hint ? (
                            <span className="mt-0.5 block text-[11px] text-[#666]">
                              {opt.hint}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <LugarServicioBookingFields
                modalidad={service?.modalidad}
                vertical={service?.vertical}
                lugarServicio={lugarServicio}
                direccionCliente={direccionCliente}
                direccionClienteADefinir={direccionClienteADefinir}
                onChange={(patch) => {
                  if (patch.lugarServicio !== undefined) {
                    setLugarServicio(patch.lugarServicio);
                  }
                  if (patch.direccionCliente !== undefined) {
                    setDireccionCliente(patch.direccionCliente);
                  }
                  if (patch.direccionClienteADefinir !== undefined) {
                    setDireccionClienteADefinir(patch.direccionClienteADefinir);
                  }
                }}
                t={t}
              />

              {(!showModalidadSelector || modalidadCobro) && (
              <div className="relative mt-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(true)}
                    className="min-h-[44px] w-full border text-left transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: "#f7f5f2",
                      borderColor: "#e8e4de",
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  >
                    <p className="text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                      {billingNeedsFechaFin(mainBilling, vertical)
                        ? (t?.reservar?.inicio ?? "Inicio")
                        : (t?.reservar?.fecha ?? "Fecha")}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#2a3a4a]">
                      {fechaInicio ? formatFechaDisplay(fechaInicio, t) : (t?.reservar?.seleccionar ?? "Seleccionar")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendarOpen(true)}
                    className="min-h-[44px] w-full border text-left transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: "#f7f5f2",
                      borderColor: "#e8e4de",
                      borderRadius: 6,
                      padding: "10px 12px",
                    }}
                  >
                    <p className="text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                      {billingNeedsFechaFin(mainBilling, vertical) ? (t?.reservar?.fin ?? "Fin") : (t?.reservar?.separador ?? "—")}
                    </p>
                    <p className="mt-0.5 text-[13px] text-[#2a3a4a]">
                      {fechaFin
                        ? formatFechaDisplay(fechaFin, t)
                        : billingNeedsFechaFin(mainBilling, vertical)
                          ? (t?.reservar?.seleccionar ?? "Seleccionar")
                          : (t?.reservar?.separador ?? "—")}
                    </p>
                  </button>
                </div>

                {calendarOpen && (
                  <div
                    className="absolute left-0 right-0 z-20 mt-2 rounded-lg border bg-white p-4 shadow-lg"
                    style={{ borderColor: "#e8e4de" }}
                  >
                    <CalendarioRangoFechas
                      fechaInicio={fechaInicio}
                      fechaFin={fechaFin}
                      onChange={handleRangeChange}
                      onRangeComplete={() => setCalendarOpen(false)}
                      fechasOcupadas={fechasOcupadas}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setCalendarOpen(true)}
                  className="mt-2 min-h-[44px] border-0 bg-transparent px-1 text-[11px] font-medium hover:underline"
                  style={{ color: "#1d4f91" }}
                >
                  {t?.reservar?.cambiarFechas ?? "Cambiar fechas →"}
                </button>
              </div>
              )}

              {(!showModalidadSelector || modalidadCobro) &&
                (billingNeedsHora(mainBilling) ||
                  billingNeedsDuracionHoras(mainBilling) ||
                  (mainBilling.kind === "legacy" && vertical === "ninos")) && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(billingNeedsHora(mainBilling) ||
                    (mainBilling.kind === "legacy" && vertical === "ninos")) && (
                    <div>
                      <label htmlFor="hora" className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                        {t?.reservar?.horaDeInicio ?? "Hora de inicio"}
                      </label>
                      <input
                        id="hora"
                        type="time"
                        required
                        min={getMinHora()}
                        value={hora}
                        onChange={(e) => setHora(e.target.value)}
                        className={inputClass}
                        style={{ borderColor: "#e8e4de", borderRadius: 6 }}
                      />
                    </div>
                  )}
                  {(billingNeedsDuracionHoras(mainBilling) ||
                    (mainBilling.kind === "legacy" && vertical === "ninos")) && (
                    <div>
                      <label htmlFor="duracion" className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]">
                        {t?.reservar?.duracionHoras ?? "Duración (horas)"}
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
                        style={{ borderColor: "#e8e4de", borderRadius: 6 }}
                      />
                    </div>
                  )}
                </div>
              )}

              {serviceNeedsUnidadesSelector(service) && (
                <div className="mt-3">
                  <label
                    htmlFor="num-huespedes"
                    className="mb-1 block text-[8px] font-medium uppercase tracking-wide text-[#bbb]"
                  >
                    {getUnidadesPrecioCopy(service.vertical, modalidadCobro).selectorLabel}
                  </label>
                  <select
                    id="num-huespedes"
                    value={numHuespedes ?? ""}
                    onChange={(e) => setNumHuespedes(Number(e.target.value))}
                    className={inputClass}
                    style={{ borderColor: "#e8e4de", borderRadius: 6 }}
                  >
                    {Array.from(
                      { length: Math.floor(Number(service.capacidad_maxima)) },
                      (_, i) => i + 1,
                    ).map((n) => {
                      const copy = getUnidadesPrecioCopy(
                        service.vertical,
                        modalidadCobro,
                      );
                      const word = n === 1 ? copy.unitSingular : copy.unitPlural;
                      return (
                        <option key={n} value={n}>
                          {n} {word}
                        </option>
                      );
                    })}
                  </select>
                  {(() => {
                    const desglose = formatHuespedesPrecioDesglose(
                      cartByServiceId[service.id]?.service ?? service,
                      numHuespedes,
                      modalidadCobro,
                    );
                    return desglose ? (
                      <p className="mt-1.5 text-[11px] leading-snug text-[#666]">
                        {desglose}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}

              <textarea
                id="mensaje"
                rows={3}
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                placeholder={t?.reservar?.mensajePlaceholder
                  ? t.reservar.mensajePlaceholder(profile.nombre || "el proveedor")
                  : `Mensaje para ${profile.nombre || "el proveedor"} (opcional)...`}
                className="mt-4 w-full resize-y rounded-lg border px-3 py-2.5 text-[12px] text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/20"
                style={{ borderColor: "#e8e4de" }}
              />

              {precioListo && priceSummary.total > 0 && familiaInfo && (
                <div
                  className="mt-4 flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  style={{ borderColor: "#e8e4de", backgroundColor: "#f7f5f2" }}
                >
                  <label htmlFor="reservar-familia" className="text-[11px] font-medium text-[#444]">
                    {t?.reservar?.reservarBajoGrupo
                      ? t.reservar.reservarBajoGrupo(familiaInfo.nombre)
                      : `Reservar bajo el grupo familiar ${familiaInfo.nombre}`}
                  </label>
                  <button
                    type="button"
                    id="reservar-familia"
                    role="switch"
                    aria-checked={reservarComoFamilia}
                    onClick={() => setReservarComoFamilia((prev) => !prev)}
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
                    style={{
                      backgroundColor: reservarComoFamilia ? "#1d4f91" : "#d1d5db",
                    }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                      style={{ left: reservarComoFamilia ? "20px" : "2px" }}
                    />
                  </button>
                </div>
              )}

              {ofertaActiva && (
                <p className="mt-3 text-[11px] font-medium text-green-700">
                  {t?.reservar?.ofertaActiva
                    ? t.reservar.ofertaActiva(precioEfectivo, verticalConfig.priceSuffix)
                    : `Oferta activa: ${precioEfectivo}€${verticalConfig.priceSuffix}`}
                </p>
              )}
            </section>

            {/* Sección 2 — Política de cancelación */}
            {!isBundle && cancelPolicy && (
              <section
                className="rounded-[10px] border bg-white p-5"
                style={{ borderColor: "#e8e4de" }}
              >
                <SectionHeader number={2} title={t?.reservar?.politicaCancelacion ?? "Política de cancelación"} />
                <div
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: "#fdf3e3", borderColor: "#e8c47a" }}
                >
                  <p className="text-[12px] font-semibold text-[#854d0e]">
                    🛡️ {cancelPolicy.name}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[#854d0e]">
                    {cancelPolicy.description}
                  </p>
                  {refundPercentNow !== null && precioListo && (
                    <p className="mt-2 text-[10px] text-[#92400e]">
                      {t?.reservar?.siCancelarasAhora
                        ? t.reservar.siCancelarasAhora(refundPercentNow)
                        : `Si cancelaras ahora: ${refundPercentNow}% de reembolso`}
                    </p>
                  )}
                </div>
                {console.log("DEBUG checkout:", {
                  precioListo,
                  total: priceSummary.total,
                  ready: priceSummary.ready,
                  calendarioError,
                  disponibilidadChecking,
                })}
                {precioListo && priceSummary.total > 0 && (
                  <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 py-1">
                    <input
                      type="checkbox"
                      checked={aceptaPolitica}
                      onChange={(e) => setAceptaPolitica(e.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-[#1d4f91] accent-[#1d4f91] sm:mt-0.5 sm:h-4 sm:w-4"
                      style={{ backgroundColor: aceptaPolitica ? "#e8f0fb" : "#fff" }}
                    />
                    <span className="text-[11px] leading-relaxed text-[#444]">
                      {t?.reservar?.aceptoPoliticaFrase
                        ? t.reservar.aceptoPoliticaFrase(cancelPolicy.name)
                        : <>He leído y acepto la política de cancelación{" "}<strong style={{ color: "#1d4f91" }}>{cancelPolicy.name}</strong>{" "}y las condiciones del servicio</>}
                    </span>
                  </label>
                )}
              </section>
            )}

            {isBundle && (
              <section
                className="rounded-[10px] border bg-white p-5"
                style={{ borderColor: "#e8e4de" }}
              >
                <SectionHeader number={2} title={t?.reservar?.politicaCancelacion ?? "Política de cancelación"} />
                <div className="flex flex-col gap-3">
                  {selectedServices.map((svc) => {
                    const svcPolicy = getCancelPolicy(svc.cancellation_policy, cancelPolicies);
                    const svcConfig = verticals[svc.vertical] ?? verticals.alojamiento;
                    const svcName =
                      svc.titulo ||
                      `${svcConfig.label} · ${formatShortName(svc.profiles_public?.nombre, svc.profiles_public?.apellido)}`;
                    const providerName = formatShortName(
                      svc.profiles_public?.nombre,
                      svc.profiles_public?.apellido,
                    );
                    return (
                      <div
                        key={svc.id}
                        className="rounded-lg border p-4"
                        style={{ backgroundColor: "#fdf3e3", borderColor: "#e8c47a" }}
                      >
                        <p className="text-[12px] font-semibold text-[#2a3a4a]">
                          {svcName}
                        </p>
                        {providerName && (
                          <p className="mt-0.5 text-[10px] text-[#888]">{providerName}</p>
                        )}
                        {svcPolicy ? (
                          <>
                            <p className="mt-2 text-[12px] font-semibold text-[#854d0e]">
                              🛡️ {svcPolicy.name}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-[#854d0e]">
                              {svcPolicy.description}
                            </p>
                          </>
                        ) : (
                          <p className="mt-2 text-[11px] text-[#854d0e]">
                            {t?.reservar?.politicaNoEspecificada ?? "Política de cancelación no especificada"}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                {precioListo && priceSummary.total > 0 && (
                  <label className="mt-4 flex min-h-[44px] cursor-pointer items-start gap-3 py-1">
                    <input
                      type="checkbox"
                      checked={aceptaPolitica}
                      onChange={(e) => setAceptaPolitica(e.target.checked)}
                      className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded border-[#1d4f91] accent-[#1d4f91] sm:mt-0.5 sm:h-4 sm:w-4"
                      style={{ backgroundColor: aceptaPolitica ? "#e8f0fb" : "#fff" }}
                    />
                    <span className="text-[11px] leading-relaxed text-[#444]">
                      {t?.reservar?.aceptoPoliticaBundle ?? "He leído y acepto las políticas de cancelación de todos los servicios reservados"}
                    </span>
                  </label>
                )}
              </section>
            )}

            {/* Sección 3 — ¿Añades más servicios? */}
            <section
              className="rounded-[10px] border bg-white p-5"
              style={{ borderColor: "#e8e4de" }}
            >
              <SectionHeader number={3} title={t?.reservar?.anadirMasServicios ?? "¿Añades más servicios?"} />

              {datesReady ? (
                <>
                  {bundleServices.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          fontSize: 10,
                          color: "#0e7a5c",
                          fontWeight: 500,
                          marginBottom: 8,
                        }}
                      >
                        {t?.reservar?.anadidosAtuReserva ?? "✓ Añadidos a tu reserva"}
                      </div>
                      {bundleServices.map((s) => {
                        const entry = cartByServiceId[s.id];
                        const line = priceSummary.lines.find((l) => l.id === s.id);
                        const lineReady = Boolean(line?.ready);
                        const linePrice = lineReady ? line.total : null;
                        return (
                          <div
                            key={s.id}
                            style={{
                              background: lineReady ? "#e6f4f0" : "#f7f5f2",
                              border: `0.5px solid ${lineReady ? "#0e7a5c" : "#e8e4de"}`,
                              borderRadius: 7,
                              padding: "10px 12px",
                              marginBottom: 8,
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: "50%",
                                  background:
                                    s.vertical === "alojamiento"
                                      ? "#1d4f91"
                                      : s.vertical === "ninos"
                                        ? "#0e7a5c"
                                        : "#c47d1a",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 9,
                                  color: "#fff",
                                  fontWeight: 500,
                                  flexShrink: 0,
                                }}
                              >
                                {(s.titulo || "S")[0]}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 500,
                                    color: "#2a3a4a",
                                  }}
                                >
                                  {s.titulo}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    color: "#888",
                                    marginTop: 1,
                                  }}
                                >
                                  {s.profiles_public?.nombre}{" "}
                                  {s.profiles_public?.apellido}
                                </div>
                              </div>
                              <span
                                className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: lineReady
                                    ? "#d8f0e8"
                                    : "#fdf3e3",
                                  color: lineReady ? "#0e7a5c" : "#92400e",
                                }}
                              >
                                {lineReady ? "OK" : (t?.reservar?.faltanDatos ?? "Faltan datos")}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: lineReady ? "#0e7a5c" : "#888",
                                  flexShrink: 0,
                                }}
                              >
                                {linePrice != null
                                  ? formatEuro(linePrice)
                                  : "—"}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeComplementaryFromCart(s.id)}
                                aria-label={t?.reservar?.quitarServicioCarrito ?? "Quitar servicio del carrito"}
                                style={{
                                  fontSize: 14,
                                  color: "#e53e3e",
                                  background: "none",
                                  border: "none",
                                  cursor: "pointer",
                                  padding: "0 4px",
                                }}
                              >
                                ×
                              </button>
                            </div>
                            {entry && (
                              <CartLineBookingFields
                                entry={entry}
                                fechasOcupadas={
                                  fechasOcupadasByServiceId[s.id] ?? []
                                }
                                calendarOpen={cartCalendarOpenId === s.id}
                                onToggleCalendar={() =>
                                  setCartCalendarOpenId((cur) =>
                                    cur === s.id ? null : s.id,
                                  )
                                }
                                onPatch={(patch) => patchCartEntry(s.id, patch)}
                                onValidationError={(msg) =>
                                  setErrorMessage(msg || "")
                                }
                                t={t}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div
                    style={{
                      backgroundColor: "#e8f0fb",
                      borderRadius: 8,
                      padding: 14,
                    }}
                  >
                    <p className="text-[10px] font-semibold text-[#1d4f91]">
                      {t?.reservar?.disponiblesParaTusFechas ?? "✨ Disponibles para tus fechas"}
                    </p>
                    {filteredComplementary.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-2">
                        {filteredComplementary.map((comp) => {
                          const compConfig = verticals[comp.vertical] ?? verticals.alojamiento;
                          const isAdded = bundleServices.some((s) => s.id === comp.id);
                          const cardPricing = resolveServiceCardPricing(comp);
                          const providerName = formatShortName(
                            comp.profiles_public?.nombre,
                            comp.profiles_public?.apellido,
                          );
                          return (
                            <li
                              key={comp.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={{ backgroundColor: compConfig.color }}
                                />
                                <div className="min-w-0">
                                  <p className="truncate text-[11px] font-semibold text-[#1a1a1a]">
                                    {providerName || (t?.reservar?.proveedor ?? "Proveedor")}
                                  </p>
                                  <p className="truncate text-[10px] text-[#888]">
                                    {comp.titulo || compConfig.label}
                                    {cardPricing.priceLabel !== "Consultar"
                                      ? ` · ${cardPricing.priceLabel}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  toggleBundleService(comp);
                                }}
                                className="min-h-[44px] shrink-0 rounded px-3 py-2 text-[10px] font-semibold transition-colors"
                                style={
                                  isAdded
                                    ? { backgroundColor: "#1d4f91", color: "#fff", border: "1px solid #1d4f91" }
                                    : {
                                        border: "1px solid #1d4f91",
                                        color: "#1d4f91",
                                        backgroundColor: "#fff",
                                      }
                                }
                              >
                                {isAdded ? "✓" : (t?.reservar?.anadir ?? "+ Añadir")}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[10px] text-[#666]">
                        {t?.reservar?.sinServiciosComplementarios ?? "No hay servicios complementarios disponibles para estas fechas."}
                      </p>
                    )}
                  </div>

                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1" style={{ backgroundColor: "#e8e4de" }} />
                    <span className="text-[10px] text-[#bbb]">{t?.reservar?.noEncuentrasLoqueBuscas ?? "¿No encuentras lo que buscas?"}</span>
                    <div className="h-px flex-1" style={{ backgroundColor: "#e8e4de" }} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {availableBundleTabs.length > 0 ? (
                      availableBundleTabs.map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setBundleTab(tab.id)}
                          className="min-h-[44px] rounded-full px-3 py-2 text-[10px] font-semibold transition-colors"
                          style={
                            bundleTab === tab.id
                              ? { backgroundColor: "#1d4f91", color: "#fff" }
                              : {
                                  backgroundColor: "#f7f5f2",
                                  border: "1px solid #e8e4de",
                                  color: "#666",
                                }
                          }
                        >
                          {tab.label}
                        </button>
                      ))
                    ) : (
                      <p className="text-[10px] text-[#888]">
                        {formatCartVerticalsInCartMessage(selectedServices, t)}
                      </p>
                    )}
                  </div>

                  {availableBundleTabs.length === 0 ? null : tabServicesLoading ? (
                    <p className="mt-4 text-center text-[11px] text-[#888]">
                      {t?.reservar?.buscandoProveedores ?? "Buscando proveedores…"}
                    </p>
                  ) : tabServices.length > 0 ? (
                    <ul className="mt-4 flex flex-col gap-3">
                      {tabServices.map((comp) => {
                        const compConfig = verticals[comp.vertical] ?? verticals.alojamiento;
                        const isAdded = bundleServices.some((s) => s.id === comp.id);
                        const cardPricing = resolveServiceCardPricing(comp);
                        const providerName = formatShortName(
                          comp.profiles_public?.nombre,
                          comp.profiles_public?.apellido,
                        );
                        const compTags = getServiceDisplayTags(comp);
                        return (
                          <li
                            key={comp.id}
                            className="border bg-white p-3"
                            style={{ borderColor: "#e8e4de", borderRadius: 7 }}
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                                style={{ backgroundColor: compConfig.color }}
                              >
                                {getInitials(comp.profiles_public?.nombre, comp.profiles_public?.apellido)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[#1a1a1a]">
                                      {providerName}
                                    </p>
                                    <p className="text-[10px] text-[#888]">
                                      {comp.titulo || compConfig.label}
                                    </p>
                                    {compTags.length > 0 && (
                                      <div className="mt-1.5 flex flex-wrap gap-1">
                                        {compTags.map((tag) => (
                                          <ServiceTag key={tag.text} {...tag} />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <p className="shrink-0 text-[12px] font-semibold text-[#1a1a1a]">
                                    {cardPricing.priceLabel}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleBundleService(comp);
                                  }}
                                  className="mt-2 min-h-[44px] rounded px-3 py-2 text-[10px] font-semibold transition-colors"
                                  style={
                                    isAdded
                                      ? { backgroundColor: "#1d4f91", color: "#fff" }
                                      : {
                                          border: "1px solid #1d4f91",
                                          color: "#1d4f91",
                                          backgroundColor: "#fff",
                                        }
                                  }
                                >
                                  {isAdded ? (t?.reservar?.anadido ?? "Añadido ✓") : (t?.reservar?.anadir ?? "+ Añadir")}
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-center text-[11px] text-[#888]">
                      {t?.reservar?.sinProveedores ?? "No hay proveedores de este tipo disponibles para tus fechas."}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={goToBuscarBundle}
                    className="mt-4 block w-full rounded border py-2.5 text-center text-[11px] font-semibold transition-opacity hover:opacity-80"
                    style={{ borderColor: "#1d4f91", color: "#1d4f91", borderRadius: 6 }}
                  >
                    {t?.reservar?.verTodosProveedores ?? "🔍 Ver todos los proveedores disponibles →"}
                  </button>
                </>
              ) : (
                <p className="text-[11px] text-[#888]">
                  {t?.reservar?.completaFechasParaVer ?? "Completa las fechas de tu reserva para ver servicios adicionales disponibles."}
                </p>
              )}
            </section>

            {successMessage && (
              <p
                className={`rounded-lg px-4 py-3 text-sm ${
                  successVariant === "blue"
                    ? "bg-[#e8f0fb] text-[#1d4f91]"
                    : "bg-green-50 text-green-700"
                }`}
              >
                {successMessage}
              </p>
            )}
            {errorMessage && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            )}
          </div>

          {/* Columna derecha — Resumen */}
          <aside className="lg:sticky lg:top-[20px] lg:self-start">
            <div
              className="rounded-[10px] border bg-white p-5"
              style={{ borderColor: "#e8e4de" }}
            >
              <h3 className="text-[12px] font-medium text-[#1a1a1a]">
                {t?.reservar?.resumenPedido ?? "Resumen del pedido"}
              </h3>

              <div className="mt-4 flex gap-2.5">
                <div
                  className="flex h-10 w-12 shrink-0 items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${verticalConfig.color}22, ${verticalConfig.color}55)`,
                    borderRadius: 6,
                    width: 48,
                    height: 40,
                  }}
                >
                  <Icon className="h-5 w-5" style={{ color: verticalConfig.color }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#1a1a1a]">{fullProviderName}</p>
                  <p className="text-[10px] text-[#888]">
                    {providerAvgRating
                      ? `${providerAvgRating} ★`
                      : (t?.reservar?.sinValoraciones ?? "Sin valoraciones")}
                    {providerReviewCount > 0 &&
                      ` · ${t?.reservar?.nResenas ? t.reservar.nResenas(providerReviewCount) : `${providerReviewCount} reseña${providerReviewCount !== 1 ? "s" : ""}`}`}
                  </p>
                </div>
              </div>

              {precioListo || (isBundle && priceSummary.lines.length > 0) ? (
                <>
                  {precioListo ? (
                    <div className="mt-4 flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#444]">
                        {mainPriceLine?.detail}
                        {unitClientPrice != null
                          ? ` × ${formatEuro(unitClientPrice)}`
                          : ""}
                      </span>
                      <span className="shrink-0 text-[#1a1a1a]">
                        {mainPriceLine ? formatEuro(mainPriceLine.total) : "—"}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate text-[#444]">
                        {mainPriceLine?.name || (t?.reservar?.servicioPrincipal ?? "Servicio principal")}
                      </span>
                      <span
                        className="shrink-0 font-medium"
                        style={{
                          color: mainPriceLine?.ready ? "#1a1a1a" : "#92400e",
                        }}
                      >
                        {mainPriceLine?.ready
                          ? formatEuro(mainPriceLine.total)
                          : (t?.reservar?.faltanDatos ?? "Faltan datos")}
                      </span>
                    </div>
                  )}

                  {precioListo &&
                    serviceNeedsUnidadesSelector(service) &&
                    (() => {
                      const desglose = formatHuespedesPrecioDesglose(
                        cartByServiceId[service.id]?.service ?? service,
                        numHuespedes,
                        modalidadCobro,
                      );
                      return desglose ? (
                        <p className="mt-1.5 text-[10px] leading-snug text-[#888]">
                          {desglose}
                        </p>
                      ) : null;
                    })()}

                  {bundleLines.map((line) => {
                    const lineConfig = verticals[line.vertical] ?? verticalConfig;
                    return (
                      <div
                        key={line.id}
                        className="mt-2 flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: lineConfig.color }}
                          />
                          <span className="truncate text-[#666]">{line.name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            style={{
                              color: line.ready ? "#1a1a1a" : "#92400e",
                            }}
                          >
                            {line.ready ? formatEuro(line.total) : (t?.reservar?.faltanDatos ?? "Faltan datos")}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeComplementaryFromCart(line.id)}
                            className="flex min-h-[44px] min-w-[44px] items-center justify-center border-0 bg-transparent p-2 text-[14px] leading-none text-red-500 hover:text-red-700"
                            aria-label="Eliminar servicio"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {precioListo &&
                    priceSummary.lines
                    .filter((l) => l.discountSource === "duration" && l.discountPct > 0)
                    .map((line) => (
                      <div
                        key={line.id}
                        className="mt-2 flex items-center justify-between text-[11px] font-medium text-green-700"
                      >
                        <span>{t?.reservar?.descuentoEstancia ? t.reservar.descuentoEstancia(line.discountPct) : `Descuento estancia -${line.discountPct}%`}</span>
                        <span>✓</span>
                      </div>
                    ))}

                  {precioListo && creditoAplicado > 0 && (
                    <>
                      <div
                        className="mt-2 flex items-center justify-between text-[11px]"
                        style={{ marginTop: 8 }}
                      >
                        <span className="text-[#444]">{t?.reservar?.totalReserva ?? "Total reserva"}</span>
                        <span className="text-[#1a1a1a]">
                          {priceSummary.total.toFixed(2)}€
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-medium text-green-700">
                        <span>{t?.reservar?.creditoAplicado ?? "Crédito aplicado"}</span>
                        <span>−{creditoAplicado.toFixed(2)}€</span>
                      </div>
                    </>
                  )}

                  {precioListo ? (
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 8,
                        borderTop: "1px solid #e8e4de",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontWeight: 600,
                          fontSize: 14,
                        }}
                      >
                        <span className="text-[#1a1a1a]">
                          {creditoAplicado > 0 ? (t?.reservar?.totalAPagar ?? "Total a pagar") : (t?.reservar?.total ?? "Total")}
                        </span>
                        <span className="text-[#1a1a1a]">
                          {(creditoAplicado > 0
                            ? totalAPagar
                            : priceSummary.total
                          ).toFixed(2)}
                          €
                        </span>
                      </div>
                      {clienteSinComision ? (
                        <p
                          style={{
                            fontSize: 10,
                            color: "#0e7a5c",
                            marginTop: 4,
                            marginBottom: 0,
                          }}
                        >
                          {t?.reservar?.sinGastosGestion
                            ? t.reservar.sinGastosGestion(getReservasSinComisionCliente(perfilCliente))
                            : `🎁 Sin gastos de gestión · te quedan ${getReservasSinComisionCliente(perfilCliente)} reservas gratis`}
                        </p>
                      ) : (
                        <p
                          style={{
                            fontSize: 10,
                            color: "#888",
                            marginTop: 4,
                            marginBottom: 0,
                          }}
                        >
                          {t?.reservar?.gastosGestionIncluidos ?? "Gastos de gestión incluidos"}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-[#888]">{precioDetail}</p>
                  )}
                </>
              ) : (
                <p className="mt-4 text-[11px] text-[#888]">{precioDetail}</p>
              )}

              <div
                className="mt-4 rounded-lg p-3 text-[10px] leading-relaxed text-[#666]"
                style={{ backgroundColor: "#f7f5f2" }}
              >
                {t?.reservar?.pagoBloqueado ?? "🛡️ Pago retenido hasta que el servicio se completa. Reembolso total si algo falla."}
              </div>

              {clienteNoVerificado && dniBlockMessage && (
                <div
                  className="mt-4 rounded-lg px-3 py-2.5 text-[12px] leading-relaxed text-[#92400e]"
                  style={{ backgroundColor: "#fef3c7" }}
                >
                  {dniBlockMessage}
                  {showDniUploadLink && (
                    <>
                      {" "}
                      <Link
                        href={dniSubirHref}
                        className="font-semibold no-underline hover:underline"
                        style={{ color: "#1d4f91" }}
                      >
                        {dniRevisionEstado === "rechazado"
                          ? (t?.reservar?.volverASubir ?? "Volver a subir →")
                          : (t?.reservar?.subirDni ?? "Subir DNI →")}
                      </Link>
                    </>
                  )}
                  {dniRevisionEstado === "pendiente" && (
                    <>
                      {" "}
                      <Link
                        href={dniSubirHref}
                        className="font-semibold no-underline hover:underline"
                        style={{ color: "#1d4f91" }}
                      >
                        {t?.reservar?.verEstado ?? "Ver estado →"}
                      </Link>
                    </>
                  )}
                </div>
              )}

              {!clienteNoVerificado && clienteSinTelefono && (
                <div
                  className="mt-4 rounded-lg px-3 py-3 text-[12px] leading-relaxed"
                  style={{ backgroundColor: "#e8f0fb", color: "#1d4f91" }}
                >
                  <p className="font-semibold">{TELEFONO_REQUIRED_CLIENT_MSG}</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="tel"
                      value={telefonoDraft}
                      onChange={(e) => {
                        setTelefonoDraft(e.target.value);
                        setTelefonoSaveError("");
                      }}
                      placeholder="+34 600 000 000"
                      disabled={telefonoSaving}
                      className="min-h-[44px] flex-1 rounded-lg border bg-white px-3 text-[13px] text-[#1a1a1a]"
                      style={{ borderColor: "#c5d4eb" }}
                    />
                    <button
                      type="button"
                      disabled={telefonoSaving}
                      onClick={async () => {
                        const stored = telefonoForStorage(telefonoDraft);
                        if (!stored) {
                          setTelefonoSaveError(TELEFONO_INVALID_MSG);
                          return;
                        }
                        if (!userId) return;
                        setTelefonoSaving(true);
                        setTelefonoSaveError("");
                        const { error } = await supabase
                          .from("profiles")
                          .update({ telefono: stored })
                          .eq("id", userId);
                        setTelefonoSaving(false);
                        if (error) {
                          setTelefonoSaveError(
                            error.message || "No se pudo guardar el teléfono.",
                          );
                          return;
                        }
                        setPerfilCliente((prev) =>
                          prev ? { ...prev, telefono: stored } : prev,
                        );
                        setTelefonoDraft(stored);
                      }}
                      className="min-h-[44px] shrink-0 rounded-lg px-4 text-[12px] font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#1d4f91" }}
                    >
                      {telefonoSaving ? (t?.reservar?.guardandoTelefono ?? "Guardando…") : (t?.reservar?.guardarTelefono ?? "Guardar teléfono")}
                    </button>
                  </div>
                  {telefonoSaveError && (
                    <p className="mt-2 text-[11px] text-red-700">
                      {telefonoSaveError}
                    </p>
                  )}
                </div>
              )}

              {bookabilityBlock && (
                <p
                  className="mt-4 rounded-lg px-3 py-2.5 text-[12px] leading-relaxed text-[#92400e]"
                  style={{ backgroundColor: "#fef3c7" }}
                >
                  {bookabilityBlock}
                </p>
              )}

              {precioListo && priceSummary.total > 0 && !bookabilityBlock && !clienteNoVerificado && !clienteSinTelefono ? (
                isBundle ? (
                  paymentMethodsLoading ? (
                    <p className="mt-4 text-center text-[11px] text-[#666]">
                      {t?.reservar?.preparandoFormularioPago ?? "Preparando formulario de pago…"}
                    </p>
                  ) : savedPaymentMethods.length > 0 &&
                    !useNewCard &&
                    selectedPaymentMethod &&
                    stripeCustomerId &&
                    grupoReserva ? (
                    <BundleSavedCardCheckout
                      priceSummary={priceSummary}
                      creditoAplicado={creditoAplicado}
                      totalAPagar={totalAPagar}
                      paymentMethod={selectedPaymentMethod}
                      stripeCustomerId={stripeCustomerId}
                      userId={userId}
                      grupoReserva={grupoReserva}
                      onComplete={completeBundleBooking}
                      onUseNewCard={() => setUseNewCard(true)}
                      getBookingDateError={() =>
                        validateBookingDates(vertical, fechaInicio, hora, t)
                      }
                      disabled={!aceptaPolitica}
                      t={t}
                    />
                  ) : grupoReserva ? (
                    <>
                      <BundleNewCardCheckout
                        priceSummary={priceSummary}
                        creditoAplicado={creditoAplicado}
                        totalAPagar={totalAPagar}
                        userId={userId}
                        grupoReserva={grupoReserva}
                        stripeCustomerId={stripeCustomerId}
                        setStripeCustomerId={setStripeCustomerId}
                        userEmail={userEmail}
                        clienteNombre={[perfilCliente?.nombre, perfilCliente?.apellido]
                          .filter(Boolean)
                          .join(" ")}
                        onComplete={completeBundleBooking}
                        vertical={vertical}
                        fechaInicio={fechaInicio}
                        hora={hora}
                        setErrorMessage={setErrorMessage}
                        service={service}
                        disabled={!aceptaPolitica}
                        t={t}
                      />
                      {savedPaymentMethods.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setUseNewCard(false)}
                          className="mt-3 w-full text-center text-[11px] font-medium no-underline hover:underline"
                          style={{ color: "#1d4f91" }}
                        >
                          {t?.reservar?.usarTarjetaGuardada ?? "Usar tarjeta guardada"}
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white opacity-60"
                      style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
                    >
                      {t?.reservar?.pagarBtn
                        ? t.reservar.pagarBtn(totalAPagar > 0 ? formatEuro(totalAPagar) : "")
                        : `Pagar ${totalAPagar > 0 ? formatEuro(totalAPagar) : ""} →`}
                    </button>
                  )
                ) : paymentMethodsLoading || paymentIntentLoading ? (
                  <p className="mt-4 text-center text-[11px] text-[#666]">
                    {t?.reservar?.preparandoFormularioPago ?? "Preparando formulario de pago…"}
                  </p>
                ) : savedPaymentMethods.length > 0 &&
                  !useNewCard &&
                  selectedPaymentMethod &&
                  paymentMetadata &&
                  stripeCustomerId ? (
                  <SavedCardCheckout
                    precioTotal={totalAPagar}
                    paymentMethod={selectedPaymentMethod}
                    stripeCustomerId={stripeCustomerId}
                    userId={userId}
                    metadata={paymentMetadata}
                    onPaymentSuccess={completeBooking}
                    onUseNewCard={() => setUseNewCard(true)}
                    getBookingDateError={() =>
                      validateBookingDates(vertical, fechaInicio, hora, t)
                    }
                    disabled={!aceptaPolitica}
                    t={t}
                  />
                ) : clientSecret && paymentMetadata ? (
                  <>
                    <Elements
                      key={clientSecret}
                      stripe={stripePromise}
                      options={{ clientSecret }}
                    >
                      <CheckoutForm
                        precioTotal={totalAPagar}
                        paymentIntentId={paymentIntentId}
                        metadata={paymentMetadata}
                        stripeCustomerId={stripeCustomerId}
                        userId={userId}
                        userEmail={userEmail}
                        clienteNombre={[perfilCliente?.nombre, perfilCliente?.apellido]
                          .filter(Boolean)
                          .join(" ")}
                        onPaymentSuccess={completeBooking}
                        onNeedNewPaymentIntent={() => {
                          setPaymentRetryKey((k) => k + 1);
                        }}
                        vertical={vertical}
                        fechaInicio={fechaInicio}
                        hora={hora}
                        setErrorMessage={setErrorMessage}
                        service={service}
                        disabled={!aceptaPolitica}
                        t={t}
                      />
                    </Elements>
                    {savedPaymentMethods.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setUseNewCard(false)}
                        className="mt-3 w-full text-center text-[11px] font-medium no-underline hover:underline"
                        style={{ color: "#1d4f91" }}
                      >
                        {t?.reservar?.usarTarjetaGuardada ?? "Usar tarjeta guardada"}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white opacity-60"
                    style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
                  >
                    {t?.reservar?.pagarBtn
                      ? t.reservar.pagarBtn(totalAPagar > 0 ? formatEuro(totalAPagar) : "")
                      : `Pagar ${totalAPagar > 0 ? formatEuro(totalAPagar) : ""} →`}
                  </button>
                )
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-4 min-h-[44px] w-full py-3 text-[13px] font-semibold text-white opacity-60"
                  style={{ backgroundColor: "#1d4f91", borderRadius: 6 }}
                >
                  {payBlockedReason && incompletePriceLine
                    ? payBlockedReason.length > 48
                      ? (t?.reservar?.completaX
                          ? t.reservar.completaX(incompletePriceLine.name)
                          : `Completa: ${incompletePriceLine.name}`)
                      : payBlockedReason
                    : payBlockedReason || (t?.reservar?.pagarSimple ?? "Pagar →")}
                </button>
              )}

              {freeCancelDateStr && (
                <p className="mt-3 text-center text-[9px] text-[#bbb]">
                  {t?.reservar?.pagoSeguro
                    ? t.reservar.pagoSeguro(freeCancelDateStr)
                    : `Pago seguro con Stripe · Cancelación gratuita hasta ${freeCancelDateStr}`}
                </p>
              )}
              {!freeCancelDateStr && (
                <p className="mt-3 text-center text-[9px] text-[#bbb]">
                  {t?.reservar?.pagoSeguroSimple ?? "Pago seguro con Stripe"}
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
