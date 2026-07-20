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
import { hasDniUploaded, DNI_SUBIR_RUTA } from "@/app/lib/dni";
import {
  emailContactoForStorage,
  EMAIL_CONTACTO_INVALID_MSG,
  hasTelefono,
  PROVIDER_CONTACT_BANNER_MSG,
  resolveEmailContactoDraft,
  TELEFONO_BANNER_CLIENT_MSG,
  TELEFONO_INVALID_MSG,
  telefonoForStorage,
} from "@/app/lib/profile-telefono";
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
} from "@/app/lib/capacidad";
import { parseHuespedesPrecioFromDb, validateHuespedesPrecio } from "@/app/lib/huespedes-precio";
import HuespedesPrecioFields from "@/app/components/provider/HuespedesPrecioFields";
import ModalidadCobroFields from "@/app/components/provider/ModalidadCobroFields";
import {
  emptyModalidadesCobroForm,
  seedModalidadesCobroFromLegacy,
  validateModalidadCobro,
} from "@/app/lib/modalidad-cobro";
import {
  loadModalidadesForServices,
  saveServiceModalidades,
} from "@/app/lib/modalidad-cobro-persist";
import {
  normalizeDescuentosDuracion,
  serializeDescuentosDuracionForDb,
} from "@/app/lib/descuentosDuracion";
import { RELACION_OPTIONS } from "@/app/lib/referencias";
import { buildEditarPerfilTabHref } from "@/app/lib/editar-perfil-routes";
import {
  TIPO_ALOJAMIENTO_EDIT_OPTIONS,
  getModalidadServicioFormCopy,
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
  applyContactToDetails,
  loadServiceContactsByIds,
  syncServiceContact,
} from "@/app/lib/service-contact";
import {
  formatMissingPublishDocumentLabels,
  getMissingPublishDocumentsForVertical,
} from "@/app/lib/provider-documents";
import ServicePhotoUploadField from "@/app/components/provider/ServicePhotoUploadField";
import { getServiceDescription } from "@/app/lib/service-card-display";
import { parseFotosFromDb, parseFotosFromDbStrict, normalizeFotosArray } from "@/app/lib/service-photos";
import { supabase } from "@/app/lib/supabase";

import {
  loadProviderDocuments,
  persistProviderDocument,
  uploadProfilePhoto,
} from "@/app/lib/provider-uploads";
import {
  COBROS_REQUERIDOS_MSG,
  getActivacionBloqueoMensaje,
  getProviderAnuncioHref,
  puedeActivarServicio,
  proveedorPuedePublicar,
  providerMissingContactBanner,
  resolveDisponibleForSave,
  REVISION_PENDIENTE_MSG,
  servicioRevisionAprobada,
} from "@/app/lib/provider-publicacion";
import {
  buildServicesSaveFeedback,
  getServiceAvailabilityDisplay,
  resolveRevisionEstadoOnSave,
} from "@/app/lib/service-revision";
import { REVISION_EN_REVISION } from "@/app/lib/onboarding-persist";

/** Params antiguos de pestañas por vertical → redirigen a ?tab=servicios */
const LEGACY_VERTICAL_TAB_PARAMS = ["alojamiento", "ninos", "mascotas"];

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

