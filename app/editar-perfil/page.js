"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import AlojamientoServiceFields from "@/app/components/provider/AlojamientoServiceFields";
import NinosServiceFields from "@/app/components/provider/NinosServiceFields";
import MascotasServiceFields from "@/app/components/provider/MascotasServiceFields";
import AmenitiesPicker from "@/app/components/AmenitiesPicker";
import BanoTipoSelector from "@/app/components/BanoTipoSelector";
import ProveedorEmergenciaToggle from "@/app/components/ProveedorEmergenciaToggle";
import CalendarioTarifas from "@/app/components/CalendarioTarifas";
import ServiceOperationalFields from "@/app/components/ServiceOperationalFields";
import ServiceStepHeader from "@/app/components/provider/ServiceStepHeader";
import DireccionContactoFields from "@/app/components/provider/DireccionContactoFields";
import CounterField from "@/app/components/provider/CounterField";
import TagPill from "@/app/components/provider/TagPill";
import ProviderDocumentsSection from "@/app/components/provider/ProviderDocumentsSection";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  DOCUMENT_LABELS,
  PROFILE_LABELS,
  PROVIDER_INPUT_CLASS,
  SERVICE_LABELS,
  serviceDescripcionPlaceholder,
  serviceFotosLabel,
  servicePrecioLabel,
} from "@/app/lib/provider-form-labels";
import {
  PRIMARY,
  VERTICALS,
  getServiceHeaderTitle,
  getVerticalColor,
  GREEN,
  ORANGE,
} from "@/app/lib/provider-verticals";
import {
  DEFAULT_CAPACIDAD_ALOJAMIENTO,
  parseCapacidadFromDb,
  serializeCapacidad,
} from "@/app/lib/capacidad";
import {
  normalizeDescuentosDuracion,
  serializeDescuentosDuracionForDb,
} from "@/app/lib/descuentosDuracion";
import { RELACION_OPTIONS } from "@/app/lib/referencias";
import { buildEditarPerfilTabHref } from "@/app/lib/editar-perfil-routes";
import {
  MODALIDAD_MASCOTAS_OPTIONS,
  MODALIDAD_NINOS_OPTIONS,
  TIPO_ALOJAMIENTO_EDIT_OPTIONS,
} from "@/app/lib/service-form-tags";
import {
  buildServicePayload,
  DEFAULT_NORMAS,
  DIAS_DISPONIBLES_DEFAULT,
  getServiceLocationFields,
  parseAnosExperienciaFromDb,
  parseCheckTimesFromDb,
  parseMascotasBooleansFromDb,
  parseMascotasDetalleFromDb,
  parseNinosDetalleFromDb,
  parseNormasFromDb,
} from "@/app/lib/service-payload";
import {
  formatMissingPublishDocumentLabels,
  getMissingPublishDocumentsForVertical,
} from "@/app/lib/provider-documents";
import { getServiceDescription } from "@/app/lib/service-card-display";
import { supabase } from "@/app/lib/supabase";

import {
  loadProviderDocuments,
  persistProviderDocument,
  uploadProfilePhoto,
  uploadServicePhoto,
} from "@/app/lib/provider-uploads";
import {
  COBROS_REQUERIDOS_MSG,
  getActivacionBloqueoMensaje,
  getProviderAnuncioHref,
  getServiceVisibilidadEstado,
  puedeActivarServicio,
  proveedorPuedePublicar,
  resolveDisponibleForSave,
  REVISION_PENDIENTE_MSG,
} from "@/app/lib/provider-publicacion";

const SERVICE_VERTICAL_TABS = ["alojamiento", "ninos", "mascotas"];

function buildPublishReminderMessage(vertical, missingDocs) {
  const verticalLabel =
    VERTICALS.find((v) => v.id === vertical)?.label?.toLowerCase() || vertical;
  const list = formatMissingPublishDocumentLabels(missingDocs).join(", ");
  return `Guardamos tus cambios. Para publicar tu ${verticalLabel}, todavía necesitas: ${list}.`;
}

function DocumentsPublishReminder({ vertical, missingDocs }) {
  if (!vertical || missingDocs.length === 0) return null;

  const verticalLabel =
    VERTICALS.find((v) => v.id === vertical)?.label?.toLowerCase() || vertical;
  const list = formatMissingPublishDocumentLabels(missingDocs).join(", ");

  return (
    <div
      className="mb-4 rounded-lg border px-4 py-3 text-sm leading-relaxed"
      style={{
        borderColor: "#c47d1a",
        backgroundColor: "#fdf4e7",
        color: "#5c4a32",
      }}
    >
      <p className="font-semibold">Documentación pendiente para publicar</p>
      <p className="mt-1">
        Guardamos tus cambios. Para publicar tu {verticalLabel}, todavía necesitas:{" "}
        <span className="font-medium">{list}</span>.
      </p>
    </div>
  );
}

const SERVICE_ACTIVE_GREEN = "#0e7a5c";
const inputClass = PROVIDER_INPUT_CLASS;

const IDIOMAS_DEFAULT = [
  "Español",
  "English",
  "Français",
  "Deutsch",
  "Italiano",
  "Português",
  "中文",
];

const SERVICE_VERTICAL_TAB_ORDER = ["alojamiento", "ninos", "mascotas"];

function getVerticalsFromServices(services) {
  return [...new Set(services.map((s) => s.vertical).filter(Boolean))];
}

function resolveTabFromParam(tabParam, services) {
  const verticalsActivos = getVerticalsFromServices(services);
  const tieneServicios = services.length > 0;

  if (!tabParam) return "perfil";

  if (tabParam === "servicios") {
    if (!tieneServicios) return "perfil";
    for (const vertical of SERVICE_VERTICAL_TAB_ORDER) {
      if (verticalsActivos.includes(vertical)) return vertical;
    }
    return "perfil";
  }

  if (tabParam === "perfil") return "perfil";
  if (tabParam === "cuenta") return "cuenta";
  if (tabParam === "documentos") {
    return tieneServicios ? "documentos" : "perfil";
  }
  if (
    SERVICE_VERTICAL_TAB_ORDER.includes(tabParam) &&
    verticalsActivos.includes(tabParam)
  ) {
    return tabParam;
  }

  return "perfil";
}

