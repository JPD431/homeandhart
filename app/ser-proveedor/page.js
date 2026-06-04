"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BRAND, SERIF } from "@/app/components/brand";

const DARK_BLUE = "#163a6b";

const SERVICES = [
  { id: "alojamiento", label: "Alojamiento" },
  { id: "ninos", label: "Cuidado de niños" },
  { id: "mascotas", label: "Cuidado de mascotas" },
];

const LANGUAGES = [
  "Español",
  "Inglés",
  "Francés",
  "Alemán",
  "Italiano",
  "Portugués",
];

const CANCEL_POLICIES = [
  {
    value: "flexible",
    label: "Flexible",
    description:
      "Cancelación gratuita hasta 24h antes · 50% de reembolso dentro de las 24h previas",
  },
  {
    value: "moderada",
    label: "Moderada",
    description:
      "Cancelación gratuita hasta 3 días antes · 50% entre 3 días y 24h antes",
  },
  {
    value: "estricta",
    label: "Estricta",
    description:
      "Cancelación gratuita hasta 7 días antes · 50% entre 7 y 3 días antes",
  },
];

const TITULO_PLACEHOLDERS = {
  alojamiento: "Ej: Apartamento luminoso en el centro de Madrid",
  ninos: "Ej: Niñera certificada con experiencia en bebés",
  mascotas: "Ej: Cuidador de perros con jardín en Salamanca",
};

const LOCATION_ZONE_PLACEHOLDERS = {
  alojamiento: "Ej: Salamanca, Centro, Malasaña...",
  ninos: "Ej: Salamanca, Retiro, Chamberí...",
  mascotas: "Ej: Malasaña, Lavapiés, Chamartín...",
};

const ESTANCIA_PLACEHOLDERS = {
  alojamiento: {
    min: "Mínimo de noches (ej: 2)",
    max: "Máximo de noches (ej: 30) — opcional",
  },
  ninos: {
    min: "Mínimo de horas (ej: 2)",
    max: "Máximo de horas (ej: 8) — opcional",
  },
  mascotas: {
    min: "Mínimo de días (ej: 1)",
    max: "Máximo de días (ej: 14) — opcional",
  },
};