function resolveTabFromParam(tabParam, services) {
  const tieneServicios = services.length > 0;

  if (!tabParam) return "perfil";

  // Lista completa por id (todas las verticales). Entrada principal desde dashboard/navbar.
  if (tabParam === "servicios") return "servicios";

  if (tabParam === "perfil") return "perfil";
  if (tabParam === "cuenta") return "cuenta";
  if (tabParam === "documentos") {
    return tieneServicios ? "documentos" : "perfil";
  }
  // Legacy: pestañas por vertical → lista
  if (LEGACY_VERTICAL_TAB_PARAMS.includes(tabParam)) {
    return "servicios";
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
    modalidades_cobro: emptyModalidadesCobroForm(),
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
    fotos: [],
    foto_url: "",
    capacidad: { ...DEFAULT_CAPACIDAD_ALOJAMIENTO },
    capacidad_maxima: "",
    huespedes_incluidos: "2",
    precio_huesped_extra: "",
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
  merged.capacidad_maxima = merged.capacidad_maxima ?? "";
  merged.huespedes_incluidos = merged.huespedes_incluidos ?? "";
  merged.precio_huesped_extra = merged.precio_huesped_extra ?? "";
  merged.fotos = parseFotosFromDb({ fotos: merged.fotos, foto_url: merged.foto_url });
  merged.foto_url = merged.fotos[0] || merged.foto_url || "";

  if (vertical === "alojamiento") {
    merged.normas = parseNormasFromDb({ normas: rawDetails?.normas ?? merged.normas });
    Object.assign(merged, parseCheckTimesFromDb(rawDetails || {}));
  } else if (vertical === "ninos" || vertical === "mascotas") {
    merged.anos_experiencia = parseAnosExperienciaFromDb(rawDetails || {});
    if (!merged.modalidades_cobro) {
      merged.modalidades_cobro = seedModalidadesCobroFromLegacy(vertical, merged);
    }
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
    fotos: parseFotosFromDb(row),
    foto_url: parseFotosFromDb(row)[0] || "",
    capacidad: parseCapacidadFromDb(row),
    ...parseHuespedesPrecioFromDb(row),
    modalidades_cobro: seedModalidadesCobroFromLegacy(row.vertical, row),
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

function ServiceAvailabilityHeader({
  service,
  onToggle,
  toggling = false,
  showMeta = false,
  metaLabel = "",
  actions = null,
}) {
  const status = getServiceAvailabilityDisplay(
    service.revision_estado,
    service.disponible,
  );
  const canToggle = servicioRevisionAprobada(service.revision_estado);
  const activo = service.disponible === true;
  const titulo = service.details?.titulo?.trim() || "Sin título";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#1a1a1a]">
              {titulo}
            </p>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              style={{
                backgroundColor: `${status.color}18`,
                color: status.color,
              }}
            >
              {status.label}
            </span>
          </div>
          {showMeta && metaLabel ? (
            <p className="mt-0.5 text-xs text-[#888]">{metaLabel}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {canToggle ? (
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label={activo ? "Pausar servicio" : "Activar servicio"}
            disabled={toggling || service.isNew}
            onClick={() => onToggle(service.id)}
            className="relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: activo ? SERVICE_ACTIVE_GREEN : "#d1d5db",
            }}
            title={activo ? "Pausar (ocultar de búsqueda)" : "Activar (mostrar en búsqueda)"}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
              style={{
                left: activo ? "calc(100% - 1.625rem)" : "0.125rem",
              }}
            />
          </button>
        ) : null}
      </div>
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

function ServiceEditForm({ vertical, details: rawDetails, onChange, userId, serviceId, onUploadError }) {
  const details = useMemo(
    () => mergeServiceDetails(rawDetails, vertical),
    [rawDetails, vertical],
  );

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  const capacidad = details.capacidad ?? { ...DEFAULT_CAPACIDAD_ALOJAMIENTO };
  const updCap = (key, val) => {
    const nextCap = { ...capacidad, [key]: val };
    const next = { ...details, capacidad: nextCap };
    if (key === "personas") {
      next.capacidad_maxima = val != null && val !== "" ? String(val) : "";
    }
    onChange(next);
  };

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
      <ServicePhotoUploadField
        vertical={vertical}
        userId={userId}
        serviceId={serviceId}
        details={details}
        onChange={onChange}
        onUploadError={onUploadError}
        label={serviceFotosLabel(vertical, "edit")}
        multiple
      />
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
      {vertical === "alojamiento" && (
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
      )}
      {(vertical === "ninos" || vertical === "mascotas") && (
        <div className="sm:col-span-2">
          <ModalidadCobroFields
            vertical={vertical}
            details={details}
            onChange={onChange}
            accentColor={vertical === "ninos" ? GREEN : ORANGE}
          />
        </div>
      )}
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

      <div className="sm:col-span-2">
        <p className="mb-1 text-sm font-semibold text-[#1a1a1a]">
          {vertical === "ninos"
            ? "Calendario: disponibilidad"
            : "Calendario: precios y disponibilidad"}
        </p>
        <p className="mb-3 text-xs text-[#666]">
          {vertical === "ninos"
            ? "Bloquea los días en los que no puedes cuidar."
            : "Define precios especiales por fecha y bloquea días no disponibles."}
        </p>
        <CalendarioTarifas
          serviceId={serviceId}
          precioBase={Number(details.precio) || 0}
          unidad={
            vertical === "alojamiento"
              ? "noche"
              : vertical === "mascotas"
                ? "día"
                : "hora"
          }
          soloBloqueo={vertical === "ninos"}
        />
      </div>

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
          {(() => {
            const modalidadCopy = getModalidadServicioFormCopy(vertical);
            return (
              <>
                <p className="mb-1 text-xs font-medium text-[#444]">
                  {modalidadCopy.title}
                </p>
                <p className="mb-2 text-[11px] leading-relaxed text-[#666]">
                  {modalidadCopy.help}
                </p>
                <div className="flex flex-col gap-2">
                  {modalidadCopy.options.map((option) => {
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
              </>
            );
          })()}
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
          <div className="sm:col-span-2">
            <HuespedesPrecioFields
              vertical="alojamiento"
              details={details}
              onChange={onChange}
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
        </>
      )}
      {vertical === "ninos" && (
        <>
          <div className="sm:col-span-2">
            <HuespedesPrecioFields
              vertical="ninos"
              details={details}
              onChange={onChange}
              hideExtra
            />
          </div>
          <NinosServiceFields
            className="sm:col-span-2"
            details={details}
            onChange={onChange}
            accentColor={GREEN}
            showAnosExperiencia={false}
          />
        </>
      )}
      {vertical === "mascotas" && (
        <>
          <div className="sm:col-span-2">
            <HuespedesPrecioFields
              vertical="mascotas"
              details={details}
              onChange={onChange}
              hideExtra
            />
          </div>
          <MascotasServiceFields
            className="sm:col-span-2"
            details={details}
            onChange={onChange}
            accentColor={ORANGE}
            showAnosExperiencia={false}
          />
        </>
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
  const serviceIdParam = searchParams.get("serviceId");
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
  const [emailContacto, setEmailContacto] = useState("");
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
  const [togglingDisponibleId, setTogglingDisponibleId] = useState(null);
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
        setEmailContacto(
          resolveEmailContactoDraft(perfilData, user.email),
        );
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
        const rows = serviceRows ?? [];
        const contactById = await loadServiceContactsByIds(rows.map((r) => r.id));
        const modalidadesById = await loadModalidadesForServices(rows);
        setServices(
          rows.map((row) => {
            const contact = contactById.get(row.id) ?? null;
            const resolved = applyContactToDetails({}, contact);
            const rowWithContact = {
              ...row,
              direccion_exacta: resolved.direccion_exacta,
              telefono_contacto: resolved.telefono_contacto,
              location_lat: resolved.location_lat,
              location_lng: resolved.location_lng,
            };
            const mapped = mapServiceFromDb(rowWithContact);
            const cobro = modalidadesById.get(row.id);
            if (cobro) {
              mapped.details = { ...mapped.details, ...cobro };
            }
            return mapped;
          }),
        );
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
    const keepServiceId =
      resolved === "servicios" && serviceIdParam ? serviceIdParam : null;
    const href = buildEditarPerfilTabHref(resolved, {
      serviceId: keepServiceId,
    });

    const currentParams = new URLSearchParams();
    if (tabParam && tabParam !== "perfil") {
      currentParams.set("tab", tabParam);
    }
    if (serviceIdParam) {
      currentParams.set("serviceId", serviceIdParam);
    }
    const current = currentParams.toString()
      ? `/editar-perfil?${currentParams.toString()}`
      : "/editar-perfil";

    // Canonicaliza legacy ?tab=alojamiento|ninos|mascotas → ?tab=servicios
    if (href !== current) {
      router.replace(href, { scroll: false });
    }
  }, [loading, services, tabParam, serviceIdParam, router]);

  // Deep-link: ?tab=servicios&serviceId=<uuid> abre ese servicio en edición
  useEffect(() => {
    if (loading) return;
    if (resolveTabFromParam(tabParam, services) !== "servicios") return;
    if (!serviceIdParam) return;
    if (!services.some((s) => s.id === serviceIdParam)) return;
    setEditingId(serviceIdParam);
    setAddingService(false);
  }, [loading, services, tabParam, serviceIdParam]);

  function handleTabChange(tabId) {
    if (tabId !== "documentos") {
      setDocumentosReminderVertical(null);
    }
    setActiveTab(tabId);
    setEditingId(null);
    setAddingService(false);
    router.replace(buildEditarPerfilTabHref(tabId), { scroll: false });
  }

  function openServiceEditor(serviceId) {
    setAddingService(false);
    setEditingId(serviceId);
    router.replace(
      buildEditarPerfilTabHref("servicios", { serviceId }),
      { scroll: false },
    );
  }

  function closeServiceEditor() {
    setEditingId(null);
    router.replace(buildEditarPerfilTabHref("servicios"), { scroll: false });
  }

  function openCreateAnuncio() {
    markDirty();
    setEditingId(null);
    setAddingService(true);
    router.replace(buildEditarPerfilTabHref("servicios"), { scroll: false });
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
      accountEmail: userEmail || null,
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
    [perfil, providerDocuments, services, userEmail],
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

  async function toggleServiceDisponible(serviceId) {
    const target = services.find((s) => s.id === serviceId);
    if (!target || target.isNew) return;
    if (!servicioRevisionAprobada(target.revision_estado)) return;
    if (togglingDisponibleId) return;

    const nextDisponible = !target.disponible;

    if (nextDisponible) {
      const bloqueo = getActivacionBloqueoMensaje(
        perfil,
        target,
        documentContext,
      );
      if (bloqueo) {
        setErrorMessage(bloqueo);
        return;
      }
    }

    setErrorMessage("");
    setSuccessMessage("");
    setTogglingDisponibleId(serviceId);

    try {
      const res = await fetch(`/api/services/${serviceId}/disponible`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ disponible: nextDisponible }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          payload.error || "No se pudo actualizar la disponibilidad.",
        );
        return;
      }

      if (typeof payload.disponible !== "boolean") {
        setErrorMessage("La API no confirmó el nuevo estado.");
        return;
      }

      setServices((prev) =>
        prev.map((s) =>
          s.id === serviceId
            ? {
                ...s,
                disponible: payload.disponible,
                disponibleOnLoad: payload.disponible,
              }
            : s,
        ),
      );
      setSuccessMessage(
        payload.disponible
          ? "Servicio activado. Ya es visible en la búsqueda."
          : "Servicio en pausa. Ya no aparece en la búsqueda.",
      );
    } catch (err) {
      setErrorMessage(
        err.message || "No se pudo actualizar la disponibilidad.",
      );
    } finally {
      setTogglingDisponibleId(null);
    }
  }

  function toggleIdioma(lang) {
    markDirty();
    setIdiomas((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  const esClienteSinServicios = perfil?.role === "cliente" && services.length === 0;
  const tieneServicios = services.length > 0;
  const mostrarTabServicios =
    perfil?.role === "proveedor" || tieneServicios;
  const tabs = [
    { id: "perfil", label: "Perfil personal" },
    ...(mostrarTabServicios
      ? [{ id: "servicios", label: "Mis servicios" }]
      : []),
    ...(tieneServicios ? [{ id: "documentos", label: "Documentos" }] : []),
    { id: "cuenta", label: "Cuenta" },
  ];

  function renderMisServiciosCard() {
    return (
      <Card title="Mis servicios">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#666]">
            {services.length === 0
              ? "Aún no tienes anuncios. Crea el primero."
              : `${services.length} ${services.length === 1 ? "anuncio" : "anuncios"}`}
          </p>
          {!addingService ? (
            <button
              type="button"
              onClick={openCreateAnuncio}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: PRIMARY }}
            >
              + Crear anuncio
            </button>
          ) : null}
        </div>
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
              <li
                key={service.id}
                className="rounded-xl border p-4"
                style={{ borderColor: BRAND.border }}
              >
                <ServiceAvailabilityHeader
                  service={service}
                  onToggle={toggleServiceDisponible}
                  toggling={togglingDisponibleId === service.id}
                  showMeta
                  metaLabel={`${v?.label || service.vertical} · ${service.details.precio ? `${service.details.precio}€` : "—"}`}
                  actions={
                    <div className="flex gap-2">
                      <a
                        href={getProviderAnuncioHref(
                          service,
                          perfil,
                          documentContext,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:bg-[#f7f5f2]"
                        style={{ borderColor: BRAND.border, color: PRIMARY }}
                      >
                        Vista previa
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          isEditing
                            ? closeServiceEditor()
                            : openServiceEditor(service.id)
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                        style={{ borderColor: BRAND.border, color: PRIMARY }}
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </button>
                    </div>
                  }
                />
                {isEditing && (
                  <div
                    className="mt-4 border-t pt-4"
                    style={{ borderColor: BRAND.border }}
                  >
                    <ServiceEditForm
                      vertical={service.vertical}
                      details={service.details}
                      userId={userId}
                      serviceId={service.isNew ? null : service.id}
                      onChange={(details) =>
                        updateServiceDetails(service.id, details)
                      }
                      onUploadError={setErrorMessage}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {addingService ? (
          <div
            className="mt-4 rounded-xl border p-4"
            style={{ borderColor: BRAND.border }}
          >
            <p className="text-sm font-semibold">Nuevo anuncio</p>
            <p className="mt-1 text-xs text-[#888]">Elige la vertical y completa los datos.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {VERTICALS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setNewVertical(v.id);
                    setNewServiceDetails({
                      ...emptyServiceDetails(),
                      ...(v.id === "ninos" || v.id === "mascotas"
                        ? {
                            modalidades_cobro: seedModalidadesCobroFromLegacy(
                              v.id,
                              {},
                            ),
                          }
                        : {}),
                    });
                  }}
                  className="rounded-full border px-4 py-2 text-sm font-medium"
                  style={{
                    borderColor:
                      newVertical === v.id ? PRIMARY : BRAND.border,
                    backgroundColor:
                      newVertical === v.id ? "#e8f0fb" : "#fff",
                    color: newVertical === v.id ? PRIMARY : "#444",
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <ServiceEditForm
              vertical={newVertical}
              details={newServiceDetails}
              userId={userId}
              onChange={(d) => {
                markDirty();
                setNewServiceDetails(d);
              }}
              onUploadError={setErrorMessage}
            />
            <button
              type="button"
              onClick={() => {
                setAddingService(false);
                setNewServiceDetails(emptyServiceDetails());
              }}
              className="mt-4 text-sm text-[#666]"
            >
              Cancelar
            </button>
          </div>
        ) : null}
      </Card>
    );
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
      for (const service of services) {
        const cobroError = validateModalidadCobro(
          service.details,
          service.vertical,
        );
        if (cobroError) {
          setErrorMessage(cobroError);
          setSubmitting(false);
          return;
        }
        const unidadesError = validateHuespedesPrecio(
          service.details,
          service.vertical,
        );
        if (unidadesError) {
          setErrorMessage(unidadesError);
          setSubmitting(false);
          return;
        }
      }
      if (addingService) {
        const cobroError = validateModalidadCobro(
          newServiceDetails,
          newVertical,
        );
        if (cobroError) {
          setErrorMessage(cobroError);
          setSubmitting(false);
          return;
        }
        const unidadesError = validateHuespedesPrecio(
          newServiceDetails,
          newVertical,
        );
        if (unidadesError) {
          setErrorMessage(unidadesError);
          setSubmitting(false);
          return;
        }
      }

      let fotoUrl = fotoPerfil;
      if (profilePhotoFile) {
        console.log("[editar-perfil] subiendo foto perfil");
        fotoUrl = await uploadProfilePhoto(userId, profilePhotoFile);
        console.log("[editar-perfil] foto perfil URL recibida", { fotoUrl });
      }

      console.log(
        "[editar-perfil] guardar — fotos en estado antes de Supabase",
        services.map((s) => ({
          id: s.id,
          vertical: s.vertical,
          fotosCount: normalizeFotosArray(s.details?.fotos, s.details?.foto_url).length,
          fotos: normalizeFotosArray(s.details?.fotos, s.details?.foto_url),
          foto_url: s.details?.foto_url,
        })),
      );

      const descripcionParts = [descripcion.trim()];
      if (personalidad.trim()) {
        descripcionParts.push(`Personalidad: ${personalidad.trim()}`);
      }

      const telefonoTrim = telefono.trim();
      if (telefonoTrim && !telefonoForStorage(telefonoTrim)) {
        setErrorMessage(TELEFONO_INVALID_MSG);
        setSubmitting(false);
        return;
      }

      const emailTrim = emailContacto.trim();
      const emailStored = emailContactoForStorage(emailTrim, userEmail);
      if (emailTrim && !emailStored) {
        setErrorMessage(EMAIL_CONTACTO_INVALID_MSG);
        setSubmitting(false);
        return;
      }

      const telefonoStored = telefonoForStorage(telefonoTrim);

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        ciudad: ciudad.trim(),
        telefono: telefonoStored,
        email_contacto: emailStored,
        descripcion: descripcionParts.join("\n\n"),
        location_zone: ciudad.trim(),
        foto_perfil: fotoUrl,
        idiomas,
        anos_experiencia: anosExperiencia ? Number(anosExperiencia) : null,
      });

      if (profileError) throw profileError;

      setPerfil((prev) =>
        prev
          ? {
              ...prev,
              telefono: telefonoStored,
              email_contacto: emailStored,
              nombre: nombre.trim(),
              apellido: apellido.trim(),
              ciudad: ciudad.trim(),
            }
          : prev,
      );
      if (emailStored) setEmailContacto(emailStored);

      const revisionOutcomes = [];

      for (const service of services) {
        const locationFields = await getServiceLocationFields(
          service.details,
          service.vertical,
        );
        const revisionMeta = resolveRevisionEstadoOnSave({
          details: service.details,
          vertical: service.vertical,
          ciudad,
          currentRevisionEstado: service.revision_estado,
          isNew: service.isNew === true,
        });
        revisionOutcomes.push(revisionMeta);

        const payload = {
          ...buildServicePayload(
            service.details,
            service.vertical,
            ciudad,
            userId,
            resolveDisponibleForSave(service, perfil, documentContext),
          ),
          revision_estado: revisionMeta.revision_estado,
        };

        console.log("[editar-perfil] guardar — payload servicio", {
          serviceId: service.id,
          vertical: service.vertical,
          revision_estado: payload.revision_estado,
          fotosCount: Array.isArray(payload.fotos) ? payload.fotos.length : 0,
          fotos: payload.fotos,
          foto_url: payload.foto_url,
        });

        if (service.isNew) {
          const { data: inserted, error } = await supabase
            .from("services")
            .insert(payload)
            .select("*")
            .single();
          if (error) throw error;
          revisionMeta.savedRow = inserted;
          const contactResult = await syncServiceContact(
            inserted.id,
            locationFields,
          );
          if (!contactResult.ok) {
            throw new Error(
              contactResult.error ||
                "No se pudo guardar el contacto del servicio",
            );
          }
          const modResult = await saveServiceModalidades(
            inserted.id,
            service.details,
            service.vertical,
          );
          if (!modResult.ok) throw new Error(modResult.error);
        } else {
          const expectedFotos = parseFotosFromDb({
            fotos: payload.fotos,
            foto_url: payload.foto_url,
          });

          const { data: updated, error } = await supabase
            .from("services")
            .update(payload)
            .eq("id", service.id)
            .select("id, fotos, foto_url, revision_estado")
            .single();

          if (error) throw error;

          const contactResult = await syncServiceContact(
            service.id,
            locationFields,
          );
          if (!contactResult.ok) {
            throw new Error(
              contactResult.error ||
                "No se pudo guardar el contacto del servicio",
            );
          }

          let savedFotos = parseFotosFromDbStrict(updated);
          console.log("[editar-perfil] guardar — BD devolvió", {
            id: updated?.id,
            fotosCountStrict: savedFotos.length,
            fotosCountWithFallback: parseFotosFromDb(updated).length,
            fotos: updated?.fotos,
            foto_url: updated?.foto_url,
            revision_estado: updated?.revision_estado,
          });

          if (savedFotos.length !== expectedFotos.length) {
            console.warn(
              "[editar-perfil] fotos no coinciden tras update cliente — fallback API",
              { expected: expectedFotos.length, saved: savedFotos.length },
            );
            const res = await fetch(`/api/services/${service.id}/fotos`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              credentials: "same-origin",
              body: JSON.stringify({ fotos: expectedFotos }),
            });
            const apiPayload = await res.json().catch(() => ({}));
            if (!res.ok) {
              throw new Error(
                apiPayload.error ||
                  "No se pudieron guardar las fotos del servicio.",
              );
            }
            if (apiPayload.verified !== true) {
              throw new Error(
                "La API no confirmó la escritura de fotos en la base de datos.",
              );
            }
            savedFotos = normalizeFotosArray(apiPayload.fotos);
            console.log("[editar-perfil] guardar — fotos vía API", {
              fotosCount: savedFotos.length,
              fotos: savedFotos,
            });
          }

          const modResult = await saveServiceModalidades(
            service.id,
            service.details,
            service.vertical,
          );
          if (!modResult.ok) throw new Error(modResult.error);
        }
      }

      let servicesAfterSave = services.map((s, index) => {
        const meta = revisionOutcomes[index];
        if (meta?.savedRow) {
          const mapped = mapServiceFromDb(meta.savedRow);
          return {
            ...mapped,
            details: {
              ...mapped.details,
              modalidades_cobro:
                s.details?.modalidades_cobro ||
                seedModalidadesCobroFromLegacy(s.vertical, s.details),
            },
          };
        }
        return {
          ...s,
          isNew: false,
          revision_estado:
            meta?.revision_estado !== undefined
              ? meta.revision_estado
              : s.revision_estado,
          disponible: resolveDisponibleForSave(s, perfil, documentContext),
          details: {
            ...s.details,
            modalidades_cobro: s.details?.modalidades_cobro,
          },
        };
      });

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
        const revisionMeta = resolveRevisionEstadoOnSave({
          details: newServiceDetails,
          vertical: newVertical,
          ciudad,
          currentRevisionEstado: null,
          isNew: true,
        });
        revisionOutcomes.push(revisionMeta);
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
          revision_estado: revisionMeta.revision_estado,
        };
        const { data, error } = await supabase
          .from("services")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        const contactResult = await syncServiceContact(data.id, locationFields);
        if (!contactResult.ok) {
          throw new Error(
            contactResult.error ||
              "No se pudo guardar el contacto del servicio",
          );
        }
        const modResult = await saveServiceModalidades(
          data.id,
          newServiceDetails,
          newVertical,
        );
        if (!modResult.ok) throw new Error(modResult.error);
        const mappedNew = mapServiceFromDb({
          ...data,
          ...locationFields,
          direccion_exacta: locationFields.direccion_exacta || "",
          telefono_contacto: locationFields.telefono_contacto || "",
        });
        servicesAfterSave = [
          ...servicesAfterSave,
          {
            ...mappedNew,
            details: {
              ...mappedNew.details,
              modalidades_cobro:
                newServiceDetails.modalidades_cobro ||
                seedModalidadesCobroFromLegacy(newVertical, newServiceDetails),
            },
          },
        ];
        setAddingService(false);
        setNewServiceDetails(emptyServiceDetails());
      }

      setServices(servicesAfterSave);

      const pendingReviewIds = servicesAfterSave
        .filter((s) => s.revision_estado === REVISION_EN_REVISION && s.id)
        .map((s) => s.id);
      if (pendingReviewIds.length > 0) {
        try {
          await fetch("/api/services/revision-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_ids: pendingReviewIds }),
          });
        } catch (notifyErr) {
          console.error("[editar-perfil] revision-notify", notifyErr);
        }
      }

      const reminderVertical =
        (editingId &&
          (servicesAfterSave.find((s) => s.id === editingId)?.vertical ||
            services.find((s) => s.id === editingId)?.vertical)) ||
        (addingService ? newVertical : null);

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

      const revisionFeedback = buildServicesSaveFeedback(revisionOutcomes);

      if (reminderVertical) {
        const postSaveContext = {
          ...documentContext,
          services: servicesAfterSave.map((s) => ({
            vertical: s.vertical,
            nru: s.details?.nru,
            details: s.details,
          })),
        };
        const missingPublishDocs = getMissingPublishDocumentsForVertical(
          reminderVertical,
          postSaveContext,
          perfil,
        );

        if (missingPublishDocs.length > 0) {
          setDocumentosReminderVertical(reminderVertical);
          setActiveTab("documentos");
          router.replace(buildEditarPerfilTabHref("documentos"), { scroll: false });
          setSuccessMessage(
            `${revisionFeedback} ${buildPublishReminderMessage(reminderVertical, missingPublishDocs)}`,
          );
          return;
        }
      }

      setSuccessMessage(revisionFeedback);
      if (activeTab === "servicios") {
        router.replace(buildEditarPerfilTabHref("servicios"), { scroll: false });
      }
    } catch (err) {
      console.error("[editar-perfil] error al guardar", err);
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
                {!hasTelefono({ telefono }) && (
                  <p
                    className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed"
                    style={{ backgroundColor: "#e8f0fb", color: "#1d4f91" }}
                  >
                    {TELEFONO_BANNER_CLIENT_MSG}
                  </p>
                )}
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
                {providerMissingContactBanner(
                  {
                    telefono,
                    email_contacto: emailContacto,
                  },
                  userEmail,
                ) && (
                  <p
                    className="mb-2 rounded-lg px-3 py-2 text-[11px] leading-relaxed sm:col-span-2"
                    style={{ backgroundColor: "#e8f0fb", color: "#1d4f91" }}
                  >
                    {PROVIDER_CONTACT_BANNER_MSG}
                  </p>
                )}
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
                <label className="mb-1.5 block text-xs font-medium text-[#444]">
                  Email de contacto
                </label>
                <input
                  type="email"
                  value={emailContacto}
                  onChange={(e) => {
                    markDirty();
                    setEmailContacto(e.target.value);
                  }}
                  placeholder="contacto@ejemplo.com"
                  className={inputClass}
                  style={{ borderColor: BRAND.border }}
                />
                <p className="mt-1 text-[10px] text-[#aaa]">
                  Por defecto usamos el email de tu cuenta; cámbialo si quieres otro de
                  contacto
                </p>
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

          {/* Resumen: la lista completa vive en ?tab=servicios */}
          {mostrarTabServicios ? (
            <Card title="Mis servicios">
              <p className="text-sm text-[#666]">
                {services.length === 0
                  ? "Aún no tienes anuncios publicados."
                  : `Tienes ${services.length} ${services.length === 1 ? "anuncio" : "anuncios"}.`}
              </p>
              <button
                type="button"
                onClick={() => handleTabChange("servicios")}
                className="mt-3 text-sm font-semibold"
                style={{ color: PRIMARY }}
              >
                Ir a Mis servicios →
              </button>
            </Card>
          ) : null}

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

    if (activeTab === "servicios") {
      return renderMisServiciosCard();
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
      {!esClienteSinServicios &&
        providerMissingContactBanner(
          {
            telefono,
            email_contacto: emailContacto,
          },
          userEmail,
        ) && (
          <div
            className="mx-6 mt-4 rounded-lg px-4 py-3 text-sm leading-relaxed"
            style={{ backgroundColor: "#e8f0fb", color: "#1d4f91" }}
          >
            {PROVIDER_CONTACT_BANNER_MSG}{" "}
            <button
              type="button"
              onClick={() => setActiveTab("perfil")}
              className="font-semibold underline"
              style={{ color: "#1d4f91" }}
            >
              Ir a Perfil →
            </button>
          </div>
        )}
      {errorMessage && (
        <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
          {!hasDniUploaded(perfil) && (
            <p className="mt-2">
              <Link
                href={`${DNI_SUBIR_RUTA}?next=/editar-perfil`}
                className="font-semibold no-underline hover:underline"
                style={{ color: BRAND.primary }}
              >
                Subir DNI →
              </Link>
            </p>
          )}
        </div>
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