function emptyServiceDetails() {
  return {
    titulo: "",
    descripcion: "",
    precio: "",
    tipo_alojamiento: "",
    modalidad: "domicilio_cliente",
    direccion_exacta: "",
    telefono_contacto: "",
    estancia_minima: "1",
    estancia_maxima: "",
    antelacion_minima: 24,
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    cancelacion: "moderada",
    reserva_inmediata: false,
    oferta_activa: false,
    oferta_titulo: "",
    oferta_descuento: "",
    oferta_valida_hasta: "",
    oferta_descripcion: "",
    disponible_para_viajar: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
    proveedor_emergencia: false,
    amenities: [],
    foto_url: "",
    capacidad: { ...DEFAULT_CAPACIDAD_ALOJAMIENTO },
    nru: "",
    normas: { ...DEFAULT_NORMAS },
    check_in: "15:00",
    check_out: "11:00",
    anos_experiencia: "",
    edadesTags: [],
    formacionTags: [],
    actividadesTags: [],
    nochesFinde: false,
    carnetConducir: false,
    animalesTags: [],
    tamanoPerro: "",
    certificacionesTags: [],
    jardin: false,
    paseosIncluidos: false,
    cercaVeterinario: false,
  };
}

/** Asegura defaults seguros para el formulario (servicios legacy con campos null en BD). */
function mergeServiceDetails(rawDetails, vertical) {
  const merged = { ...emptyServiceDetails(), ...(rawDetails || {}) };

  merged.amenities = Array.isArray(merged.amenities) ? merged.amenities : [];
  merged.edadesTags = Array.isArray(merged.edadesTags) ? merged.edadesTags : [];
  merged.formacionTags = Array.isArray(merged.formacionTags) ? merged.formacionTags : [];
  merged.actividadesTags = Array.isArray(merged.actividadesTags) ? merged.actividadesTags : [];
  merged.animalesTags = Array.isArray(merged.animalesTags) ? merged.animalesTags : [];
  merged.certificacionesTags = Array.isArray(merged.certificacionesTags)
    ? merged.certificacionesTags
    : [];
  merged.tamanoPerro = merged.tamanoPerro || "";
  merged.anos_experiencia =
    merged.anos_experiencia != null ? String(merged.anos_experiencia) : "";
  merged.nru = merged.nru || "";
  merged.capacidad = merged.capacidad ?? { ...DEFAULT_CAPACIDAD_ALOJAMIENTO };

  if (vertical === "alojamiento") {
    merged.normas = parseNormasFromDb({ normas: rawDetails?.normas ?? merged.normas });
    Object.assign(merged, parseCheckTimesFromDb(rawDetails || {}));
  } else if (vertical === "ninos" || vertical === "mascotas") {
    merged.anos_experiencia = parseAnosExperienciaFromDb(rawDetails || {});
  }

  return merged;
}

function mapServiceFromDb(row) {
  const tiers = normalizeDescuentosDuracion(row.descuentos_duracion);
  const baseDetails = {
    ...emptyServiceDetails(),
    titulo: row.titulo || "",
    descripcion: getServiceDescription(row),
    precio: row.precio ?? "",
    tipo_alojamiento: row.tipo_alojamiento || "",
    modalidad: row.modalidad || "domicilio_cliente",
    estancia_minima: row.estancia_minima ?? "",
    estancia_maxima: row.estancia_maxima ?? "",
    antelacion_minima: row.antelacion_minima ?? 24,
    dias_disponibles:
      row.dias_disponibles?.length > 0
        ? row.dias_disponibles
        : [...DIAS_DISPONIBLES_DEFAULT],
    cancelacion: row.cancellation_policy || "moderada",
    reserva_inmediata: row.reserva_inmediata === true,
    oferta_activa: !!(row.oferta_descuento && row.oferta_valida_hasta),
    oferta_titulo: row.oferta_titulo || "",
    oferta_descuento: row.oferta_descuento ?? "",
    oferta_valida_hasta: row.oferta_valida_hasta || "",
    oferta_descripcion: row.oferta_descripcion || "",
    disponible_para_viajar: row.disponible_para_viajar === true,
    descuentos_duracion_activa: tiers.length > 0,
    descuentos_duracion:
      tiers.length > 0
        ? tiers.map((t) => ({
            minDias: String(t.minDias),
            descuento: String(t.descuento),
          }))
        : [{ minDias: "", descuento: "" }],
    proveedor_emergencia: row.proveedor_emergencia === true,
    amenities: row.amenities || [],
    foto_url: row.foto_url || "",
    capacidad: parseCapacidadFromDb(row),
    direccion_exacta: row.direccion_exacta || "",
    telefono_contacto: row.telefono_contacto || "",
    nru: row.nru || "",
  };

  let verticalDetails = {};
  if (row.vertical === "alojamiento") {
    verticalDetails = {
      normas: parseNormasFromDb(row),
      ...parseCheckTimesFromDb(row),
    };
  } else if (row.vertical === "ninos") {
    verticalDetails = {
      anos_experiencia: parseAnosExperienciaFromDb(row),
      ...parseNinosDetalleFromDb(row),
    };
  } else if (row.vertical === "mascotas") {
    verticalDetails = {
      anos_experiencia: parseAnosExperienciaFromDb(row),
      ...parseMascotasDetalleFromDb(row),
      ...parseMascotasBooleansFromDb(row),
      fotosActualizaciones: false,
    };
  }

  return {
    id: row.id,
    vertical: row.vertical,
    disponible: row.disponible !== false,
    disponibleOnLoad: row.disponible !== false,
    revision_estado: row.revision_estado ?? null,
    isNew: false,
    details: mergeServiceDetails(
      {
        ...baseDetails,
        ...verticalDetails,
      },
      row.vertical,
    ),
  };
}

function SectionLabel({ number, title }) {
  return (
    <p
      className="text-[11px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: BRAND.primary }}
    >
      {number} · {title}
    </p>
  );
}