const DIAS_SEMANA = [
  { id: "lun", label: "Lun" },
  { id: "mar", label: "Mar" },
  { id: "mie", label: "Mié" },
  { id: "jue", label: "Jue" },
  { id: "vie", label: "Vie" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

const DIAS_DISPONIBLES_DEFAULT = DIAS_SEMANA.map((d) => d.id);

const ANTELACION_OPTIONS = [
  { value: 0, label: "Sin restricción" },
  { value: 1, label: "Al menos 1 hora antes" },
  { value: 3, label: "Al menos 3 horas antes" },
  { value: 6, label: "Al menos 6 horas antes" },
  { value: 12, label: "Al menos 12 horas antes" },
  { value: 24, label: "Al menos 24 horas antes" },
  { value: 48, label: "Al menos 48 horas antes" },
  { value: 72, label: "Al menos 3 días antes" },
  { value: 168, label: "Al menos 7 días antes" },
];

async function geocodeBarrio(barrio, ciudad) {
  const query = `${barrio}, ${ciudad}, España`;
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}&limit=1&country=es`,
  );
  const data = await response.json();
  if (data.features?.length > 0) {
    const [lng, lat] = data.features[0].center;
    return { lat, lng };
  }
  return null;
}

async function geocodeLocationZonesForServices(selectedIds, detailsByService, ciudad) {
  const result = { ...detailsByService };
  await Promise.all(
    selectedIds.map(async (serviceId) => {
      const details = result[serviceId];
      const barrio = details.location_zone?.trim();
      if (!barrio || !ciudad) return;
      const coords = await geocodeBarrio(barrio, ciudad);
      if (coords) {
        result[serviceId] = {
          ...details,
          location_lat: coords.lat,
          location_lng: coords.lng,
        };
      }
    }),
  );
  return result;
}

const TIPO_ALOJAMIENTO_OPTIONS = [
  {
    value: "completo",
    label: "Alojamiento completo — piso o casa entera",
  },
  {
    value: "habitacion_privada",
    label: "Habitación privada — habitación propia en piso compartido",
  },
  {
    value: "habitacion_compartida",
    label: "Habitación compartida — compartes la habitación",
  },
  {
    value: "habitacion_hotel",
    label: "Habitación de hotel",
  },
  {
    value: "otros",
    label: "Otros",
  },
];

const EMPTY_SERVICE_DETAILS = {
  alojamiento: {
    titulo: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    tipo_alojamiento: "",
    precio: "",
    estancia_minima: "",
    estancia_maxima: "",
    antelacion_minima: 24,
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    nru: "",
    cancelacion: "moderada",
    reserva_inmediata: false,
    direccion_exacta: "",
    telefono_contacto: "",
    oferta_activa: false,
    oferta_titulo: "",
    oferta_descuento: "",
    oferta_valida_hasta: "",
    oferta_descripcion: "",
    disponible_para_viajar: false,
  },
  ninos: {
    titulo: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    precio: "",
    estancia_minima: "",
    estancia_maxima: "",
    antelacion_minima: 24,
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    edades: "",
    certificacion: "",
    cancelacion: "moderada",
    reserva_inmediata: false,
    telefono_contacto: "",
    modalidad: "domicilio_cliente",
    direccion_exacta: "",
    oferta_activa: false,
    oferta_titulo: "",
    oferta_descuento: "",
    oferta_valida_hasta: "",
    oferta_descripcion: "",
    disponible_para_viajar: false,
  },
  mascotas: {
    titulo: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    precio: "",
    estancia_minima: "",
    estancia_maxima: "",
    antelacion_minima: 24,
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    tipos: "",
    cancelacion: "moderada",
    reserva_inmediata: false,
    telefono_contacto: "",
    modalidad: "domicilio_cliente",
    direccion_exacta: "",
    oferta_activa: false,
    oferta_titulo: "",
    oferta_descuento: "",
    oferta_valida_hasta: "",
    oferta_descripcion: "",
    disponible_para_viajar: false,
  },
};

const DOCUMENT_CATALOG = {
  dni_propietario: {
    title: "DNI o pasaporte del propietario",
    note: null,
    noteRed: false,
  },
  nru: {
    title: "NRU — Número de Registro Único",
    note: "Obligatorio por ley desde julio 2024",
    noteRed: false,
  },
  dni_nie: {
    title: "DNI o NIE vigente",
    note: null,
    noteRed: false,
  },
  certificado_antecedentes: {
    title: "Certificado de antecedentes penales",
    note: null,
    noteRed: false,
  },
  certificado_delitos_sexuales: {
    title: "Certificado de delitos de naturaleza sexual",
    note:
      "Obligatorio por Ley Orgánica 1/1996 de Protección Jurídica del Menor · Renovar cada 6 meses",
    noteRed: true,
  },
};

function getRequiredDocuments(selectedServices) {
  const docs = [];
  const added = new Set();
  const hasAlojamiento = selectedServices.includes("alojamiento");
  const hasNinos = selectedServices.includes("ninos");
  const hasMascotas = selectedServices.includes("mascotas");

  function add(id, overrides = {}) {
    if (!added.has(id)) {
      added.add(id);
      docs.push({ id, ...DOCUMENT_CATALOG[id], ...overrides });
    }
  }

  if (hasAlojamiento) {
    add("dni_propietario");
    add("nru");
  }
  if (hasNinos || hasMascotas) {
    add("dni_nie", hasNinos ? { note: "Obligatorio" } : {});
  }
  if (hasNinos) {
    add("certificado_antecedentes", {
      note: "Emitido por el Ministerio de Justicia",
    });
    add("certificado_delitos_sexuales");
  } else if (hasMascotas) {
    add("certificado_antecedentes", { note: "Recomendado" });
  }

  return docs;
}

const STORAGE_BUCKET = "Documentos";

const DOC_PROFILE_FIELDS = {
  dni_propietario: "doc_dni_url",
  dni_nie: "doc_dni_url",
  certificado_antecedentes: "doc_antecedentes_url",
  certificado_delitos_sexuales: "doc_antecedentes_sexuales_url",
};

async function uploadDocumentToStorage(userId, docId, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const filePath = `${userId}/${docId}-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

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

function PersonOutlineIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function UploadIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function CancelPolicySelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputClass}
      style={{ borderColor: BRAND.border }}
    >
      {CANCEL_POLICIES.map((policy) => (
        <option key={policy.value} value={policy.value}>
          {policy.label} — {policy.description}
        </option>
      ))}
    </select>
  );
}

function FieldNote({ children }) {
  return <p className="mt-1 text-xs text-[#888]">{children}</p>;
}

