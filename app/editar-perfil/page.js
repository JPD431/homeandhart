"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Navbar from "@/app/components/Navbar";
import ProveedorEmergenciaToggle from "@/app/components/ProveedorEmergenciaToggle";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  normalizeDescuentosDuracion,
  serializeDescuentosDuracionForDb,
} from "@/app/lib/descuentosDuracion";
import { supabase } from "@/lib/supabase";

const DARK_BLUE = "#163a6b";
const STORAGE_BUCKET = "Documentos";

const VERTICALS = [
  { id: "alojamiento", label: "Alojamiento" },
  { id: "ninos", label: "Cuidado de niños" },
  { id: "mascotas", label: "Cuidado de mascotas" },
];

const CANCEL_POLICIES = [
  { value: "flexible", label: "Flexible" },
  { value: "moderada", label: "Moderada" },
  { value: "estricta", label: "Estricta" },
];

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

const TIPO_ALOJAMIENTO_OPTIONS = [
  { value: "completo", label: "Alojamiento completo — piso o casa entera" },
  { value: "habitacion_privada", label: "Habitación privada" },
  { value: "habitacion_compartida", label: "Habitación compartida" },
  { value: "habitacion_hotel", label: "Habitación de hotel" },
  { value: "otros", label: "Otros" },
];

const ESTANCIA_PLACEHOLDERS = {
  alojamiento: { min: "Mínimo de noches", max: "Máximo de noches" },
  ninos: { min: "Mínimo de horas", max: "Máximo de horas" },
  mascotas: { min: "Mínimo de días", max: "Máximo de días" },
};

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function emptyServiceDetails() {
  return {
    titulo: "",
    precio: "",
    tipo_alojamiento: "",
    modalidad: "domicilio_cliente",
    estancia_minima: "",
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
  };
}

function mapServiceFromDb(row) {
  const tiers = normalizeDescuentosDuracion(row.descuentos_duracion);
  return {
    id: row.id,
    vertical: row.vertical,
    disponible: row.disponible !== false,
    isNew: false,
    details: {
      ...emptyServiceDetails(),
      titulo: row.titulo || "",
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
    },
  };
}

function buildServicePayload(details, vertical, ciudad, proveedorId, disponible) {
  return {
    proveedor_id: proveedorId,
    vertical,
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
    ciudad: ciudad.trim(),
    disponible,
    reserva_inmediata: details.reserva_inmediata === true,
    modalidad: vertical === "alojamiento" ? null : details.modalidad || null,
    tipo_alojamiento:
      vertical === "alojamiento" ? details.tipo_alojamiento || null : null,
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
      (vertical === "ninos" || vertical === "mascotas") &&
      details.disponible_para_viajar === true,
    descuentos_duracion: serializeDescuentosDuracionForDb(details),
    // -- ALTER TABLE services ADD COLUMN IF NOT EXISTS proveedor_emergencia boolean DEFAULT false;
    proveedor_emergencia: details.proveedor_emergencia === true,
  };
}