function ServiceDisponibleRow({
  service,
  perfil,
  documentContext,
  onToggle,
  compact = false,
}) {
  const activo = service.disponible;
  const puedeActivar = puedeActivarServicio(service, perfil, documentContext);
  const switchBlocked = !activo && !puedeActivar;
  const visibilidad = getServiceVisibilidadEstado(perfil, activo, {
    service,
    documentContext,
  });

  const switchControl = (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={activo ? "Desactivar servicio" : "Activar servicio"}
      aria-disabled={switchBlocked}
      onClick={() => onToggle(service.id)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
        switchBlocked ? "cursor-not-allowed opacity-50" : ""
      }`}
      style={{
        backgroundColor: activo ? SERVICE_ACTIVE_GREEN : "#d1d5db",
      }}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{
          left: activo ? "calc(100% - 1.625rem)" : "0.125rem",
        }}
      />
    </button>
  );

  if (compact) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <span
          className="text-xs font-semibold"
          style={{ color: visibilidad.color }}
        >
          {visibilidad.label}
        </span>
        {switchControl}
      </div>
    );
  }

  return (
    <div
      className="mt-3 flex items-center justify-between gap-4 border-t pt-3"
      style={{ borderColor: BRAND.border }}
    >
      <div>
        <p
          className="text-sm font-semibold"
          style={{ color: visibilidad.color }}
        >
          {visibilidad.label}
        </p>
        <p className="text-xs text-[#888]">{visibilidad.subtitle}</p>
      </div>
      {switchControl}
    </div>
  );
}

function OfertaEspecialFields({ serviceId, details, onChange }) {
  const enabled = details.oferta_activa === true;

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  return (
    <div className="mt-6 border-t pt-6" style={{ borderColor: BRAND.border }}>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[#1a1a1a]">
          ¿Tienes una oferta especial?
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => update("oferta_activa", !enabled)}
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? BRAND.primary : "#d1d5db" }}
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
            style={{ left: enabled ? "calc(100% - 1.625rem)" : "0.125rem" }}
          />
        </button>
      </div>
      {enabled && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Título de la oferta
            </label>
            <input
              type="text"
              value={details.oferta_titulo}
              onChange={(e) => update("oferta_titulo", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Descuento (%)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={details.oferta_descuento}
              onChange={(e) => update("oferta_descuento", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Válida hasta
            </label>
            <input
              type="date"
              value={details.oferta_valida_hasta}
              onChange={(e) => update("oferta_valida_hasta", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Descripción de la oferta
            </label>
            <textarea
              rows={3}
              value={details.oferta_descripcion}
              onChange={(e) => update("oferta_descripcion", e.target.value)}
              className={`${inputClass} resize-y`}
              style={{ borderColor: BRAND.border }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function DescuentosDuracionFields({ serviceId, details, onChange }) {
  const enabled = details.descuentos_duracion_activa === true;
  const niveles = Array.isArray(details.descuentos_duracion)
    ? details.descuentos_duracion
    : [{ minDias: "", descuento: "" }];
  const unitLabel =
    serviceId === "alojamiento"
      ? "noches"
      : serviceId === "ninos"
        ? "horas"
        : "días";

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  function updateNivel(index, field, val) {
    const next = niveles.map((n, i) =>
      i === index ? { ...n, [field]: val } : n,
    );
    update("descuentos_duracion", next);
  }

  return (
    <div className="mt-6 border-t pt-6" style={{ borderColor: BRAND.border }}>
      <p className="text-sm font-semibold text-[#1a1a1a]">Descuentos por duración</p>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-sm text-[#444]">
          ¿Ofreces descuento por estancias largas?
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() =>
            onChange({
              ...details,
              descuentos_duracion_activa: !enabled,
              descuentos_duracion:
                !enabled && niveles.length === 0
                  ? [{ minDias: "", descuento: "" }]
                  : niveles,
            })
          }
          className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
          style={{ backgroundColor: enabled ? BRAND.primary : "#d1d5db" }}
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
            style={{ left: enabled ? "calc(100% - 1.625rem)" : "0.125rem" }}
          />
        </button>
      </div>
      {enabled && (
        <div className="mt-4 flex flex-col gap-4">
          {niveles.map((nivel, index) => (
            <div
              key={index}
              className="rounded-xl border p-4"
              style={{ borderColor: BRAND.border }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#444]">
                    A partir de X {unitLabel}
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={nivel.minDias}
                    onChange={(e) => updateNivel(index, "minDias", e.target.value)}
                    className={inputClass}
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#444]">
                    Descuento (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={nivel.descuento}
                    onChange={(e) =>
                      updateNivel(index, "descuento", e.target.value)
                    }
                    className={inputClass}
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>
            </div>
          ))}
          {niveles.length < 3 && (
            <button
              type="button"
              onClick={() =>
                update("descuentos_duracion", [
                  ...niveles,
                  { minDias: "", descuento: "" },
                ])
              }
              className="self-start text-sm font-semibold"
              style={{ color: BRAND.primary }}
            >
              Añadir otro nivel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ServiceEditForm({ vertical, details: rawDetails, onChange, userId }) {
  const servicePhotoInputRef = useRef(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const details = useMemo(
    () => mergeServiceDetails(rawDetails, vertical),
    [rawDetails, vertical],
  );

  function update(field, val) {
    onChange({ ...(rawDetails || {}), [field]: val });
  }

  async function handleServicePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setPhotoUploading(true);
    try {
      const url = await uploadServicePhoto(userId, "alojamiento", file, 0);
      update("foto_url", url);
    } catch (err) {
      console.error("Error subiendo foto:", err);
    } finally {
      setPhotoUploading(false);
      e.target.value = "";
    }
  }

  const capacidad = details.capacidad ?? { ...DEFAULT_CAPACIDAD_ALOJAMIENTO };
  const updCap = (key, val) =>
    onChange({ ...details, capacidad: { ...capacidad, [key]: val } });

  return (
    <>
      <ServiceStepHeader
        title={getServiceHeaderTitle(vertical)}
        color={getVerticalColor(vertical)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          {SERVICE_LABELS.titulo}
        </label>
        <input
          type="text"
          required
          value={details.titulo}
          onChange={(e) => update("titulo", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          {SERVICE_LABELS.descripcion}
        </label>
        <textarea
          value={details.descripcion || ""}
          onChange={(e) => update("descripcion", e.target.value)}
          placeholder={serviceDescripcionPlaceholder(vertical)}
          rows={4}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      {(vertical === "ninos" || vertical === "mascotas") && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
          <input
            type="number"
            min="0"
            value={details.anos_experiencia ?? ""}
            onChange={(e) => update("anos_experiencia", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
      )}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          {servicePrecioLabel(vertical)}
        </label>
        <input
          type="number"
          min="0"
          value={details.precio}
          onChange={(e) => update("precio", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      {vertical === "alojamiento" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">NRU</label>
          <input
            value={details.nru || ""}
            onChange={(e) => update("nru", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
      )}
      {vertical === "alojamiento" ? (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-[#444]">{SERVICE_LABELS.tipoAlojamiento}</p>
          <div className="flex flex-col gap-2">
            {TIPO_ALOJAMIENTO_EDIT_OPTIONS.map((option) => {
              const selected = details.tipo_alojamiento === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("tipo_alojamiento", option.value)}
                  className="rounded-xl border p-3 text-left transition-colors"
                  style={{
                    borderColor: selected ? BRAND.primary : BRAND.border,
                    backgroundColor: selected ? BRAND.light : "#fff",
                  }}
                >
                  <span className="text-sm font-semibold text-[#1a1a1a]">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-[#444]">{SERVICE_LABELS.modalidad}</p>
          <div className="flex flex-col gap-2">
            {(vertical === "mascotas"
              ? MODALIDAD_MASCOTAS_OPTIONS
              : MODALIDAD_NINOS_OPTIONS
            ).map((option) => {
              const selected = details.modalidad === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => update("modalidad", option.value)}
                  className="rounded-xl border p-3 text-left transition-colors"
                  style={{
                    borderColor: selected ? BRAND.primary : BRAND.border,
                    backgroundColor: selected ? BRAND.light : "#fff",
                  }}
                >
                  <span className="text-sm font-semibold text-[#1a1a1a]">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <DireccionContactoFields d={details} upd={update} vertical={vertical} />
      {vertical === "alojamiento" && (
        <>
          <div className="sm:col-span-2">
            <p className="mb-3 text-xs font-medium text-[#444]">{SERVICE_LABELS.capacidad}</p>
            <div className="grid grid-cols-4 gap-3">
              <CounterField
                label={SERVICE_LABELS.capacidadPersonas}
                value={capacidad.personas}
                onChange={(v) => updCap("personas", v)}
                min={1}
              />
              <CounterField
                label={SERVICE_LABELS.capacidadHabitaciones}
                value={capacidad.habitaciones}
                onChange={(v) => updCap("habitaciones", v)}
                min={1}
              />
              <CounterField
                label={SERVICE_LABELS.capacidadCamas}
                value={capacidad.camas}
                onChange={(v) => updCap("camas", v)}
                min={1}
              />
              <CounterField
                label={SERVICE_LABELS.capacidadBanos}
                value={capacidad.banos}
                onChange={(v) => updCap("banos", v)}
                min={1}
              />
            </div>
            <BanoTipoSelector
              className="mt-4"
              value={capacidad.bano_tipo ?? null}
              onChange={(v) => updCap("bano_tipo", v)}
              accentColor={BRAND.primary}
            />
          </div>
          <AlojamientoServiceFields
            className="sm:col-span-2"
            details={details}
            onChange={onChange}
            accentColor={PRIMARY}
          />
          <div className="sm:col-span-2">
            <AmenitiesPicker
              value={details.amenities || []}
              onChange={(ids) => update("amenities", ids)}
              accentColor={BRAND.primary}
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs font-medium text-[#444]">{serviceFotosLabel(vertical, "edit")}</p>
            <input
              ref={servicePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleServicePhotoChange}
            />
            {details.foto_url ? (
              <div className="relative mb-3 inline-block h-32 w-48 overflow-hidden rounded-xl border" style={{ borderColor: BRAND.border }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={details.foto_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <p className="mb-3 text-xs text-[#888]">Sin foto subida</p>
            )}
            <button
              type="button"
              onClick={() => servicePhotoInputRef.current?.click()}
              disabled={photoUploading || !userId}
              className="rounded-lg border px-4 py-2 text-xs font-semibold disabled:opacity-60"
              style={{ borderColor: BRAND.primary, color: BRAND.primary }}
            >
              {photoUploading
                ? "Subiendo…"
                : details.foto_url
                  ? "Cambiar foto"
                  : "Subir foto"}
            </button>
          </div>
        </>
      )}
      {vertical === "ninos" && (
        <NinosServiceFields
          className="sm:col-span-2"
          details={details}
          onChange={onChange}
          accentColor={GREEN}
          showAnosExperiencia={false}
        />
      )}
      {vertical === "mascotas" && (
        <MascotasServiceFields
          className="sm:col-span-2"
          details={details}
          onChange={onChange}
          accentColor={ORANGE}
          showAnosExperiencia={false}
        />
      )}
      <ServiceOperationalFields
        vertical={vertical}
        details={details}
        onChange={onChange}
        sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
      />
      <div className="sm:col-span-2">
        <OfertaEspecialFields
          serviceId={vertical}
          details={details}
          onChange={onChange}
        />
      </div>
      <div className="sm:col-span-2">
        <DescuentosDuracionFields
          serviceId={vertical}
          details={details}
          onChange={onChange}
        />
      </div>
      <div className="sm:col-span-2">
        <ProveedorEmergenciaToggle
          checked={details.proveedor_emergencia === true}
          onChange={(value) => update("proveedor_emergencia", value)}
        />
      </div>
      </div>
    </>
  );
}

function Card({ title, headerRight, children }) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: BRAND.border, marginBottom: 16 }}
    >
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[#1a1a1a]">{title}</p>
          {headerRight}
        </div>
      )}
      {children}
    </div>
  );
}

function PreviewPanel({ fotoPreview, nombre, apellido, ciudad, services }) {
  const displayName = [nombre, apellido].filter(Boolean).join(" ") || "Tu nombre";
  const initials = [nombre?.[0], apellido?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const firstService = services.find((s) => s.disponible) || services[0];
  const verticalMeta = firstService
    ? VERTICALS.find((v) => v.id === firstService.vertical)
    : null;
  const priceUnit =
    firstService?.vertical === "alojamiento"
      ? "/noche"
      : firstService?.vertical === "ninos"
        ? "/hora"
        : "/día";

  return (
    <div
      className="sticky top-4 rounded-2xl border bg-white p-4 shadow-sm"
      style={{ borderColor: BRAND.border }}
    >
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-[#888]">
        Vista previa
      </p>
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: BRAND.border }}>
        <div className="flex h-32 items-center justify-center bg-[#f5f3ef]">
          {fotoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              {initials}
            </span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {displayName}
          </h3>
          {ciudad && <p className="text-xs text-[#666]">{ciudad}</p>}
          <div className="mt-2 flex flex-wrap gap-1">
            {services.map((s) => {
              const v = VERTICALS.find((x) => x.id === s.vertical);
              return (
                <span
                  key={s.id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: v?.color || PRIMARY }}
                >
                  {v?.label || s.vertical}
                </span>
              );
            })}
          </div>
          {firstService?.details.precio && (
            <p className="mt-2 text-lg font-bold" style={{ color: PRIMARY }}>
              {firstService.details.precio}€
              <span className="text-sm font-normal text-[#666]">{priceUnit}</span>
            </p>
          )}
          <button
            type="button"
            className="mt-3 w-full rounded-xl py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}

function EditarPerfilPageFallback() {
  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
      <main className="px-6 py-16 text-center text-sm text-[#666]">Cargando perfil…</main>
    </div>
  );
}

function EditarPerfilContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const profilePhotoRef = useRef(null);
  const documentInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("perfil");
  const [dirty, setDirty] = useState(false);
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [perfil, setPerfil] = useState(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [telefono, setTelefono] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [personalidad, setPersonalidad] = useState("");
  const [idiomas, setIdiomas] = useState([]);
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [fotoPerfil, setFotoPerfil] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [services, setServices] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [addingService, setAddingService] = useState(false);
  const [newVertical, setNewVertical] = useState("alojamiento");
  const [newServiceDetails, setNewServiceDetails] = useState(emptyServiceDetails());
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [referencias, setReferencias] = useState([]);
  const [refNombre, setRefNombre] = useState("");
  const [refEmail, setRefEmail] = useState("");
  const [refRelacion, setRefRelacion] = useState(RELACION_OPTIONS[0]);
  const [refSending, setRefSending] = useState(false);
  const [refMessage, setRefMessage] = useState("");
  const [refError, setRefError] = useState("");
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [providerDocuments, setProviderDocuments] = useState([]);
  const [documentosReminderVertical, setDocumentosReminderVertical] = useState(null);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      setUserEmail(user.email || "");

      const { data: perfilData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileError) {
        setErrorMessage(profileError.message);
        setLoading(false);
        return;
      }

      if (perfilData) {
        setNombre(perfilData.nombre || "");
        setApellido(perfilData.apellido || "");
        setCiudad(perfilData.ciudad || "");
        setTelefono(perfilData.telefono || "");
        const desc = perfilData.descripcion || "";
        const personalidadMatch = desc.match(/Personalidad:\s*(.+?)(?:\n\n|$)/s);
        const motivacionParts = desc.split(/\n\nPersonalidad:/);
        setDescripcion(motivacionParts[0] || desc);
        setPersonalidad(personalidadMatch?.[1]?.trim() || "");
        setIdiomas(Array.isArray(perfilData.idiomas) ? perfilData.idiomas : []);
        setAnosExperiencia(
          perfilData.anos_experiencia != null
            ? String(perfilData.anos_experiencia)
            : "",
        );
        setPerfil(perfilData);
        setFotoPerfil(perfilData.foto_perfil || perfilData.avatar_url || null);
        setFotoPreview(perfilData.foto_perfil || perfilData.avatar_url || null);
      }

      const { data: serviceRows, error: servicesError } = await supabase
        .from("services")
        .select("*")
        .eq("proveedor_id", user.id)
        .order("created_at", { ascending: true });

      if (servicesError) {
        setErrorMessage(servicesError.message);
      } else {
        setServices((serviceRows ?? []).map(mapServiceFromDb));
      }

      if (perfilData?.role === "proveedor") {
        const refsRes = await fetch("/api/referencias/mis");
        const refsData = await refsRes.json().catch(() => ({}));
        if (refsRes.ok) {
          setReferencias(refsData.referencias ?? []);
        }

        try {
          const docs = await loadProviderDocuments(user.id);
          setProviderDocuments(docs);
        } catch (docsErr) {
          console.error("[editar-perfil] Error cargando documentos:", docsErr);
        }
      }

      setLoading(false);
    }

    load();
  }, [router]);

  useEffect(() => {
    if (loading) return;
    setActiveTab(resolveTabFromParam(tabParam, services));
  }, [loading, services, tabParam]);

  useEffect(() => {
    if (loading || !tabParam) return;

    const resolved = resolveTabFromParam(tabParam, services);
    const href = buildEditarPerfilTabHref(resolved);
    const current =
      tabParam === "perfil"
        ? "/editar-perfil"
        : `/editar-perfil?tab=${encodeURIComponent(tabParam)}`;

    if (tabParam === "servicios" || href !== current) {
      router.replace(href, { scroll: false });
    }
  }, [loading, services, tabParam, router]);

  function handleTabChange(tabId) {
    if (tabId !== "documentos") {
      setDocumentosReminderVertical(null);
    }
    setActiveTab(tabId);
    router.replace(buildEditarPerfilTabHref(tabId), { scroll: false });
  }

  function markDirty() {
    setDirty(true);
  }

  function updateServiceDetails(serviceId, details) {
    markDirty();
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, details } : s)),
    );
  }

  const verticalsActivos = [...new Set(services.map((s) => s.vertical))];
  const documentContext = useMemo(
    () => ({
      profile: perfil
        ? {
            doc_dni_url: perfil.doc_dni_url,
            doc_antecedentes_url: perfil.doc_antecedentes_url,
            doc_antecedentes_sexuales_url: perfil.doc_antecedentes_sexuales_url,
          }
        : {},
      providerDocuments,
      services: services.map((s) => ({
        vertical: s.vertical,
        nru: s.details?.nru,
        details: s.details,
      })),
    }),
    [perfil, providerDocuments, services],
  );

  const documentosMissingForReminder = useMemo(() => {
    if (!documentosReminderVertical) return [];
    return getMissingPublishDocumentsForVertical(
      documentosReminderVertical,
      documentContext,
      perfil,
    );
  }, [documentosReminderVertical, documentContext, perfil]);

  useEffect(() => {
    if (
      documentosReminderVertical &&
      documentosMissingForReminder.length === 0
    ) {
      setDocumentosReminderVertical(null);
    }
  }, [documentosReminderVertical, documentosMissingForReminder.length]);

  const puedePublicarServicios = proveedorPuedePublicar(perfil);

  function toggleServiceDisponible(serviceId) {
    const target = services.find((s) => s.id === serviceId);
    if (!target) return;

    if (!target.disponible) {
      const bloqueo = getActivacionBloqueoMensaje(perfil, target, documentContext);
      if (bloqueo) {
        setErrorMessage(bloqueo);
        return;
      }
    }

    setErrorMessage("");
    markDirty();
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, disponible: !s.disponible } : s,
      ),
    );
  }

  function toggleIdioma(lang) {
    markDirty();
    setIdiomas((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  const esClienteSinServicios = perfil?.role === "cliente" && services.length === 0;
  const tieneServicios = services.length > 0;
  const tabs = [
    { id: "perfil", label: "Perfil personal" },
    ...(tieneServicios
      ? [
          ...verticalsActivos.includes("alojamiento")
            ? [{ id: "alojamiento", label: "🏠 Alojamiento" }]
            : [],
          ...verticalsActivos.includes("ninos")
            ? [{ id: "ninos", label: "🧒 Niñera" }]
            : [],
          ...verticalsActivos.includes("mascotas")
            ? [{ id: "mascotas", label: "🐾 Mascotas" }]
            : [],
          { id: "documentos", label: "Documentos" },
        ]
      : []),
    { id: "cuenta", label: "Cuenta" },
  ];

  function getServiceByVertical(vertical) {
    return services.find((s) => s.vertical === vertical);
  }

  function handleProfilePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    markDirty();
    setProfilePhotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  function openDocumentUpload(docId) {
    setActiveDocumentId(docId);
    documentInputRef.current?.click();
  }

  async function handleDocumentFile(e) {
    const file = e.target.files?.[0];
    if (!file || !activeDocumentId || !userId) return;
    e.target.value = "";
    setUploadingDoc(activeDocumentId);
    setErrorMessage("");
    try {
      const result = await persistProviderDocument(userId, activeDocumentId, file);
      if (result.storage === "profile" && result.profileField) {
        setPerfil((prev) => ({
          ...prev,
          [result.profileField]: result.url,
        }));
      } else if (result.storage === "tabla") {
        setProviderDocuments((prev) => {
          const next = prev.filter((r) => r.tipo !== result.tipo);
          return [
            ...next,
            {
              proveedor_id: userId,
              tipo: result.tipo,
              url: result.url,
              vertical: result.row?.vertical ?? null,
              id: result.row?.id,
            },
          ];
        });
      }
      setSuccessMessage("Documento subido correctamente ✓");
    } catch (err) {
      setErrorMessage(err.message || "Error al subir el documento.");
    } finally {
      setUploadingDoc(null);
      setActiveDocumentId(null);
    }
  }

  async function handleSolicitarReferencia(e) {
    e.preventDefault();
    if (!userId || !refNombre.trim() || !refEmail.trim()) {
      setRefError("Completa el nombre y el email del referente.");
      return;
    }

    setRefSending(true);
    setRefError("");
    setRefMessage("");

    const res = await fetch("/api/referencias/solicitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre_referente: refNombre.trim(),
        email_referente: refEmail.trim(),
        relacion: refRelacion,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.ok) {
      setRefSending(false);
      setRefError(data.error || "No se pudo enviar la solicitud.");
      return;
    }

    const refsRes = await fetch("/api/referencias/mis");
    const refsPayload = await refsRes.json().catch(() => ({}));
    if (refsRes.ok) {
      setReferencias(refsPayload.referencias ?? []);
    }
    setRefNombre("");
    setRefEmail("");
    setRefRelacion(RELACION_OPTIONS[0]);
    setRefSending(false);
    setRefMessage("Solicitud enviada. El referente recibirá un email para completar el aval.");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!userId) return;

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let fotoUrl = fotoPerfil;
      if (profilePhotoFile) {
        fotoUrl = await uploadProfilePhoto(userId, profilePhotoFile);
      }

      const descripcionParts = [descripcion.trim()];
      if (personalidad.trim()) {
        descripcionParts.push(`Personalidad: ${personalidad.trim()}`);
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        ciudad: ciudad.trim(),
        telefono: telefono.trim() || null,
        descripcion: descripcionParts.join("\n\n"),
        location_zone: ciudad.trim(),
        foto_perfil: fotoUrl,
        idiomas,
        anos_experiencia: anosExperiencia ? Number(anosExperiencia) : null,
      });

      if (profileError) throw profileError;

      for (const service of services) {
        const locationFields = await getServiceLocationFields(
          service.details,
          service.vertical,
        );
        const payload = {
          ...buildServicePayload(
            service.details,
            service.vertical,
            ciudad,
            userId,
            resolveDisponibleForSave(service, perfil, documentContext),
          ),
          ...locationFields,
        };

        if (service.isNew) {
          const { error } = await supabase.from("services").insert(payload);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("services")
            .update(payload)
            .eq("id", service.id);
          if (error) throw error;
        }
      }

      let servicesAfterSave = services.map((s) => ({
        ...s,
        disponible: resolveDisponibleForSave(s, perfil, documentContext),
      }));

      if (addingService && newServiceDetails.titulo.trim()) {
        const nuevoServicio = {
          vertical: newVertical,
          details: newServiceDetails,
        };
        const nuevoContext = {
          ...documentContext,
          services: [
            ...documentContext.services,
            {
              vertical: newVertical,
              nru: newServiceDetails.nru,
              details: newServiceDetails,
            },
          ],
        };
        const locationFields = await getServiceLocationFields(
          newServiceDetails,
          newVertical,
        );
        const payload = {
          ...buildServicePayload(
            newServiceDetails,
            newVertical,
            ciudad,
            userId,
            puedeActivarServicio(nuevoServicio, perfil, nuevoContext),
          ),
          ...locationFields,
        };
        const { data, error } = await supabase
          .from("services")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        servicesAfterSave = [...servicesAfterSave, mapServiceFromDb(data)];
        setAddingService(false);
        setNewServiceDetails(emptyServiceDetails());
      }

      setServices(servicesAfterSave);

      const savedFromVertical = SERVICE_VERTICAL_TABS.includes(activeTab)
        ? activeTab
        : null;

      setFotoPerfil(fotoUrl);
      setProfilePhotoFile(null);
      if (nuevaPassword.trim().length >= 6) {
        const { error: pwError } = await supabase.auth.updateUser({
          password: nuevaPassword,
        });
        if (pwError) throw pwError;
        setNuevaPassword("");
      }

      setEditingId(null);
      setDirty(false);

      if (savedFromVertical) {
        const postSaveContext = {
          ...documentContext,
          services: servicesAfterSave.map((s) => ({
            vertical: s.vertical,
            nru: s.details?.nru,
            details: s.details,
          })),
        };
        const missingPublishDocs = getMissingPublishDocumentsForVertical(
          savedFromVertical,
          postSaveContext,
          perfil,
        );

        if (missingPublishDocs.length > 0) {
          setDocumentosReminderVertical(savedFromVertical);
          setActiveTab("documentos");
          router.replace(buildEditarPerfilTabHref("documentos"), { scroll: false });
          setSuccessMessage(
            buildPublishReminderMessage(savedFromVertical, missingPublishDocs),
          );
          return;
        }
      }

      setSuccessMessage("Cambios guardados correctamente ✓");
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar los cambios.");
    } finally {
      setSubmitting(false);
    }
  }

  const handleEliminarCuenta = async () => {
    const confirmacion = confirm(
      "¿Estás segura de que quieres eliminar tu cuenta? Esta acción es irreversible y se eliminarán todos tus datos, reservas y mensajes.",
    );

    if (!confirmacion) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();

      if (data.success) {
        await supabase.auth.signOut();
        router.push("/");
      } else {
        alert("Error al eliminar la cuenta: " + (data.error || "Inténtalo de nuevo"));
      }
    } catch {
      alert("Error al eliminar la cuenta");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <main className="px-6 py-16 text-center text-sm text-[#666]">Cargando perfil…</main>
      </div>
    );
  }

  const initials = [nombre?.[0], apellido?.[0]].filter(Boolean).join("").toUpperCase() || "?";
  const fotoFecha = perfil?.updated_at
    ? new Date(perfil.updated_at).toLocaleDateString("es-ES")
    : "—";

  function renderTabContent() {
    if (activeTab === "perfil") {
      if (esClienteSinServicios) {
        return (
          <div>
            <Card title="Sobre ti">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.nombre}</label>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => {
                      markDirty();
                      setNombre(e.target.value);
                    }}
                    className={inputClass}
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.apellidos}</label>
                  <input
                    type="text"
                    value={apellido}
                    onChange={(e) => {
                      markDirty();
                      setApellido(e.target.value);
                    }}
                    className={inputClass}
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.ciudad}</label>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => {
                    markDirty();
                    setCiudad(e.target.value);
                  }}
                  className={inputClass}
                  style={{ borderColor: BRAND.border }}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Teléfono móvil</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => {
                    markDirty();
                    setTelefono(e.target.value);
                  }}
                  placeholder="+34 600 000 000"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e8e4de",
                    fontSize: 13,
                  }}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-[#444]">
                  Cuéntanos un poco sobre ti
                </label>
                <textarea
                  rows={4}
                  value={descripcion}
                  onChange={(e) => {
                    markDirty();
                    setDescripcion(e.target.value);
                  }}
                  placeholder="Familia con dos hijos, viajamos a menudo..."
                  className={`${inputClass} resize-y`}
                  style={{ borderColor: BRAND.border }}
                />
              </div>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.idiomas}</label>
                <div className="flex flex-wrap gap-2">
                  {IDIOMAS_DEFAULT.map((lang) => (
                    <TagPill
                      key={lang}
                      label={lang}
                      selected={idiomas.includes(lang)}
                      onClick={() => toggleIdioma(lang)}
                    />
                  ))}
                </div>
              </div>
            </Card>

            <Card title="¿Quieres ofrecer servicios también?">
              <p className="text-sm leading-relaxed text-[#666]">
                Conviértete en proveedor y empieza a ganar dinero ofreciendo alojamiento, cuidado de
                niños o mascotas.
              </p>
              <Link
                href="/ser-proveedor"
                className="mt-4 inline-block text-sm font-semibold no-underline"
                style={{ color: PRIMARY }}
              >
                Hazte proveedor →
              </Link>
            </Card>
          </div>
        );
      }

      return (
        <div>
          <Card title="Foto de perfil">
            <input ref={profilePhotoRef} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleProfilePhotoChange} />
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fotoPreview} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: PRIMARY }}>
                  {initials}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-[#1a1a1a]">{[nombre, apellido].filter(Boolean).join(" ") || "Tu nombre"}</p>
                <p className="text-xs text-[#888]">Subida: {fotoFecha}</p>
                <button type="button" onClick={() => profilePhotoRef.current?.click()} className="mt-2 text-xs font-semibold" style={{ color: PRIMARY }}>
                  {PROFILE_LABELS.cambiarFoto}
                </button>
              </div>
            </div>
          </Card>

          <Card title="Información personal">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.nombre}</label>
                <input type="text" required value={nombre} onChange={(e) => { markDirty(); setNombre(e.target.value); }} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.apellidos}</label>
                <input type="text" required value={apellido} onChange={(e) => { markDirty(); setApellido(e.target.value); }} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.ciudad}</label>
                <input type="text" required value={ciudad} onChange={(e) => { markDirty(); setCiudad(e.target.value); }} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Teléfono móvil</label>
                <input
                  type="tel"
                  value={telefono}
                  onChange={(e) => {
                    markDirty();
                    setTelefono(e.target.value);
                  }}
                  placeholder="+34 600 000 000"
                  style={{
                    width: "100%",
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #e8e4de",
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.anosExperiencia}</label>
                <input type="number" min="0" value={anosExperiencia} onChange={(e) => { markDirty(); setAnosExperiencia(e.target.value); }} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.bio}</label>
              <textarea rows={4} value={descripcion} onChange={(e) => { markDirty(); setDescripcion(e.target.value); }} className={`${inputClass} resize-y`} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.personalidadEdit}</label>
              <textarea rows={3} value={personalidad} onChange={(e) => { markDirty(); setPersonalidad(e.target.value); }} className={`${inputClass} resize-y`} style={{ borderColor: BRAND.border }} />
            </div>
          </Card>

          <Card title={PROFILE_LABELS.idiomas}>
            <div className="flex flex-wrap gap-2">
              {IDIOMAS_DEFAULT.map((lang) => (
                <TagPill key={lang} label={lang} selected={idiomas.includes(lang)} onClick={() => toggleIdioma(lang)} />
              ))}
            </div>
          </Card>

          <Card title="Mis servicios">
            {perfil?.role === "proveedor" && !puedePublicarServicios && (
              <div
                className="mb-4 rounded-lg border px-3 py-2.5 text-xs leading-relaxed"
                style={{
                  borderColor: "#c47d1a",
                  backgroundColor: "#fdf4e7",
                  color: "#5c4a32",
                }}
              >
                {perfil?.verificado !== true ? (
                  REVISION_PENDIENTE_MSG
                ) : (
                  <>
                    {COBROS_REQUERIDOS_MSG}{" "}
                    <Link
                      href="/dashboard?tab=proveedor"
                      className="font-semibold underline"
                      style={{ color: PRIMARY }}
                    >
                      Ir a configurar cobros
                    </Link>
                  </>
                )}
              </div>
            )}
            <ul className="flex flex-col gap-3">
              {services.map((service) => {
                const v = VERTICALS.find((x) => x.id === service.vertical);
                const isEditing = editingId === service.id;
                return (
                  <li key={service.id} className="rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: v?.color || PRIMARY }} />
                        <div>
                          <p className="text-sm font-semibold text-[#1a1a1a]">{service.details.titulo || "Sin título"}</p>
                          <p className="text-xs text-[#888]">{v?.label} · {service.details.precio ? `${service.details.precio}€` : "—"}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={getProviderAnuncioHref(service, perfil, documentContext)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:bg-[#f7f5f2]"
                          style={{ borderColor: BRAND.border, color: PRIMARY }}
                        >
                          Vista previa
                        </a>
                        <button type="button" onClick={() => setEditingId(isEditing ? null : service.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: BRAND.border, color: PRIMARY }}>
                          {isEditing ? "Cerrar" : "Editar"}
                        </button>
                      </div>
                    </div>
                    <ServiceDisponibleRow
                      service={service}
                      perfil={perfil}
                      documentContext={documentContext}
                      onToggle={toggleServiceDisponible}
                    />
                    {isEditing && (
                      <ServiceEditForm vertical={service.vertical} details={service.details} userId={userId} onChange={(details) => updateServiceDetails(service.id, details)} />
                    )}
                  </li>
                );
              })}
            </ul>
            {addingService ? (
              <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
                <p className="text-sm font-semibold">Nuevo servicio</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {VERTICALS.map((v) => (
                    <button key={v.id} type="button" onClick={() => { markDirty(); setNewVertical(v.id); setNewServiceDetails(emptyServiceDetails()); }} className="rounded-full border px-4 py-2 text-sm font-medium" style={{ borderColor: newVertical === v.id ? PRIMARY : BRAND.border, backgroundColor: newVertical === v.id ? "#e8f0fb" : "#fff", color: newVertical === v.id ? PRIMARY : "#444" }}>
                      {v.label}
                    </button>
                  ))}
                </div>
                <ServiceEditForm vertical={newVertical} details={newServiceDetails} userId={userId} onChange={(d) => { markDirty(); setNewServiceDetails(d); }} />
                <button type="button" onClick={() => { setAddingService(false); setNewServiceDetails(emptyServiceDetails()); }} className="mt-4 text-sm text-[#666]">Cancelar</button>
              </div>
            ) : (
              <button type="button" onClick={() => { markDirty(); setAddingService(true); }} className="mt-4 text-sm font-semibold" style={{ color: PRIMARY }}>+ Añadir nuevo servicio</button>
            )}
          </Card>

          {perfil?.role === "proveedor" && (
            <Card title="Referencias externas">
              {referencias.length > 0 && (
                <ul className="mb-4 flex flex-col gap-2">
                  {referencias.map((ref) =>
                    ref.estado === "completada" ? (
                      <li key={ref.id} className="rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: BRAND.border }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[#1a1a1a]">{ref.nombre_referente}</p>
                            <div className="mt-1.5 flex flex-col gap-1 text-xs text-[#666]">
                              {ref.recomendaria != null && (
                                <span className={ref.recomendaria ? "font-medium text-[#0e7a5c]" : "text-[#888]"}>
                                  {ref.recomendaria ? "Recomienda" : "No recomienda"}
                                </span>
                              )}
                              {ref.conoce_desde && (
                                <span>Se conocen: {ref.conoce_desde}</span>
                              )}
                              {ref.comentario && (
                                <p className="mt-0.5 italic leading-relaxed">{ref.comentario}</p>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-xs text-[#888]">{ref.estado}</span>
                        </div>
                      </li>
                    ) : (
                      <li key={ref.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm" style={{ borderColor: BRAND.border }}>
                        <span>{ref.nombre_referente}</span>
                        <span className="text-xs text-[#888]">{ref.estado}</span>
                      </li>
                    ),
                  )}
                </ul>
              )}
              <div>
                {refError && <p className="mb-2 text-xs text-red-600">{refError}</p>}
                {refMessage && <p className="mb-2 text-xs text-green-700">{refMessage}</p>}
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="text" placeholder="Nombre referente" value={refNombre} onChange={(e) => setRefNombre(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
                  <input type="email" placeholder="Email referente" value={refEmail} onChange={(e) => setRefEmail(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
                </div>
                <select value={refRelacion} onChange={(e) => setRefRelacion(e.target.value)} className={`${inputClass} mt-3`} style={{ borderColor: BRAND.border }}>
                  {RELACION_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <button type="button" onClick={handleSolicitarReferencia} disabled={refSending} className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: PRIMARY }}>
                  {refSending ? "Enviando…" : "Solicitar referencia"}
                </button>
              </div>
            </Card>
          )}
        </div>
      );
    }

    if (["alojamiento", "ninos", "mascotas"].includes(activeTab)) {
      const service = getServiceByVertical(activeTab);
      const v = VERTICALS.find((x) => x.id === activeTab);
      if (!service) {
        return <p className="text-sm text-[#666]">No tienes un servicio de {v?.label}.</p>;
      }
      return (
        <>
          <Card
            headerRight={
              <ServiceDisponibleRow
                compact
                service={service}
                perfil={perfil}
                documentContext={documentContext}
                onToggle={toggleServiceDisponible}
              />
            }
          >
            <ServiceEditForm
              vertical={service.vertical}
              details={service.details}
              userId={userId}
              onChange={(details) => updateServiceDetails(service.id, details)}
            />
          </Card>
          {(service.vertical === "alojamiento" ||
            service.vertical === "mascotas") && (
            <Card title="Precios por fecha">
              <CalendarioTarifas
                serviceId={service.id}
                precioBase={Number(service.details?.precio) || 0}
                unidad={service.vertical === "alojamiento" ? "noche" : "día"}
              />
            </Card>
          )}
        </>
      );
    }

    if (activeTab === "documentos") {
      const highlightDocIds = documentosMissingForReminder.map((def) => def.id);

      return (
        <Card title={DOCUMENT_LABELS.title}>
          <DocumentsPublishReminder
            vertical={documentosReminderVertical}
            missingDocs={documentosMissingForReminder}
          />
          <ProviderDocumentsSection
            verticales={verticalsActivos}
            context={documentContext}
            uploadingDocId={uploadingDoc}
            onUpload={openDocumentUpload}
            showHeader={false}
            highlightDocIds={highlightDocIds}
          />
        </Card>
      );
    }

    if (activeTab === "cuenta") {
      return (
        <div>
          <Card title="Cuenta">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">Email</label>
            <input type="email" readOnly value={userEmail} className={inputClass} style={{ borderColor: BRAND.border, backgroundColor: "#f7f5f2" }} />
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Nueva contraseña</label>
              <input type="password" value={nuevaPassword} onChange={(e) => { markDirty(); setNuevaPassword(e.target.value); }} placeholder="Mínimo 6 caracteres" className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
          </Card>
          <Card title="Zona de peligro">
            <button
              type="button"
              onClick={handleEliminarCuenta}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              Eliminar mi cuenta
            </button>
          </Card>
        </div>
      );
    }

    return null;
  }

  return (
    <div className="min-h-screen font-sans pb-24" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
      <div className="sticky top-0 z-50 border-b bg-white" style={{ borderColor: BRAND.border }}>
        <div className="flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="no-underline" style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}>
              Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
            </Link>
            <Link href="/dashboard" className="text-sm no-underline" style={{ color: "#666" }}>← Dashboard</Link>
          </div>
          <button type="submit" form="editar-perfil-form" disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: PRIMARY }}>
            {submitting ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
        <div className="flex gap-0 overflow-x-auto border-t px-4" style={{ borderColor: BRAND.border }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className="shrink-0 px-4 py-3 text-xs font-semibold whitespace-nowrap"
              style={{
                borderBottom: activeTab === tab.id ? `2px solid ${PRIMARY}` : "2px solid transparent",
                color: activeTab === tab.id ? PRIMARY : "#888",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {successMessage && (
        <div className="mx-6 mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{successMessage}</div>
      )}
      {errorMessage && (
        <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
      )}

      <form id="editar-perfil-form" onSubmit={handleSubmit}>
        <input
          ref={documentInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleDocumentFile}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]" style={{ padding: "20px 24px" }}>
          <div>{renderTabContent()}</div>
          <PreviewPanel fotoPreview={fotoPreview} nombre={nombre} apellido={apellido} ciudad={ciudad} services={services} />
        </div>
      </form>

      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t bg-white px-6 py-3 shadow-lg" style={{ borderColor: BRAND.border }}>
          <span className="text-sm text-[#888]">Cambios sin guardar</span>
          <button type="submit" form="editar-perfil-form" disabled={submitting} className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: PRIMARY }}>
            {submitting ? "Guardando…" : "Guardar cambios →"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function EditarPerfilPage() {
  return (
    <Suspense fallback={<EditarPerfilPageFallback />}>
      <EditarPerfilContent />
    </Suspense>
  );
}