function ModalidadServiceSelector({ serviceId, value, onChange }) {
  const enMiDomicilioLabel =
    serviceId === "mascotas"
      ? "En mi domicilio — el cliente trae la mascota"
      : "En mi domicilio — el cliente trae al niño";

  const options = [
    {
      value: "domicilio_cliente",
      label: "En domicilio del cliente — yo me desplazo",
    },
    {
      value: "domicilio_proveedor",
      label: enMiDomicilioLabel,
    },
    {
      value: "ambas",
      label: "Ambas opciones disponibles",
    },
  ];

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs font-medium text-[#444]">Modalidad de servicio</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
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
  );
}

function OfertaEspecialSection({ serviceId, details, onChange }) {
  const enabled = details.oferta_activa === true;
  const showViajar = serviceId === "ninos" || serviceId === "mascotas";

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  return (
    <div
      className="mt-6 border-t pt-6"
      style={{ borderColor: BRAND.border }}
    >
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
          style={{
            backgroundColor: enabled ? BRAND.primary : "#d1d5db",
          }}
        >
          <span
            className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
            style={{
              left: enabled ? "calc(100% - 1.625rem)" : "0.125rem",
            }}
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
              placeholder="Ej: Semana de verano — 20% descuento"
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
              min={new Date().toISOString().split("T")[0]}
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
              placeholder="Cuéntanos más sobre esta oferta..."
              className={`${inputClass} resize-y`}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          {showViajar && (
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                style={{ borderColor: BRAND.border }}
              >
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">
                    Disponible para viajar
                  </p>
                  <p className="mt-0.5 text-xs text-[#666]">
                    Puedo desplazarme fuera de mi ciudad
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={details.disponible_para_viajar === true}
                  onClick={() =>
                    update(
                      "disponible_para_viajar",
                      !details.disponible_para_viajar,
                    )
                  }
                  className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
                  style={{
                    backgroundColor: details.disponible_para_viajar
                      ? BRAND.primary
                      : "#d1d5db",
                  }}
                >
                  <span
                    className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                    style={{
                      left: details.disponible_para_viajar
                        ? "calc(100% - 1.625rem)"
                        : "0.125rem",
                    }}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReservaModeSelector({ value, onChange }) {
  const isImmediate = value === true;

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs font-medium text-[#444]">Tipo de reserva</p>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onChange(false)}
          className="rounded-xl border p-3 text-left transition-colors"
          style={{
            borderColor: !isImmediate ? BRAND.primary : BRAND.border,
            backgroundColor: !isImmediate ? BRAND.light : "#fff",
          }}
        >
          <span className="text-sm font-semibold text-[#1a1a1a]">
            Con confirmación
          </span>
          <span className="mt-0.5 block text-xs text-[#666]">
            Tú aceptas o rechazas cada reserva
          </span>
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          className="rounded-xl border p-3 text-left transition-colors"
          style={{
            borderColor: isImmediate ? BRAND.primary : BRAND.border,
            backgroundColor: isImmediate ? BRAND.light : "#fff",
          }}
        >
          <span className="text-sm font-semibold text-[#1a1a1a]">
            Reserva inmediata
          </span>
          <span className="mt-0.5 block text-xs text-[#666]">
            El cliente reserva directamente sin esperar confirmación
          </span>
        </button>
      </div>
    </div>
  );
}

function TituloAnuncioField({ serviceId, value, onChange }) {
  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-[#444]">
        Título de tu anuncio
      </label>
      <input
        type="text"
        required
        placeholder={TITULO_PLACEHOLDERS[serviceId]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
        style={{ borderColor: BRAND.border }}
      />
    </div>
  );
}

function LocationZoneField({ serviceId, value, onChange, onBlur }) {
  const isAlojamiento = serviceId === "alojamiento";

  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-[#444]">
        {isAlojamiento ? "Barrio" : "Barrio o zona donde operas"}
      </label>
      <input
        type="text"
        placeholder={LOCATION_ZONE_PLACEHOLDERS[serviceId]}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={inputClass}
        style={{ borderColor: BRAND.border }}
      />
      {!isAlojamiento && (
        <FieldNote>
          Aparecerá en el mapa de búsqueda como ubicación aproximada
        </FieldNote>
      )}
    </div>
  );
}

function EstanciaFields({ serviceId, details, onChange }) {
  const placeholders = ESTANCIA_PLACEHOLDERS[serviceId];

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Estancia mínima
        </label>
        <input
          type="number"
          min="1"
          placeholder={placeholders.min}
          value={details.estancia_minima}
          onChange={(e) => update("estancia_minima", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Estancia máxima
        </label>
        <input
          type="number"
          min="1"
          placeholder={placeholders.max}
          value={details.estancia_maxima}
          onChange={(e) => update("estancia_maxima", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
    </>
  );
}

function DiasDisponiblesSelector({ value, onChange }) {
  const selected = Array.isArray(value) && value.length > 0 ? value : DIAS_DISPONIBLES_DEFAULT;

  function toggle(diaId) {
    const next = selected.includes(diaId)
      ? selected.filter((d) => d !== diaId)
      : [...selected, diaId];
    onChange(next.length > 0 ? next : []);
  }

  return (
    <div className="sm:col-span-2">
      <p className="mb-2 text-xs font-medium text-[#444]">Días disponibles</p>
      <div className="flex flex-wrap gap-2">
        {DIAS_SEMANA.map((dia) => {
          const isSelected = selected.includes(dia.id);
          return (
            <button
              key={dia.id}
              type="button"
              onClick={() => toggle(dia.id)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{
                borderColor: isSelected ? BRAND.primary : BRAND.border,
                backgroundColor: isSelected ? BRAND.light : "#fff",
                color: isSelected ? DARK_BLUE : "#666",
              }}
            >
              {dia.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AntelacionMinimaSelector({ value, onChange }) {
  const selected = value != null && value !== "" ? Number(value) : 24;

  return (
    <div className="sm:col-span-2">
      <label className="mb-1.5 block text-xs font-medium text-[#444]">
        Antelación mínima para reservar
      </label>
      <select
        value={String(selected)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={inputClass}
        style={{ borderColor: BRAND.border }}
      >
        {ANTELACION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TipoAlojamientoSelector({ value, onChange }) {
  return (
    <div className="sm:col-span-2">
      <input type="hidden" required value={value || ""} readOnly />
      <p className="mb-2 text-xs font-medium text-[#444]">Tipo de alojamiento</p>
      <div className="flex flex-col gap-2">
        {TIPO_ALOJAMIENTO_OPTIONS.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
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
  );
}

function ServiceFields({ serviceId, details, onChange, onLocationZoneBlur }) {
  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  const locationZoneBlur = onLocationZoneBlur
    ? () => onLocationZoneBlur(serviceId)
    : undefined;

  if (serviceId === "alojamiento") {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TituloAnuncioField
          serviceId={serviceId}
          value={details.titulo}
          onChange={(v) => update("titulo", v)}
        />
        <LocationZoneField
          serviceId={serviceId}
          value={details.location_zone}
          onChange={(v) => update("location_zone", v)}
          onBlur={locationZoneBlur}
        />
        <TipoAlojamientoSelector
          value={details.tipo_alojamiento}
          onChange={(v) => update("tipo_alojamiento", v)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Precio / noche (€)
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
        <EstanciaFields
          serviceId={serviceId}
          details={details}
          onChange={onChange}
        />
        <AntelacionMinimaSelector
          value={details.antelacion_minima}
          onChange={(v) => update("antelacion_minima", v)}
        />
        <DiasDisponiblesSelector
          value={details.dias_disponibles}
          onChange={(v) => update("dias_disponibles", v)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            NRU
          </label>
          <input
            type="text"
            value={details.nru}
            onChange={(e) => update("nru", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Política de cancelación
          </label>
          <CancelPolicySelect
            value={details.cancelacion}
            onChange={(v) => update("cancelacion", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Dirección exacta del alojamiento
          </label>
          <input
            type="text"
            value={details.direccion_exacta}
            onChange={(e) => update("direccion_exacta", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
          <FieldNote>
            Solo se comparte con el cliente cuando la reserva está confirmada.
            Nunca aparece en tu perfil público.
          </FieldNote>
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Teléfono de contacto
          </label>
          <input
            type="text"
            value={details.telefono_contacto}
            onChange={(e) => update("telefono_contacto", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
          <FieldNote>Solo se comparte al confirmar la reserva.</FieldNote>
        </div>
        <ReservaModeSelector
          value={details.reserva_inmediata}
          onChange={(v) => update("reserva_inmediata", v)}
        />
      </div>
    );
  }

  if (serviceId === "ninos") {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TituloAnuncioField
          serviceId={serviceId}
          value={details.titulo}
          onChange={(v) => update("titulo", v)}
        />
        <LocationZoneField
          serviceId={serviceId}
          value={details.location_zone}
          onChange={(v) => update("location_zone", v)}
          onBlur={locationZoneBlur}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Precio / hora (€)
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
        <EstanciaFields
          serviceId={serviceId}
          details={details}
          onChange={onChange}
        />
        <AntelacionMinimaSelector
          value={details.antelacion_minima}
          onChange={(v) => update("antelacion_minima", v)}
        />
        <DiasDisponiblesSelector
          value={details.dias_disponibles}
          onChange={(v) => update("dias_disponibles", v)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Edades
          </label>
          <input
            type="text"
            placeholder="Ej. 0–12 años"
            value={details.edades}
            onChange={(e) => update("edades", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Certificación
          </label>
          <input
            type="text"
            value={details.certificacion}
            onChange={(e) => update("certificacion", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Política de cancelación
          </label>
          <CancelPolicySelect
            value={details.cancelacion}
            onChange={(v) => update("cancelacion", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Teléfono de contacto
          </label>
          <input
            type="text"
            value={details.telefono_contacto}
            onChange={(e) => update("telefono_contacto", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <ModalidadServiceSelector
          serviceId="ninos"
          value={details.modalidad}
          onChange={(v) => update("modalidad", v)}
        />
        {(details.modalidad === "domicilio_proveedor" ||
          details.modalidad === "ambas") && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Dirección de tu domicilio
            </label>
            <input
              type="text"
              value={details.direccion_exacta}
              onChange={(e) => update("direccion_exacta", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
            <FieldNote>Solo se comparte al confirmar la reserva.</FieldNote>
          </div>
        )}
        <ReservaModeSelector
          value={details.reserva_inmediata}
          onChange={(v) => update("reserva_inmediata", v)}
        />
      </div>
    );
  }

  if (serviceId === "mascotas") {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <TituloAnuncioField
          serviceId={serviceId}
          value={details.titulo}
          onChange={(v) => update("titulo", v)}
        />
        <LocationZoneField
          serviceId={serviceId}
          value={details.location_zone}
          onChange={(v) => update("location_zone", v)}
          onBlur={locationZoneBlur}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Precio / día (€)
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
        <EstanciaFields
          serviceId={serviceId}
          details={details}
          onChange={onChange}
        />
        <AntelacionMinimaSelector
          value={details.antelacion_minima}
          onChange={(v) => update("antelacion_minima", v)}
        />
        <DiasDisponiblesSelector
          value={details.dias_disponibles}
          onChange={(v) => update("dias_disponibles", v)}
        />
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Tipos de animales
          </label>
          <input
            type="text"
            placeholder="Ej. perros, gatos"
            value={details.tipos}
            onChange={(e) => update("tipos", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Política de cancelación
          </label>
          <CancelPolicySelect
            value={details.cancelacion}
            onChange={(v) => update("cancelacion", v)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Teléfono de contacto
          </label>
          <input
            type="text"
            value={details.telefono_contacto}
            onChange={(e) => update("telefono_contacto", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
        <ModalidadServiceSelector
          serviceId="mascotas"
          value={details.modalidad}
          onChange={(v) => update("modalidad", v)}
        />
        {(details.modalidad === "domicilio_proveedor" ||
          details.modalidad === "ambas") && (
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Dirección de tu domicilio
            </label>
            <input
              type="text"
              value={details.direccion_exacta}
              onChange={(e) => update("direccion_exacta", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
            <FieldNote>Solo se comparte al confirmar la reserva.</FieldNote>
          </div>
        )}
        <ReservaModeSelector
          value={details.reserva_inmediata}
          onChange={(v) => update("reserva_inmediata", v)}
        />
      </div>
    );
  }

  return null;
}

export default function SerProveedorPage() {
  const router = useRouter();

  const profilePhotoRef = useRef(null);
  const servicePhotosRef = useRef(null);
  const documentInputRef = useRef(null);

  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [sobreTi, setSobreTi] = useState("");
  const [selectedServices, setSelectedServices] = useState([]);
  const [serviceDetails, setServiceDetails] = useState(EMPTY_SERVICE_DETAILS);
  const [servicePhotos, setServicePhotos] = useState([]);
  const [servicePhotoPreviews, setServicePhotoPreviews] = useState([]);
  const [selectedLanguages, setSelectedLanguages] = useState([]);
  const [documentFiles, setDocumentFiles] = useState({});
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function toggleService(id) {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function toggleLanguage(lang) {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function updateServiceDetails(serviceId, details) {
    setServiceDetails((prev) => ({ ...prev, [serviceId]: details }));
  }

  async function handleLocationZoneBlur(serviceId) {
    const details = serviceDetails[serviceId];
    const barrio = details.location_zone?.trim();
    const ciudadTrimmed = ciudad.trim();
    if (!barrio || !ciudadTrimmed) {
      updateServiceDetails(serviceId, {
        ...details,
        location_lat: null,
        location_lng: null,
      });
      return;
    }
    const coords = await geocodeBarrio(barrio, ciudadTrimmed);
    updateServiceDetails(serviceId, {
      ...details,
      location_lat: coords?.lat ?? null,
      location_lng: coords?.lng ?? null,
    });
  }

  function handleProfilePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
  }

  function handleServicePhotos(e) {
    const files = Array.from(e.target.files ?? []);
    const remaining = 6 - servicePhotos.length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setServicePhotos((prev) => [...prev, ...toAdd]);
    setServicePhotoPreviews((prev) => [
      ...prev,
      ...toAdd.map((f) => URL.createObjectURL(f)),
    ]);
    e.target.value = "";
  }

  function removeServicePhoto(index) {
    setServicePhotos((prev) => prev.filter((_, i) => i !== index));
    setServicePhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function openDocumentUpload(docId) {
    setActiveDocumentId(docId);
    documentInputRef.current?.click();
  }

  function handleDocumentFile(e) {
    const file = e.target.files?.[0];
    if (!file || !activeDocumentId) return;
    setDocumentFiles((prev) => ({ ...prev, [activeDocumentId]: file }));
    e.target.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setSubmitting(false);
      setErrorMessage("Debes iniciar sesión para enviar tu perfil.");
      return;
    }

    const docUrls = {};
    for (const [docId, file] of Object.entries(documentFiles)) {
      const field = DOC_PROFILE_FIELDS[docId];
      if (!field || !file) continue;

      try {
        docUrls[field] = await uploadDocumentToStorage(user.id, docId, file);
      } catch (uploadErr) {
        setSubmitting(false);
        setErrorMessage(
          uploadErr.message || "Error al subir la documentación.",
        );
        return;
      }
    }

    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_dni_url text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_antecedentes_url text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_antecedentes_sexuales_url text;
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      role: "proveedor",
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      ciudad: ciudad.trim(),
      descripcion: sobreTi.trim(),
      location_zone: ciudad.trim(),
      idiomas: selectedLanguages,
      email_contacto: user.email,
      ...docUrls,
    });

    if (profileError) {
      setSubmitting(false);
      setErrorMessage(profileError.message);
      return;
    }

    if (selectedServices.length > 0) {
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS direccion_exacta text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS telefono_contacto text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS modalidad text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS tipo_alojamiento text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS estancia_minima integer;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS estancia_maxima integer;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS antelacion_minima integer DEFAULT 24;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS dias_disponibles text[];
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS oferta_titulo text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS oferta_descuento integer;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS oferta_valida_hasta date;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS oferta_descripcion text;
      // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS disponible_para_viajar boolean DEFAULT false;
      const ciudadTrimmed = ciudad.trim();
      const detailsForInsert = await geocodeLocationZonesForServices(
        selectedServices,
        serviceDetails,
        ciudadTrimmed,
      );

      const serviceRows = selectedServices.map((serviceId) => {
        const details = detailsForInsert[serviceId];
        return {
          proveedor_id: user.id,
          vertical: serviceId,
          titulo: details.titulo.trim(),
          precio: details.precio ? Number(details.precio) : null,
          estancia_minima: details.estancia_minima
            ? Number(details.estancia_minima)
            : null,
          estancia_maxima: details.estancia_maxima
            ? Number(details.estancia_maxima)
            : null,
          antelacion_minima:
            details.antelacion_minima != null && details.antelacion_minima !== ""
              ? Number(details.antelacion_minima)
              : 24,
          dias_disponibles:
            Array.isArray(details.dias_disponibles) &&
            details.dias_disponibles.length > 0
              ? details.dias_disponibles
              : DIAS_DISPONIBLES_DEFAULT,
          cancellation_policy: details.cancelacion,
          ciudad: ciudadTrimmed,
          location_zone: details.location_zone?.trim() || null,
          location_lat: details.location_lat ?? null,
          location_lng: details.location_lng ?? null,
          disponible: true,
          reserva_inmediata: details.reserva_inmediata === true,
          direccion_exacta: details.direccion_exacta?.trim() || null,
          telefono_contacto: details.telefono_contacto?.trim() || null,
          modalidad:
            serviceId === "alojamiento" ? null : details.modalidad || null,
          tipo_alojamiento:
            serviceId === "alojamiento" ? details.tipo_alojamiento || null : null,
          oferta_titulo: details.oferta_activa
            ? details.oferta_titulo?.trim() || null
            : null,
          oferta_descuento:
            details.oferta_activa && details.oferta_descuento
              ? Math.min(90, Math.max(1, Number(details.oferta_descuento)))
              : null,
          oferta_valida_hasta:
            details.oferta_activa && details.oferta_valida_hasta
              ? details.oferta_valida_hasta
              : null,
          oferta_descripcion: details.oferta_activa
            ? details.oferta_descripcion?.trim() || null
            : null,
          disponible_para_viajar:
            details.oferta_activa &&
            (serviceId === "ninos" || serviceId === "mascotas") &&
            details.disponible_para_viajar === true,
        };
      });

      const { error: servicesError } = await supabase
        .from("services")
        .insert(serviceRows);

      if (servicesError) {
        setSubmitting(false);
        setErrorMessage(servicesError.message);
        return;
      }
    }

    setSubmitting(false);
    setSuccessMessage(
      "Perfil enviado correctamente. Te avisamos en menos de 24h.",
    );

    setTimeout(() => {
      router.push("/dashboard");
    }, 2000);
  }

  const photoSlots = Math.min(
    6,
    Math.max(3, servicePhotoPreviews.length + 1),
  );

  const requiredDocuments = getRequiredDocuments(selectedServices);

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <header
        className="sticky top-0 z-50 px-4 py-5 text-white sm:px-6"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="mx-auto max-w-2xl">
          <h1 className="text-xl font-semibold sm:text-2xl">
            Crea tu perfil de proveedor
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "rgba(255, 255, 255, 0.75)" }}
          >
            Tarda unos minutos. Puedes editarlo después.
          </p>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10"
      >
        {/* 01 — Foto de perfil */}
        <section
          className="border-b pb-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="01" title="Foto de perfil" />
          <h2
            className="mt-3 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Ponle cara a tu perfil
          </h2>
          <input
            ref={profilePhotoRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleProfilePhoto}
          />
          <button
            type="button"
            onClick={() => profilePhotoRef.current?.click()}
            className="mt-5 flex w-full flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 transition-colors hover:bg-white/60"
            style={{ borderColor: BRAND.border }}
          >
            {profilePhotoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profilePhotoPreview}
                alt="Vista previa"
                className="mb-3 h-24 w-24 rounded-full object-cover"
              />
            ) : (
              <PersonOutlineIcon className="mb-3 h-10 w-10 text-[#1d4f91]" />
            )}
            <span className="text-sm font-medium text-[#1a1a1a]">
              Subir foto de perfil
            </span>
            <span className="mt-1 text-xs text-[#888]">
              JPG o PNG · máx 5MB
            </span>
          </button>
        </section>

        {/* 02 — Datos personales */}
        <section
          className="border-b py-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="02" title="Datos personales" />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="nombre" className="mb-1.5 block text-xs font-medium text-[#444]">
                Nombre
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label htmlFor="apellido" className="mb-1.5 block text-xs font-medium text-[#444]">
                Apellido
              </label>
              <input
                id="apellido"
                type="text"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
          </div>
          <div className="mt-4">
            <label htmlFor="ciudad" className="mb-1.5 block text-xs font-medium text-[#444]">
              Ciudad
            </label>
            <input
              id="ciudad"
              type="text"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div className="mt-4">
            <label htmlFor="sobreTi" className="mb-1.5 block text-xs font-medium text-[#444]">
              Sobre ti
            </label>
            <textarea
              id="sobreTi"
              rows={5}
              value={sobreTi}
              onChange={(e) => setSobreTi(e.target.value)}
              placeholder="Cuéntanos quién eres, tu experiencia y por qué las familias pueden confiar en ti..."
              className={`${inputClass} resize-y`}
              style={{ borderColor: BRAND.border }}
            />
          </div>
        </section>

        {/* 03 — Servicios */}
        <section
          className="border-b py-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="03" title="Servicios" />
          <h2
            className="mt-3 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            ¿Qué puedes hacer por las familias?
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
            {SERVICES.map((service) => {
              const selected = selectedServices.includes(service.id);
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor: selected ? BRAND.primary : BRAND.border,
                    backgroundColor: selected ? BRAND.light : "#fff",
                    color: selected ? DARK_BLUE : "#444",
                  }}
                >
                  {service.label}
                </button>
              );
            })}
          </div>
          {selectedServices.map((serviceId) => {
            const service = SERVICES.find((s) => s.id === serviceId);
            return (
              <div
                key={serviceId}
                className="mt-5 rounded-2xl border bg-white p-5"
                style={{ borderColor: BRAND.border }}
              >
                <p className="text-sm font-semibold" style={{ color: BRAND.primary }}>
                  {service?.label}
                </p>
                <ServiceFields
                  serviceId={serviceId}
                  details={serviceDetails[serviceId]}
                  onLocationZoneBlur={handleLocationZoneBlur}
                  onChange={(details) =>
                    updateServiceDetails(serviceId, details)
                  }
                />
                <OfertaEspecialSection
                  serviceId={serviceId}
                  details={serviceDetails[serviceId]}
                  onChange={(details) =>
                    updateServiceDetails(serviceId, details)
                  }
                />
              </div>
            );
          })}
        </section>

        {/* 04 — Fotos */}
        <section
          className="border-b py-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="04" title="Fotos" />
          <input
            ref={servicePhotosRef}
            type="file"
            accept="image/jpeg,image/png"
            multiple
            className="hidden"
            onChange={handleServicePhotos}
          />
          <div className="mt-5 grid grid-cols-3 gap-3">
            {Array.from({ length: photoSlots }).map((_, index) => {
              const preview = servicePhotoPreviews[index];
              const isAddSlot = index === servicePhotoPreviews.length;

              if (preview) {
                return (
                  <div
                    key={index}
                    className="relative aspect-square overflow-hidden rounded-xl border"
                    style={{ borderColor: BRAND.border }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt={`Foto ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeServicePhoto(index)}
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-xs text-white"
                      aria-label="Eliminar foto"
                    >
                      ×
                    </button>
                  </div>
                );
              }

              if (isAddSlot && servicePhotos.length < 6) {
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => servicePhotosRef.current?.click()}
                    className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed text-2xl text-[#aaa] transition-colors hover:border-[#1d4f91] hover:text-[#1d4f91]"
                    style={{ borderColor: BRAND.border }}
                  >
                    +
                  </button>
                );
              }

              return (
                <div
                  key={index}
                  className="aspect-square rounded-xl border border-dashed bg-white/50"
                  style={{ borderColor: BRAND.border }}
                />
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#888]">
            Hasta 6 fotos · JPG o PNG · máx 5MB
          </p>
        </section>

        {/* 05 — Idiomas */}
        <section
          className="border-b py-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="05" title="Idiomas" />
          <div className="mt-5 flex flex-wrap gap-2">
            {LANGUAGES.map((lang) => {
              const selected = selectedLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => toggleLanguage(lang)}
                  className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    borderColor: selected ? BRAND.primary : BRAND.border,
                    backgroundColor: selected ? BRAND.light : "#fff",
                    color: selected ? DARK_BLUE : "#444",
                  }}
                >
                  {lang}
                </button>
              );
            })}
          </div>
        </section>

        {/* 06 — Documentación */}
        <section className="pb-10">
          <SectionLabel number="06" title="Documentación" />
          <input
            ref={documentInputRef}
            type="file"
            accept="image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleDocumentFile}
          />
          <div className="mt-5 flex flex-col gap-4">
            {requiredDocuments.length === 0 ? (
              <p className="rounded-2xl border bg-white px-5 py-5 text-sm text-[#888]" style={{ borderColor: BRAND.border }}>
                Selecciona al menos un servicio en la sección 03 para ver los
                documentos requeridos.
              </p>
            ) : (
              requiredDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => openDocumentUpload(doc.id)}
                  className="flex items-center gap-4 rounded-2xl border-2 border-dashed bg-white px-5 py-5 text-left transition-colors hover:bg-[#fafafa]"
                  style={{ borderColor: BRAND.border }}
                >
                  <UploadIcon className="h-6 w-6 shrink-0 text-[#1d4f91]" />
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a]">
                      {doc.title}
                    </p>
                    {doc.note && (
                      <p
                        className={`mt-0.5 text-xs ${doc.noteRed ? "text-red-600" : "text-[#888]"}`}
                      >
                        {doc.note}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-[#888]">
                      {documentFiles[doc.id]
                        ? documentFiles[doc.id].name
                        : "JPG, PNG o PDF · máx 5MB"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Submit */}
        <div className="border-t pt-8" style={{ borderColor: BRAND.border }}>
          {successMessage && (
            <p className="mb-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              {successMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !!successMessage}
            className="w-full rounded-xl py-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: BRAND.primary }}
          >
            {submitting ? "Enviando..." : "Enviar perfil para revisión →"}
          </button>
          <p className="mt-4 text-center text-xs leading-relaxed text-[#888]">
            Revisamos tu perfil en menos de 24h. Te avisamos por email cuando
            esté activo.
          </p>
        </div>
      </form>
    </div>
  );
}
