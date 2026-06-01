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
  { value: "24h", label: "Cancelación gratuita hasta 24h antes" },
  { value: "48h", label: "Hasta 48h antes" },
  { value: "7d", label: "Hasta 7 días antes" },
  { value: "none", label: "Sin cancelación" },
];

const EMPTY_SERVICE_DETAILS = {
  alojamiento: { precio: "", nru: "", cancelacion: "48h", reserva_inmediata: false },
  ninos: { precio: "", edades: "", certificacion: "", cancelacion: "48h", reserva_inmediata: false },
  mascotas: { precio: "", tipos: "", cancelacion: "48h", reserva_inmediata: false },
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
          {policy.label}
        </option>
      ))}
    </select>
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

function ServiceFields({ serviceId, details, onChange }) {
  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  if (serviceId === "alojamiento") {
    return (
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
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

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      role: "proveedor",
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      ciudad: ciudad.trim(),
      descripcion: sobreTi.trim(),
      location_zone: ciudad.trim(),
      idiomas: selectedLanguages,
    });

    if (profileError) {
      setSubmitting(false);
      setErrorMessage(profileError.message);
      return;
    }

    if (selectedServices.length > 0) {
      const serviceRows = selectedServices.map((serviceId) => {
        const details = serviceDetails[serviceId];
        const titulos = {
          alojamiento: `Alojamiento en ${ciudad.trim()}`,
          ninos: `Cuidado de niños en ${ciudad.trim()}`,
          mascotas: `Cuidado de mascotas en ${ciudad.trim()}`,
        };
        return {
          proveedor_id: user.id,
          vertical: serviceId,
          titulo: titulos[serviceId],
          precio: details.precio ? Number(details.precio) : null,
          cancellation_policy: details.cancelacion,
          ciudad: ciudad.trim(),
          disponible: true,
          reserva_inmediata: details.reserva_inmediata === true,
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