async function uploadProfilePhoto(userId, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filePath = `${userId}/foto-perfil-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
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

function OfertaEspecialFields({ serviceId, details, onChange }) {
  const enabled = details.oferta_activa === true;
  const showViajar = serviceId === "ninos" || serviceId === "mascotas";

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
          {showViajar && (
            <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
              style={{ borderColor: BRAND.border }}
            >
              <p className="text-sm font-semibold text-[#1a1a1a]">
                Disponible para viajar
              </p>
              <button
                type="button"
                role="switch"
                aria-checked={details.disponible_para_viajar === true}
                onClick={() =>
                  update("disponible_para_viajar", !details.disponible_para_viajar)
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
          )}
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

function ServiceEditForm({ vertical, details, onChange }) {
  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  const placeholders = ESTANCIA_PLACEHOLDERS[vertical];
  const dias =
    Array.isArray(details.dias_disponibles) && details.dias_disponibles.length > 0
      ? details.dias_disponibles
      : DIAS_DISPONIBLES_DEFAULT;

  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Título del servicio
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
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Precio (€)
          {vertical === "alojamiento"
            ? " / noche"
            : vertical === "ninos"
              ? " / hora"
              : " / día"}
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
      {vertical === "alojamiento" ? (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-medium text-[#444]">Tipo de alojamiento</p>
          <div className="flex flex-col gap-2">
            {TIPO_ALOJAMIENTO_OPTIONS.map((option) => {
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
          <p className="mb-2 text-xs font-medium text-[#444]">Modalidad de servicio</p>
          <div className="flex flex-col gap-2">
            {[
              { value: "domicilio_cliente", label: "En domicilio del cliente" },
              {
                value: "domicilio_proveedor",
                label: "En mi domicilio",
              },
              { value: "ambas", label: "Ambas opciones disponibles" },
            ].map((option) => {
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
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Antelación mínima para reservar
        </label>
        <select
          value={String(details.antelacion_minima ?? 24)}
          onChange={(e) => update("antelacion_minima", Number(e.target.value))}
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
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium text-[#444]">Días disponibles</p>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((dia) => {
            const isSelected = dias.includes(dia.id);
            return (
              <button
                key={dia.id}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? dias.filter((d) => d !== dia.id)
                    : [...dias, dia.id];
                  update("dias_disponibles", next.length > 0 ? next : []);
                }}
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
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Política de cancelación
        </label>
        <select
          value={details.cancelacion}
          onChange={(e) => update("cancelacion", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        >
          {CANCEL_POLICIES.map((policy) => (
            <option key={policy.value} value={policy.value}>
              {policy.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium text-[#444]">Tipo de reserva</p>
        <div className="flex flex-col gap-2">
          {[
            { value: false, title: "Con confirmación", sub: "Tú aceptas o rechazas" },
            { value: true, title: "Reserva inmediata", sub: "Reserva directa" },
          ].map((option) => {
            const selected = details.reserva_inmediata === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => update("reserva_inmediata", option.value)}
                className="rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: selected ? BRAND.primary : BRAND.border,
                  backgroundColor: selected ? BRAND.light : "#fff",
                }}
              >
                <span className="text-sm font-semibold text-[#1a1a1a]">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs text-[#666]">{option.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
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
  );
}

export default function EditarPerfilPage() {
  const router = useRouter();
  const profilePhotoRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [descripcion, setDescripcion] = useState("");
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
        setDescripcion(perfilData.descripcion || "");
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

      setLoading(false);
    }

    load();
  }, [router]);

  function updateServiceDetails(serviceId, details) {
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, details } : s)),
    );
  }

  function toggleServiceDisponible(serviceId) {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, disponible: !s.disponible } : s,
      ),
    );
  }

  function handleProfilePhotoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
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

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        ciudad: ciudad.trim(),
        descripcion: descripcion.trim(),
        location_zone: ciudad.trim(),
        foto_perfil: fotoUrl,
      });

      if (profileError) throw profileError;

      for (const service of services) {
        const payload = buildServicePayload(
          service.details,
          service.vertical,
          ciudad,
          userId,
          service.disponible,
        );

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

      if (addingService && newServiceDetails.titulo.trim()) {
        const payload = buildServicePayload(
          newServiceDetails,
          newVertical,
          ciudad,
          userId,
          true,
        );
        const { data, error } = await supabase
          .from("services")
          .insert(payload)
          .select("*")
          .single();
        if (error) throw error;
        setServices((prev) => [...prev, mapServiceFromDb(data)]);
        setAddingService(false);
        setNewServiceDetails(emptyServiceDetails());
      }

      setFotoPerfil(fotoUrl);
      setProfilePhotoFile(null);
      setSuccessMessage("Perfil actualizado correctamente");
      setEditingId(null);
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar los cambios.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando perfil…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <header
        className="sticky top-0 z-50 px-4 py-5 text-white sm:px-6"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">Editar perfil</h1>
            <p
              className="mt-1 text-sm"
              style={{ color: "rgba(255, 255, 255, 0.75)" }}
            >
              Actualiza tus datos y servicios
            </p>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-sm text-white/90 no-underline hover:text-white"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-10"
      >
        <section
          className="border-b pb-10"
          style={{ borderColor: BRAND.border }}
        >
          <SectionLabel number="01" title="Datos personales" />
          <h2
            className="mt-3 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Tu información pública
          </h2>

          <input
            ref={profilePhotoRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={handleProfilePhotoChange}
          />
          <div className="mt-5 flex items-center gap-4">
            {fotoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={fotoPreview}
                alt="Foto de perfil"
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-20 w-20 items-center justify-center rounded-full text-2xl text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                ?
              </div>
            )}
            <button
              type="button"
              onClick={() => profilePhotoRef.current?.click()}
              className="rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-white"
              style={{ borderColor: BRAND.border }}
            >
              Cambiar foto
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">
                Nombre
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">
                Apellido
              </label>
              <input
                type="text"
                required
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Ciudad
            </label>
            <input
              type="text"
              required
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              Descripción
            </label>
            <textarea
              rows={5}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Cuéntanos quién eres, tu experiencia y por qué las familias pueden confiar en ti..."
              className={`${inputClass} resize-y`}
              style={{ borderColor: BRAND.border }}
            />
          </div>
        </section>

        <section className="py-10">
          <SectionLabel number="02" title="Mis servicios" />
          <h2
            className="mt-3 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF }}
          >
            Gestiona tus servicios
          </h2>

          <ul className="mt-5 flex flex-col gap-4">
            {services.map((service) => {
              const verticalLabel =
                VERTICALS.find((v) => v.id === service.vertical)?.label ||
                service.vertical;
              const isEditing = editingId === service.id;

              return (
                <li
                  key={service.id}
                  className="rounded-2xl border bg-white p-5"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: BRAND.primary }}
                      >
                        {verticalLabel}
                      </p>
                      <p className="mt-1 font-medium text-[#1a1a1a]">
                        {service.details.titulo || "Sin título"}
                      </p>
                      <span
                        className="mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                        style={{
                          backgroundColor: service.disponible
                            ? "#dcfce7"
                            : "#f3f4f6",
                          color: service.disponible ? "#166534" : "#6b7280",
                        }}
                      >
                        {service.disponible ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingId(isEditing ? null : service.id)
                        }
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#f7f7f7]"
                        style={{ borderColor: BRAND.border, color: BRAND.primary }}
                      >
                        {isEditing ? "Cerrar" : "Editar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleServiceDisponible(service.id)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#444] transition-colors hover:bg-[#f7f7f7]"
                        style={{ borderColor: BRAND.border }}
                      >
                        {service.disponible ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </div>

                  {isEditing && (
                    <ServiceEditForm
                      vertical={service.vertical}
                      details={service.details}
                      onChange={(details) =>
                        updateServiceDetails(service.id, details)
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {addingService ? (
            <div
              className="mt-4 rounded-2xl border bg-white p-5"
              style={{ borderColor: BRAND.border }}
            >
              <p className="text-sm font-semibold text-[#1a1a1a]">
                Nuevo servicio
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {VERTICALS.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setNewVertical(v.id);
                      setNewServiceDetails(emptyServiceDetails());
                    }}
                    className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      borderColor:
                        newVertical === v.id ? BRAND.primary : BRAND.border,
                      backgroundColor:
                        newVertical === v.id ? BRAND.light : "#fff",
                      color: newVertical === v.id ? DARK_BLUE : "#444",
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <ServiceEditForm
                vertical={newVertical}
                details={newServiceDetails}
                onChange={setNewServiceDetails}
              />
              <button
                type="button"
                onClick={() => {
                  setAddingService(false);
                  setNewServiceDetails(emptyServiceDetails());
                }}
                className="mt-4 text-sm text-[#666] hover:underline"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingService(true)}
              className="mt-4 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ color: BRAND.primary }}
            >
              + Añadir nuevo servicio
            </button>
          )}
        </section>

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
          disabled={submitting}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: BRAND.primary }}
        >
          {submitting ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>
    </div>
  );
}
