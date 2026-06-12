"use client";

import { useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BRAND, SERIF } from "@/app/components/brand";
import { serializeDescuentosDuracionForDb } from "@/app/lib/descuentosDuracion";
import { AMENITIES_GROUPS } from "@/app/lib/amenities";

const PRIMARY = "#1d4f91";
const DARK_BLUE = "#163a6b";
const GREEN = "#0e7a5c";
const ORANGE = "#c47d1a";

const DIAS_SEMANA = [
  { id: "lun", label: "L" },
  { id: "mar", label: "M" },
  { id: "mie", label: "X" },
  { id: "jue", label: "J" },
  { id: "vie", label: "V" },
  { id: "sab", label: "S" },
  { id: "dom", label: "D" },
];

const DIAS_DISPONIBLES_DEFAULT = DIAS_SEMANA.map((d) => d.id);

const IDIOMAS_DEFAULT = [
  "Español",
  "English",
  "Français",
  "Deutsch",
  "Italiano",
  "Português",
  "中文",
];

const VERTICALES_CARDS = [
  {
    id: "alojamiento",
    nombre: "Alojamiento",
    color: PRIMARY,
    icono: "🏠",
    subtitulo: "Hospeda familias en tu espacio",
    precioRef: "desde 45€/noche",
    beneficios: [
      "Tú pones el precio y las normas",
      "Pagos seguros con Stripe",
      "Sin comisión los primeros 3 meses",
    ],
  },
  {
    id: "ninos",
    nombre: "Niñera",
    color: GREEN,
    icono: "🧒",
    subtitulo: "Cuidado infantil de confianza",
    precioRef: "desde 12€/hora",
    beneficios: [
      "Horarios flexibles",
      "Referencias verificadas",
      "Familias de tu zona",
    ],
  },
  {
    id: "mascotas",
    nombre: "Mascotas",
    color: ORANGE,
    icono: "🐾",
    subtitulo: "Cuidado y compañía animal",
    precioRef: "desde 18€/día",
    beneficios: [
      "Mascotas de todos los tamaños",
      "Actualizaciones en tiempo real",
      "Seguro de responsabilidad",
    ],
  },
];

const TIPO_ALOJAMIENTO_OPTIONS = [
  { value: "completo", label: "Entero", desc: "Piso o casa completa" },
  { value: "habitacion_privada", label: "Hab. privada", desc: "Habitación propia" },
  { value: "habitacion_compartida", label: "Compartida", desc: "Compartes habitación" },
  { value: "habitacion_hotel", label: "Hotel", desc: "Habitación de hotel" },
  { value: "otros", label: "Otro", desc: "Otro tipo de alojamiento" },
];

const EDADES_TAGS = ["0-1", "1-3", "3-6", "6-12", "12+"];
const FORMACION_TAGS = [
  "Educación infantil",
  "Primeros auxilios",
  "Enfermería",
  "Magisterio",
  "Monitor ocio",
];
const ACTIVIDADES_TAGS = [
  "Lectura",
  "Manualidades",
  "Música",
  "Naturaleza",
  "Cocina",
  "Deporte",
  "Juegos",
  "Tecnología",
  "Idiomas",
  "Teatro",
  "Mindfulness",
];
const ANIMALES_TAGS = [
  "Perros",
  "Gatos",
  "Conejos",
  "Aves",
  "Roedores",
  "Peces",
  "Reptiles",
];
const TAMANO_PERRO_TAGS = ["Pequeño", "Mediano", "Grande", "Cualquier tamaño"];
const CERT_MASCOTAS_TAGS = [
  "Adiestrador",
  "Auxiliar vet.",
  "Primeros auxilios animal",
  "Etología",
];

const MODALIDAD_OPTIONS = {
  ninos: [
    { value: "domicilio_cliente", label: "En domicilio del cliente" },
    { value: "domicilio_proveedor", label: "En mi domicilio" },
    { value: "ambas", label: "Ambas opciones" },
  ],
  mascotas: [
    { value: "domicilio_cliente", label: "En domicilio del cliente" },
    { value: "domicilio_proveedor", label: "En mi domicilio" },
    { value: "ambas", label: "Ambas opciones" },
  ],
};

const DOCUMENT_CATALOG = {
  dni_propietario: { title: "DNI o pasaporte", required: true },
  nru: { title: "NRU", required: true },
  dni_nie: { title: "DNI / NIE / Pasaporte", required: true },
  certificado_antecedentes: { title: "Antecedentes penales", required: true },
  certificado_delitos_sexuales: {
    title: "Antecedentes sexuales",
    required: true,
  },
  seguro_hogar: { title: "Seguro del hogar", required: false },
  primeros_auxilios: { title: "Primeros auxilios", required: false },
  titulaciones: { title: "Titulaciones", required: false },
  certificaciones: { title: "Certificaciones", required: false },
};

const DOC_PROFILE_FIELDS = {
  dni_propietario: "doc_dni_url",
  dni_nie: "doc_dni_url",
  certificado_antecedentes: "doc_antecedentes_url",
  certificado_delitos_sexuales: "doc_antecedentes_sexuales_url",
};

const STORAGE_BUCKET = "Documentos";

const EMPTY_SERVICE_DETAILS = {
  alojamiento: {
    titulo: "",
    descripcion_anuncio: "",
    descripcion: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    tipo_alojamiento: "",
    precio: "",
    estancia_minima: "",
    estancia_maxima: "",
    nru: "",
    cancelacion: "moderada",
    reserva_inmediata: false,
    antelacion_minima: 24,
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    capacidad: { personas: 2, habitaciones: 1, camas: 1, banos: 1 },
    amenities: [],
    direccion_exacta: "",
    telefono_contacto: "",
    normas: { petFriendly: false, bebes: false, fumar: false, fiestas: false },
    check_in: "15:00",
    check_out: "11:00",
    disponible_para_viajar: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
    proveedor_emergencia: false,
  },
  ninos: {
    titulo: "",
    descripcion_anuncio: "",
    descripcion: "",
    anos_experiencia: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    precio: "",
    modalidad: "domicilio_cliente",
    direccion_exacta: "",
    telefono_contacto: "",
    edadesTags: [],
    formacionTags: [],
    actividadesTags: [],
    dias_disponibles: [...DIAS_DISPONIBLES_DEFAULT],
    disponible_para_viajar: false,
    nochesFinde: false,
    carnetConducir: false,
    cancelacion: "moderada",
    reserva_inmediata: false,
    antelacion_minima: 24,
    estancia_minima: "",
    estancia_maxima: "",
    proveedor_emergencia: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
  },
  mascotas: {
    titulo: "",
    descripcion_anuncio: "",
    descripcion: "",
    anos_experiencia: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    precio: "0",
    modalidad: "domicilio_cliente",
    direccion_exacta: "",
    telefono_contacto: "",
    animalesTags: [],
    tamanoPerro: "",
    certificacionesTags: [],
    jardin: false,
    paseosIncluidos: false,
    fotosActualizaciones: false,
    cercaVeterinario: false,
    disponible_para_viajar: false,
    cancelacion: "moderada",
    reserva_inmediata: false,
    antelacion_minima: 24,
    estancia_minima: "",
    estancia_maxima: "",
    proveedor_emergencia: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
  },
};

function getVisibleSteps(verticales) {
  const steps = [
    { id: 1, key: "servicios", label: "Servicios" },
    { id: 2, key: "perfil", label: "Tu perfil" },
  ];
  if (verticales.includes("alojamiento"))
    steps.push({ id: 3, key: "alojamiento", label: "🏠 Alojamiento" });
  if (verticales.includes("ninos"))
    steps.push({ id: 4, key: "ninos", label: "🧒 Niñera" });
  if (verticales.includes("mascotas"))
    steps.push({ id: 5, key: "mascotas", label: "🐾 Mascotas" });
  steps.push({ id: 6, key: "documentos", label: "Documentos" });
  steps.push({ id: 7, key: "revision", label: "Revisión" });
  return steps;
}

function getDocsForVertical(vertical) {
  if (vertical === "alojamiento") return ["nru", "seguro_hogar"];
  if (vertical === "ninos")
    return [
      "certificado_antecedentes",
      "certificado_delitos_sexuales",
      "primeros_auxilios",
      "titulaciones",
    ];
  if (vertical === "mascotas")
    return ["certificado_antecedentes", "certificaciones"];
  return [];
}

function getRequiredDocuments(verticales) {
  const docs = [];
  const added = new Set();
  const add = (id) => {
    if (!added.has(id) && DOCUMENT_CATALOG[id]) {
      added.add(id);
      docs.push({ id, ...DOCUMENT_CATALOG[id] });
    }
  };
  if (verticales.length > 0) add("dni_nie");
  if (verticales.includes("alojamiento")) add("nru");
  if (verticales.includes("ninos")) {
    add("certificado_antecedentes");
    add("certificado_delitos_sexuales");
    add("primeros_auxilios");
    add("titulaciones");
  }
  if (verticales.includes("mascotas")) {
    add("certificado_antecedentes");
    add("certificaciones");
  }
  if (verticales.includes("alojamiento")) add("seguro_hogar");
  return docs;
}

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

async function geocodificarDireccion(direccion) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(direccion)}.json?access_token=${token}&limit=1`,
  );
  const data = await res.json();
  if (data.features?.[0]) {
    return {
      lat: data.features[0].center[1],
      lng: data.features[0].center[0],
    };
  }
  return null;
}

function needsDireccionFields(vertical, modalidad) {
  if (vertical === "alojamiento") return true;
  if (vertical === "ninos" && modalidad === "domicilio_proveedor") return true;
  if (vertical === "mascotas" && modalidad === "domicilio_proveedor") return true;
  return false;
}

async function getServiceLocationFields(details, vertical) {
  if (!needsDireccionFields(vertical, details.modalidad)) {
    return {
      direccion_exacta: null,
      telefono_contacto: null,
      location_lat: null,
      location_lng: null,
    };
  }
  const direccion_exacta = details.direccion_exacta?.trim() || null;
  const telefono_contacto = details.telefono_contacto?.trim() || null;
  let location_lat = null;
  let location_lng = null;
  if (direccion_exacta) {
    const coords = await geocodificarDireccion(direccion_exacta);
    if (coords) {
      location_lat = coords.lat;
      location_lng = coords.lng;
    }
  }
  return { direccion_exacta, telefono_contacto, location_lat, location_lng };
}

function DireccionContactoFields({ d, upd, vertical }) {
  if (!needsDireccionFields(vertical, d.modalidad)) return null;
  return (
    <>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">Dirección exacta</label>
        <input
          type="text"
          value={d.direccion_exacta || ""}
          onChange={(e) => upd("direccion_exacta", e.target.value)}
          placeholder="Calle, número, piso, ciudad, código postal"
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e8e4de",
            fontSize: 13,
          }}
        />
        <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
          Esta dirección solo se compartirá con el cliente tras confirmar la reserva
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Teléfono de contacto para este servicio
        </label>
        <input
          type="tel"
          value={d.telefono_contacto || ""}
          onChange={(e) => upd("telefono_contacto", e.target.value)}
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
    </>
  );
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

async function uploadDocumentToStorage(userId, docId, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "pdf";
  const filePath = `${userId}/${docId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadProfilePhoto(userId, file) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filePath = `profiles/foto/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadServicePhoto(userId, vertical, file, index) {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const filePath = `${userId}/service-${vertical}-${index}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";


function TagPill({ label, selected, onClick, color = PRIMARY }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        borderColor: selected ? color : BRAND.border,
        backgroundColor: selected ? `${color}14` : "#fff",
        color: selected ? color : "#666",
      }}
    >
      {label}
    </button>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-[#444]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? PRIMARY : "#d1d5db" }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
          style={{ left: checked ? "calc(100% - 1.625rem)" : "0.125rem" }}
        />
      </button>
    </div>
  );
}

function CounterField({ label, value, onChange, min = 0 }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: BRAND.border }}>
      <p className="text-xs text-[#666]">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg"
          style={{ borderColor: BRAND.border }}
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg"
          style={{ borderColor: BRAND.border }}
        >
          +
        </button>
      </div>
    </div>
  );
}

function StepBar({ steps, pasoActual }) {
  const currentIdx = steps.findIndex((s) => s.id === pasoActual);
  return (
    <div
      className="flex gap-0 overflow-x-auto border-b"
      style={{ borderColor: BRAND.border }}
    >
      {steps.map((step, idx) => {
        const isActive = step.id === pasoActual;
        const isCompleted = idx < currentIdx;
        return (
          <div
            key={step.id}
            className="flex shrink-0 items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap"
            style={{
              borderBottom: isActive || isCompleted ? `2px solid ${PRIMARY}` : "2px solid transparent",
              color: PRIMARY,
              opacity: isActive ? 1 : isCompleted ? 0.7 : 0.45,
            }}
          >
            {isCompleted && (
              <span className="text-green-600" aria-hidden>
                ✓
              </span>
            )}
            {step.label}
          </div>
        );
      })}
    </div>
  );
}

function DocUploadRow({ docId, title, required, file, onUpload }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ borderColor: BRAND.border }}
    >
      <div>
        <p className="text-sm font-medium text-[#1a1a1a]">
          {title}
          {!required && (
            <span className="ml-1 text-xs font-normal text-[#888]">(opcional)</span>
          )}
        </p>
        <p className="text-xs" style={{ color: file ? GREEN : required ? ORANGE : "#888" }}>
          {file ? "✓ Subido" : required ? "⚠️ Pendiente" : "Opcional"}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onUpload(docId)}
        className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold"
        style={{ borderColor: PRIMARY, color: PRIMARY }}
      >
        {file ? "Cambiar" : "Subir"}
      </button>
    </div>
  );
}

function PhotoUploadGrid({ previews, onAdd, onRemove, multiple = true, label }) {
  return (
    <div>
      {label && <p className="mb-2 text-xs font-medium text-[#444]">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div key={i} className="relative h-24 w-24 overflow-hidden rounded-xl border" style={{ borderColor: BRAND.border }}>
            <img src={src} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
            >
              ×
            </button>
          </div>
        ))}
        {(multiple || previews.length === 0) && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-dashed text-xs text-[#888]"
            style={{ borderColor: BRAND.border }}
          >
            <span className="text-2xl">+</span>
            Foto
          </button>
        )}
      </div>
    </div>
  );
}

function PreviewPanel({
  profilePhotoPreview,
  nombre,
  apellido,
  ciudad,
  verticales,
  serviceDetails,
  idiomas,
}) {
  const displayName = [nombre, apellido].filter(Boolean).join(" ") || "Tu nombre";
  const badges = VERTICALES_CARDS.filter((v) => verticales.includes(v.id));
  const firstPrice = verticales.includes("alojamiento")
    ? serviceDetails.alojamiento.precio
    : verticales.includes("ninos")
      ? serviceDetails.ninos.precio
      : verticales.includes("mascotas")
        ? serviceDetails.mascotas.precio
        : null;
  const priceUnit = verticales.includes("alojamiento")
    ? "/noche"
    : verticales.includes("ninos")
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
          {profilePhotoPreview ? (
            <img src={profilePhotoPreview} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-4xl text-[#ccc]">👤</span>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-semibold text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {displayName}
          </h3>
          {ciudad && <p className="text-xs text-[#666]">{ciudad}</p>}
          {badges.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {badges.map((b) => (
                <span
                  key={b.id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                  style={{ backgroundColor: b.color }}
                >
                  {b.nombre}
                </span>
              ))}
            </div>
          )}
          {idiomas.length > 0 && (
            <p className="mt-2 text-xs text-[#888]">{idiomas.slice(0, 3).join(" · ")}</p>
          )}
          {firstPrice && (
            <p className="mt-2 text-lg font-bold" style={{ color: PRIMARY }}>
              {firstPrice}€
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

function calcCompletion(verticales, fields, documentFiles) {
  let total = 0;
  let done = 0;
  const check = (ok) => {
    total++;
    if (ok) done++;
  };
  check(verticales.length > 0);
  check(fields.nombre.trim() && fields.apellido.trim() && fields.ciudad.trim());
  check(fields.sobreTi.trim());
  if (verticales.includes("alojamiento")) {
    const d = fields.serviceDetails.alojamiento;
    check(d.titulo.trim() && d.precio && d.tipo_alojamiento);
  }
  if (verticales.includes("ninos")) {
    const d = fields.serviceDetails.ninos;
    check(d.titulo.trim() && d.precio);
  }
  if (verticales.includes("mascotas")) {
    const d = fields.serviceDetails.mascotas;
    check(d.titulo.trim() && d.precio);
  }
  getRequiredDocuments(verticales)
    .filter((d) => d.required)
    .forEach((d) => {
      if (d.id === "dni_nie") {
        check(!!documentFiles.dni_nie || !!documentFiles.dni_propietario);
      } else {
        check(!!documentFiles[d.id]);
      }
    });
  return total > 0 ? Math.round((done / total) * 100) : 0;
}


export default function SerProveedorPage() {
  const router = useRouter();
  const profilePhotoRef = useRef(null);
  const servicePhotoRefs = useRef({ alojamiento: null, ninos: null, mascotas: null });
  const documentInputRef = useRef(null);
  const activePhotoVerticalRef = useRef(null);

  const [pasoActual, setPasoActual] = useState(1);
  const [verticalesSeleccionados, setVerticalesSeleccionados] = useState([]);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [anosExperiencia, setAnosExperiencia] = useState("");
  const [sobreTi, setSobreTi] = useState("");
  const [personalidad, setPersonalidad] = useState("");
  const [motivacion, setMotivacion] = useState("");
  const [idiomas, setIdiomas] = useState([]);
  const [customIdiomas, setCustomIdiomas] = useState([]);
  const [serviceDetails, setServiceDetails] = useState(EMPTY_SERVICE_DETAILS);
  const [servicePhotos, setServicePhotos] = useState({ alojamiento: [], ninos: [], mascotas: [] });
  const [servicePhotoPreviews, setServicePhotoPreviews] = useState({
    alojamiento: [],
    ninos: [],
    mascotas: [],
  });
  const [documentFiles, setDocumentFiles] = useState({});
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [customTags, setCustomTags] = useState({
    formacion: [],
    actividades: [],
    animales: [],
    certMascotas: [],
  });

  const visibleSteps = useMemo(
    () => getVisibleSteps(verticalesSeleccionados),
    [verticalesSeleccionados],
  );
  const requiredDocuments = useMemo(
    () => getRequiredDocuments(verticalesSeleccionados),
    [verticalesSeleccionados],
  );
  const completionPct = calcCompletion(verticalesSeleccionados, {
    nombre,
    apellido,
    ciudad,
    sobreTi,
    serviceDetails,
  }, documentFiles);

  const allIdiomas = [...IDIOMAS_DEFAULT, ...customIdiomas];

  function toggleVertical(id) {
    setVerticalesSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }

  function toggleIdioma(lang) {
    setIdiomas((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  }

  function addCustomIdioma() {
    const val = window.prompt("Añadir idioma:");
    if (val?.trim() && !allIdiomas.includes(val.trim())) {
      setCustomIdiomas((prev) => [...prev, val.trim()]);
      setIdiomas((prev) => [...prev, val.trim()]);
    }
  }

  function updateServiceDetails(vertical, details) {
    setServiceDetails((prev) => ({ ...prev, [vertical]: details }));
  }

  function toggleTag(vertical, field, tag) {
    const d = serviceDetails[vertical];
    const arr = d[field] || [];
    const next = arr.includes(tag) ? arr.filter((t) => t !== tag) : [...arr, tag];
    updateServiceDetails(vertical, { ...d, [field]: next });
  }

  function addCustomTag(vertical, field, customKey) {
    const val = window.prompt("Añadir:");
    if (!val?.trim()) return;
    setCustomTags((prev) => ({
      ...prev,
      [customKey]: [...(prev[customKey] || []), val.trim()],
    }));
    const d = serviceDetails[vertical];
    updateServiceDetails(vertical, {
      ...d,
      [field]: [...(d[field] || []), val.trim()],
    });
  }

  function handleProfilePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
  }

  function openServicePhotoUpload(vertical) {
    activePhotoVerticalRef.current = vertical;
    servicePhotoRefs.current[vertical]?.click();
  }

  function handleServicePhotos(e) {
    const vertical = activePhotoVerticalRef.current;
    if (!vertical) return;
    const files = Array.from(e.target.files ?? []);
    const max = vertical === "alojamiento" ? 8 : 6;
    const remaining = max - servicePhotos[vertical].length;
    const toAdd = files.slice(0, remaining);
    if (toAdd.length === 0) return;
    setServicePhotos((prev) => ({
      ...prev,
      [vertical]: [...prev[vertical], ...toAdd],
    }));
    setServicePhotoPreviews((prev) => ({
      ...prev,
      [vertical]: [...prev[vertical], ...toAdd.map((f) => URL.createObjectURL(f))],
    }));
    e.target.value = "";
  }

  function removeServicePhoto(vertical, index) {
    setServicePhotos((prev) => ({
      ...prev,
      [vertical]: prev[vertical].filter((_, i) => i !== index),
    }));
    setServicePhotoPreviews((prev) => ({
      ...prev,
      [vertical]: prev[vertical].filter((_, i) => i !== index),
    }));
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

  function validateStep(stepId) {
    setErrorMessage("");
    if (stepId === 1) {
      if (verticalesSeleccionados.length === 0) {
        setErrorMessage("Selecciona al menos un servicio.");
        return false;
      }
    }
    if (stepId === 2) {
      if (!nombre.trim() || !apellido.trim() || !ciudad.trim()) {
        setErrorMessage("Completa nombre, apellidos y ciudad.");
        return false;
      }
      if (!sobreTi.trim()) {
        setErrorMessage("Cuéntanos por qué deberían elegirte.");
        return false;
      }
    }
    if (stepId === 3) {
      const d = serviceDetails.alojamiento;
      if (!d.titulo.trim() || !d.precio || !d.tipo_alojamiento) {
        setErrorMessage("Completa título, precio y tipo de alojamiento.");
        return false;
      }
      if (!d.nru?.trim()) {
        setErrorMessage("El NRU es obligatorio para alojamiento.");
        return false;
      }
    }
    if (stepId === 4) {
      const d = serviceDetails.ninos;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de niñera.");
        return false;
      }
    }
    if (stepId === 5) {
      const d = serviceDetails.mascotas;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de mascotas.");
        return false;
      }
    }
    if (stepId === 6) {
      const missing = requiredDocuments.filter((d) => {
        if (!d.required) return false;
        if (d.id === "dni_nie") {
          return !documentFiles.dni_nie && !documentFiles.dni_propietario;
        }
        return !documentFiles[d.id];
      });
      if (missing.length > 0) {
        setErrorMessage(`Faltan documentos obligatorios: ${missing.map((d) => d.title).join(", ")}`);
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(pasoActual)) return;
    const idx = visibleSteps.findIndex((s) => s.id === pasoActual);
    if (idx < visibleSteps.length - 1) setPasoActual(visibleSteps[idx + 1].id);
  }

  function goBack() {
    const idx = visibleSteps.findIndex((s) => s.id === pasoActual);
    if (idx > 0) setPasoActual(visibleSteps[idx - 1].id);
  }

  async function handleSubmit() {
    setLoading(true);
    setErrorMessage("");
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        setErrorMessage("No hay sesión activa. Por favor inicia sesión.");
        setLoading(false);
        return;
      }
      console.log("Usuario:", user.id);

      const descripcionParts = [sobreTi.trim()];
      if (personalidad.trim()) descripcionParts.push(`Personalidad: ${personalidad.trim()}`);
      if (motivacion.trim()) descripcionParts.push(`Motivación: ${motivacion.trim()}`);
      if (anosExperiencia.trim())
        descripcionParts.push(`Experiencia: ${anosExperiencia.trim()} años`);

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        ciudad: ciudad.trim(),
        descripcion: descripcionParts.join("\n\n"),
        idiomas,
        role: "proveedor",
      });

      if (profileError) {
        console.error("Error perfil:", profileError);
        setErrorMessage("Error al guardar perfil: " + profileError.message);
        setLoading(false);
        return;
      }
      console.log("Perfil guardado");

      for (const vertical of verticalesSeleccionados) {
        const servicioData =
          vertical === "alojamiento"
            ? serviceDetails.alojamiento
            : vertical === "ninos"
              ? serviceDetails.ninos
              : serviceDetails.mascotas;

        const locationFields = await getServiceLocationFields(servicioData, vertical);

        const { data: nuevoServicio, error: serviceError } = await supabase
          .from("services")
          .insert({
            proveedor_id: user.id,
            vertical,
            titulo: servicioData.titulo || `Servicio de ${vertical}`,
            descripcion_anuncio: servicioData.descripcion_anuncio?.trim() || null,
            precio: Number(servicioData.precio) || 0,
            ciudad: ciudad.trim(),
            disponible: false,
            amenities: servicioData.amenities || [],
            ...locationFields,
          })
          .select("id")
          .single();

        if (serviceError) {
          console.error("Error servicio:", serviceError);
          setErrorMessage("Error al guardar servicio: " + serviceError.message);
          setLoading(false);
          return;
        }

        if (vertical === "alojamiento" && servicePhotos.alojamiento?.length > 0) {
          let firstPhotoUrl = null;
          for (let i = 0; i < servicePhotos.alojamiento.length; i++) {
            const photoUrl = await uploadServicePhoto(
              user.id,
              "alojamiento",
              servicePhotos.alojamiento[i],
              i,
            );
            if (i === 0) firstPhotoUrl = photoUrl;
          }
          if (firstPhotoUrl) {
            await supabase
              .from("services")
              .update({ foto_url: firstPhotoUrl })
              .eq("id", nuevoServicio.id);
          }
        }

        console.log("Servicio guardado:", vertical);
      }

      await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "nuevo_proveedor",
          nombre: nombre.trim(),
          email: user.email,
          verticales: verticalesSeleccionados,
        }),
      });

      setPasoActual(8);
    } catch (err) {
      console.error("Error inesperado:", err);
      setErrorMessage("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  const renderStep = () => {
    if (pasoActual === 1) {
      return (
        <div>
          <div
            className="mb-8 rounded-2xl p-6 text-white"
            style={{ background: `linear-gradient(135deg, ${PRIMARY} 0%, ${DARK_BLUE} 100%)` }}
          >
            <h2 className="text-xl font-semibold" style={{ fontFamily: SERIF }}>
              Empieza a ganar con lo que ya sabes hacer
            </h2>
            <div className="mt-4 flex flex-wrap gap-6 text-sm" style={{ opacity: 0.9 }}>
              <span>340+ proveedores</span>
              <span>1.200+ reservas</span>
              <span>3 meses sin comisión</span>
            </div>
          </div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            ¿Qué servicios ofreces?
          </h2>
          <p className="mt-1 text-sm text-[#666]">Puedes seleccionar más de uno</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {VERTICALES_CARDS.map((v) => {
              const selected = verticalesSeleccionados.includes(v.id);
              return (
                <div
                  key={v.id}
                  style={{
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: `2px solid ${selected ? v.color : BRAND.border}`,
                    backgroundColor: "#fff",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleVertical(v.id)}
                    className="relative w-full text-left transition-all"
                    style={{
                      padding: 0,
                      background: "none",
                      border: "none",
                      display: "block",
                      width: "100%",
                    }}
                  >
                    <div
                      className="relative text-white"
                      style={{
                        backgroundColor: v.color,
                        borderRadius: 0,
                        padding: "16px",
                        paddingTop: 0,
                        marginTop: -1,
                        marginLeft: 0,
                        marginRight: 0,
                        width: "100%",
                      }}
                    >
                      <span
                        className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-white text-xs"
                        style={{
                          borderColor: v.color,
                          color: selected ? v.color : "transparent",
                        }}
                      >
                        {selected ? "✓" : ""}
                      </span>
                      <span className="text-3xl">{v.icono}</span>
                      <p className="mt-2 text-lg font-bold">{v.nombre}</p>
                      <p className="text-xs opacity-80">{v.subtitulo}</p>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold" style={{ color: v.color }}>
                        {v.precioRef}
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {v.beneficios.map((b) => (
                          <li key={b} className="text-xs text-[#555]">
                            <span style={{ color: v.color }}>✓</span> {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (pasoActual === 2) {
      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            Tu perfil personal
          </h2>
          <p className="mt-1 text-sm text-[#666]">Así te verán las familias</p>
          <input ref={profilePhotoRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePhoto} />
          <button
            type="button"
            onClick={() => profilePhotoRef.current?.click()}
            className="mt-6 flex items-center gap-4"
          >
            <div
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2"
              style={{ borderColor: PRIMARY }}
            >
              {profilePhotoPreview ? (
                <img src={profilePhotoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl text-[#ccc]">📷</span>
              )}
            </div>
            <span className="text-sm font-semibold" style={{ color: PRIMARY }}>
              Subir foto de perfil
            </span>
          </button>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Nombre</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Apellidos</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Ciudad</label>
              <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
              <input type="number" min="0" value={anosExperiencia} onChange={(e) => setAnosExperiencia(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              ¿Por qué deberían elegirte? <span className="text-red-500">*</span>
            </label>
            <textarea rows={4} value={sobreTi} onChange={(e) => setSobreTi(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              ¿Qué te gusta hacer? Tu personalidad <span className="text-[#888]">(opcional)</span>
            </label>
            <textarea rows={3} value={personalidad} onChange={(e) => setPersonalidad(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              ¿Qué te motivó a ofrecer este servicio? <span className="text-[#888]">(opcional)</span>
            </label>
            <textarea rows={3} value={motivacion} onChange={(e) => setMotivacion(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Idiomas</p>
            <div className="flex flex-wrap gap-2">
              {allIdiomas.map((lang) => (
                <TagPill key={lang} label={lang} selected={idiomas.includes(lang)} onClick={() => toggleIdioma(lang)} />
              ))}
              <TagPill label="+ Añadir" selected={false} onClick={addCustomIdioma} color="#666" />
            </div>
          </div>
        </div>
      );
    }

    if (pasoActual === 3) {
      const d = serviceDetails.alojamiento;
      const upd = (field, val) => updateServiceDetails("alojamiento", { ...d, [field]: val });
      const updCap = (key, val) =>
        updateServiceDetails("alojamiento", { ...d, capacidad: { ...d.capacidad, [key]: val } });
      const updNorma = (key, val) =>
        updateServiceDetails("alojamiento", { ...d, normas: { ...d.normas, [key]: val } });
      const toggleAmenity = (id) => {
        const next = d.amenities.includes(id) ? d.amenities.filter((a) => a !== id) : [...d.amenities, id];
        upd("amenities", next);
      };
      const alojDocs = getDocsForVertical("alojamiento");

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>🏠 Alojamiento</h2>
          <p className="mt-1 text-sm text-[#666]">Detalles de tu espacio</p>
          <input ref={(el) => { servicePhotoRefs.current.alojamiento = el; }} type="file" accept="image/*" multiple className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label="Fotos del alojamiento"
              previews={servicePhotoPreviews.alojamiento}
              onAdd={() => openServicePhotoUpload("alojamiento")}
              onRemove={(i) => removeServicePhoto("alojamiento", i)}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Título</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción del anuncio</label>
              <textarea
                value={d.descripcion_anuncio || ""}
                onChange={(e) => upd("descripcion_anuncio", e.target.value)}
                placeholder="Describe tu anuncio: qué ofreces, qué lo hace especial..."
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e8e4de", fontSize: 13 }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción</label>
              <textarea rows={4} value={d.descripcion} onChange={(e) => upd("descripcion", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Precio / noche (€)</label>
              <input type="number" min="0" value={d.precio} onChange={(e) => upd("precio", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">NRU</label>
              <input value={d.nru} onChange={(e) => upd("nru", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
          </div>
          <p className="mt-6 mb-3 text-xs font-medium text-[#444]">Tipo de alojamiento</p>
          <div className="grid gap-2 sm:grid-cols-5">
            {TIPO_ALOJAMIENTO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => upd("tipo_alojamiento", opt.value)}
                className="rounded-xl border p-3 text-center transition-colors"
                style={{
                  borderColor: d.tipo_alojamiento === opt.value ? PRIMARY : BRAND.border,
                  backgroundColor: d.tipo_alojamiento === opt.value ? `${PRIMARY}10` : "#fff",
                }}
              >
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="mt-0.5 text-[10px] text-[#888]">{opt.desc}</p>
              </button>
            ))}
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <DireccionContactoFields d={d} upd={upd} vertical="alojamiento" />
          </div>
          <p className="mt-6 mb-3 text-xs font-medium text-[#444]">Capacidad</p>
          <div className="grid grid-cols-4 gap-3">
            <CounterField label="Personas" value={d.capacidad.personas} onChange={(v) => updCap("personas", v)} min={1} />
            <CounterField label="Habitaciones" value={d.capacidad.habitaciones} onChange={(v) => updCap("habitaciones", v)} min={1} />
            <CounterField label="Camas" value={d.capacidad.camas} onChange={(v) => updCap("camas", v)} min={1} />
            <CounterField label="Baños" value={d.capacidad.banos} onChange={(v) => updCap("banos", v)} min={1} />
          </div>
          {AMENITIES_GROUPS.map((group) => (
            <div key={group.title} className="mt-6">
              <p className="mb-3 text-xs font-semibold text-[#444]">{group.title}</p>
              <div className="grid grid-cols-4 gap-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleAmenity(item.id)}
                    className="flex flex-col items-center rounded-xl border p-2 text-center transition-colors"
                    style={{
                      borderColor: d.amenities.includes(item.id) ? PRIMARY : BRAND.border,
                      backgroundColor: d.amenities.includes(item.id) ? `${PRIMARY}10` : "#fff",
                    }}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span className="mt-1 text-[10px] text-[#555]">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <p className="mb-3 text-xs font-semibold text-[#444]">Normas</p>
            <ToggleRow label="Pet-friendly" checked={d.normas.petFriendly} onChange={(v) => updNorma("petFriendly", v)} />
            <ToggleRow label="Bebés" checked={d.normas.bebes} onChange={(v) => updNorma("bebes", v)} />
            <ToggleRow label="Fumar" checked={d.normas.fumar} onChange={(v) => updNorma("fumar", v)} />
            <ToggleRow label="Fiestas" checked={d.normas.fiestas} onChange={(v) => updNorma("fiestas", v)} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Check-in</label>
                <input type="time" value={d.check_in} onChange={(e) => upd("check_in", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Check-out</label>
                <input type="time" value={d.check_out} onChange={(e) => upd("check_out", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Estancia mínima (noches)</label>
                <input type="number" min="1" value={d.estancia_minima} onChange={(e) => upd("estancia_minima", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#444]">Estancia máxima (noches)</label>
                <input type="number" min="1" value={d.estancia_maxima} onChange={(e) => upd("estancia_maxima", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
              </div>
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-[#444]">Documentos</p>
            {alojDocs.map((docId) => (
              <DocUploadRow
                key={docId}
                docId={docId}
                title={DOCUMENT_CATALOG[docId].title}
                required={DOCUMENT_CATALOG[docId].required}
                file={documentFiles[docId]}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }


    if (pasoActual === 4) {
      const d = serviceDetails.ninos;
      const upd = (field, val) => updateServiceDetails("ninos", { ...d, [field]: val });
      const ninosDocs = getDocsForVertical("ninos");
      const allFormacion = [...FORMACION_TAGS, ...customTags.formacion];
      const allActividades = [...ACTIVIDADES_TAGS, ...customTags.actividades];

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>🧒 Niñera</h2>
          <p className="mt-1 text-sm text-[#666]">Tu servicio de cuidado infantil</p>
          <input ref={(el) => { servicePhotoRefs.current.ninos = el; }} type="file" accept="image/*" className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label="Foto del servicio"
              previews={servicePhotoPreviews.ninos}
              onAdd={() => openServicePhotoUpload("ninos")}
              onRemove={(i) => removeServicePhoto("ninos", i)}
              multiple={false}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Título</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción del anuncio</label>
              <textarea
                value={d.descripcion_anuncio || ""}
                onChange={(e) => upd("descripcion_anuncio", e.target.value)}
                placeholder="Describe tu anuncio: qué ofreces, qué lo hace especial..."
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e8e4de", fontSize: 13 }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
              <input type="number" min="0" value={d.anos_experiencia} onChange={(e) => upd("anos_experiencia", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Precio / hora (€)</label>
              <input type="number" min="0" value={d.precio} onChange={(e) => upd("precio", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-2 text-xs font-medium text-[#444]">Modalidad</p>
              <div className="flex flex-wrap gap-2">
                {MODALIDAD_OPTIONS.ninos.map((opt) => (
                  <TagPill key={opt.value} label={opt.label} selected={d.modalidad === opt.value} onClick={() => upd("modalidad", opt.value)} color={GREEN} />
                ))}
              </div>
            </div>
            <DireccionContactoFields d={d} upd={upd} vertical="ninos" />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Rango de edad</p>
            <div className="flex flex-wrap gap-2">
              {EDADES_TAGS.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.edadesTags || []).includes(tag)} onClick={() => toggleTag("ninos", "edadesTags", tag)} color={GREEN} />
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Formación</p>
            <div className="flex flex-wrap gap-2">
              {allFormacion.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.formacionTags || []).includes(tag)} onClick={() => toggleTag("ninos", "formacionTags", tag)} color={GREEN} />
              ))}
              <TagPill label="+ Otro" selected={false} onClick={() => addCustomTag("ninos", "formacionTags", "formacion")} color="#666" />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción del servicio</label>
            <textarea rows={4} value={d.descripcion} onChange={(e) => upd("descripcion", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Actividades</p>
            <div className="flex flex-wrap gap-2">
              {allActividades.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.actividadesTags || []).includes(tag)} onClick={() => toggleTag("ninos", "actividadesTags", tag)} color={GREEN} />
              ))}
              <TagPill label="+ Otro" selected={false} onClick={() => addCustomTag("ninos", "actividadesTags", "actividades")} color="#666" />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Días disponibles</p>
            <div className="flex flex-wrap gap-2">
              {DIAS_SEMANA.map((dia) => (
                <TagPill
                  key={dia.id}
                  label={dia.label}
                  selected={(d.dias_disponibles || []).includes(dia.id)}
                  onClick={() => {
                    const arr = d.dias_disponibles || [];
                    const next = arr.includes(dia.id) ? arr.filter((x) => x !== dia.id) : [...arr, dia.id];
                    upd("dias_disponibles", next.length ? next : []);
                  }}
                  color={GREEN}
                />
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <ToggleRow label="Disponible para viajar" checked={d.disponible_para_viajar} onChange={(v) => upd("disponible_para_viajar", v)} />
            <ToggleRow label="Noches y fines de semana" checked={d.nochesFinde} onChange={(v) => upd("nochesFinde", v)} />
            <ToggleRow label="Carnet de conducir" checked={d.carnetConducir} onChange={(v) => upd("carnetConducir", v)} />
          </div>
          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: BRAND.border, backgroundColor: `${GREEN}08` }}>
            <p className="text-sm font-semibold text-[#1a1a1a]">Referencias externas</p>
            <p className="mt-1 text-xs text-[#666]">Pide a familias anteriores que confirmen tu experiencia</p>
            <button
              type="button"
              className="mt-3 rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: GREEN, color: GREEN }}
              onClick={() => window.alert("Te enviaremos un enlace para solicitar referencias tras enviar tu perfil.")}
            >
              Solicitar referencia
            </button>
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-[#444]">Documentos</p>
            {ninosDocs.map((docId) => (
              <DocUploadRow
                key={docId}
                docId={docId}
                title={DOCUMENT_CATALOG[docId].title}
                required={DOCUMENT_CATALOG[docId].required}
                file={documentFiles[docId]}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }

    if (pasoActual === 5) {
      const d = serviceDetails.mascotas;
      const upd = (field, val) => updateServiceDetails("mascotas", { ...d, [field]: val });
      const mascotasDocs = getDocsForVertical("mascotas");
      const allAnimales = [...ANIMALES_TAGS, ...customTags.animales];
      const allCert = [...CERT_MASCOTAS_TAGS, ...customTags.certMascotas];

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>🐾 Mascotas</h2>
          <p className="mt-1 text-sm text-[#666]">Tu servicio de cuidado animal</p>
          <input ref={(el) => { servicePhotoRefs.current.mascotas = el; }} type="file" accept="image/*" className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label="Foto del servicio"
              previews={servicePhotoPreviews.mascotas}
              onAdd={() => openServicePhotoUpload("mascotas")}
              onRemove={(i) => removeServicePhoto("mascotas", i)}
              multiple={false}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Título</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción del anuncio</label>
              <textarea
                value={d.descripcion_anuncio || ""}
                onChange={(e) => upd("descripcion_anuncio", e.target.value)}
                placeholder="Describe tu anuncio: qué ofreces, qué lo hace especial..."
                rows={3}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e8e4de", fontSize: 13 }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
              <input type="number" min="0" value={d.anos_experiencia} onChange={(e) => upd("anos_experiencia", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Precio / día (€)</label>
              <input type="number" min="0" value={d.precio} onChange={(e) => upd("precio", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Modalidad</label>
              <select
                value={d.modalidad}
                onChange={(e) => upd("modalidad", e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              >
                <option value="domicilio_proveedor">En mi domicilio</option>
                <option value="domicilio_cliente">En domicilio del cliente</option>
                <option value="paseos">Paseos</option>
                <option value="todo_incluido">Todo incluido</option>
              </select>
            </div>
            <DireccionContactoFields d={d} upd={upd} vertical="mascotas" />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">Descripción</label>
            <textarea rows={4} value={d.descripcion} onChange={(e) => upd("descripcion", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Animales</p>
            <div className="flex flex-wrap gap-2">
              {allAnimales.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.animalesTags || []).includes(tag)} onClick={() => toggleTag("mascotas", "animalesTags", tag)} color={ORANGE} />
              ))}
              <TagPill label="+ Otro" selected={false} onClick={() => addCustomTag("mascotas", "animalesTags", "animales")} color="#666" />
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Tamaño perro</p>
            <div className="flex flex-wrap gap-2">
              {TAMANO_PERRO_TAGS.map((tag) => (
                <TagPill key={tag} label={tag} selected={d.tamanoPerro === tag} onClick={() => upd("tamanoPerro", tag)} color={ORANGE} />
              ))}
            </div>
          </div>
          <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <ToggleRow label="Tiene jardín" checked={d.jardin} onChange={(v) => upd("jardin", v)} />
            <ToggleRow label="Paseos incluidos" checked={d.paseosIncluidos} onChange={(v) => upd("paseosIncluidos", v)} />
            <ToggleRow label="Envía fotos y actualizaciones" checked={d.fotosActualizaciones} onChange={(v) => upd("fotosActualizaciones", v)} />
            <ToggleRow label="Cerca de veterinario" checked={d.cercaVeterinario} onChange={(v) => upd("cercaVeterinario", v)} />
            <ToggleRow label="Disponible para viajar" checked={d.disponible_para_viajar} onChange={(v) => upd("disponible_para_viajar", v)} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">Certificaciones</p>
            <div className="flex flex-wrap gap-2">
              {allCert.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.certificacionesTags || []).includes(tag)} onClick={() => toggleTag("mascotas", "certificacionesTags", tag)} color={ORANGE} />
              ))}
              <TagPill label="+ Otro" selected={false} onClick={() => addCustomTag("mascotas", "certificacionesTags", "certMascotas")} color="#666" />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-[#444]">Documentos</p>
            {mascotasDocs.map((docId) => (
              <DocUploadRow
                key={docId}
                docId={docId}
                title={DOCUMENT_CATALOG[docId].title}
                required={DOCUMENT_CATALOG[docId].required}
                file={documentFiles[docId]}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }


    if (pasoActual === 6) {
      const verticalLabels = {
        alojamiento: "🏠 Alojamiento",
        ninos: "🧒 Niñera",
        mascotas: "🐾 Mascotas",
      };

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            Documentos generales
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Resumen de toda tu documentación
          </p>
          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <p className="text-sm font-semibold">DNI / NIE / Pasaporte</p>
            <p className="mt-0.5 text-xs text-[#666]">Obligatorio para todos los servicios</p>
            <div className="mt-3">
              <DocUploadRow
                docId="dni_nie"
                title="DNI / NIE / Pasaporte"
                required
                file={documentFiles.dni_nie || documentFiles.dni_propietario}
                onUpload={openDocumentUpload}
              />
            </div>
          </div>
          {verticalesSeleccionados.map((v) => {
            const docs = getDocsForVertical(v);
            return (
              <div key={v} className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
                <p className="text-sm font-semibold">{verticalLabels[v]}</p>
                <div className="mt-2 space-y-1">
                  {docs.map((docId) => (
                    <div key={docId} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span style={{ color: documentFiles[docId] ? GREEN : DOCUMENT_CATALOG[docId].required ? ORANGE : "#888" }}>
                          {documentFiles[docId] ? "✓" : DOCUMENT_CATALOG[docId].required ? "⚠️" : "○"}
                        </span>
                        {DOCUMENT_CATALOG[docId].title}
                      </span>
                      {!documentFiles[docId] && (
                        <button
                          type="button"
                          onClick={() => openDocumentUpload(docId)}
                          className="text-xs font-semibold"
                          style={{ color: PRIMARY }}
                        >
                          Subir
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          <div className="mt-6 space-y-2">
            {requiredDocuments
              .filter((doc) => doc.id !== "dni_nie")
              .map((doc) => (
                <DocUploadRow
                  key={doc.id}
                  docId={doc.id}
                  title={doc.title}
                  required={doc.required}
                  file={documentFiles[doc.id]}
                  onUpload={openDocumentUpload}
                />
              ))}
          </div>
        </div>
      );
    }

    if (pasoActual === 7) {
      const checklist = [
        { label: "Servicios seleccionados", ok: verticalesSeleccionados.length > 0 },
        { label: "Perfil personal", ok: nombre.trim() && apellido.trim() && sobreTi.trim() },
        { label: "Foto de perfil", ok: !!profilePhotoPreview },
        ...(verticalesSeleccionados.includes("alojamiento")
          ? [{ label: "Alojamiento", ok: serviceDetails.alojamiento.titulo.trim() && serviceDetails.alojamiento.precio }]
          : []),
        ...(verticalesSeleccionados.includes("ninos")
          ? [{ label: "Niñera", ok: serviceDetails.ninos.titulo.trim() && serviceDetails.ninos.precio }]
          : []),
        ...(verticalesSeleccionados.includes("mascotas")
          ? [{ label: "Mascotas", ok: serviceDetails.mascotas.titulo.trim() && serviceDetails.mascotas.precio }]
          : []),
        ...requiredDocuments
          .filter((d) => d.required)
          .map((d) => ({
            label: d.title,
            ok:
              d.id === "dni_nie"
                ? !!(documentFiles.dni_nie || documentFiles.dni_propietario)
                : !!documentFiles[d.id],
          })),
      ];

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            Revisión
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Así verán tu perfil las familias
          </p>
          <div
            className="mt-6 rounded-2xl border bg-white p-5"
            style={{ borderColor: BRAND.border }}
          >
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full bg-[#f5f3ef]">
                {profilePhotoPreview ? (
                  <img src={profilePhotoPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ fontFamily: SERIF }}>
                  {[nombre, apellido].filter(Boolean).join(" ") || "Tu nombre"}
                </h3>
                <p className="text-sm text-[#666]">{ciudad}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {VERTICALES_CARDS.filter((v) => verticalesSeleccionados.includes(v.id)).map((v) => (
                    <span
                      key={v.id}
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: v.color }}
                    >
                      {v.nombre}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            {sobreTi && (
              <p className="mt-4 text-sm text-[#444] leading-relaxed">{sobreTi}</p>
            )}
            {verticalesSeleccionados.map((v) => {
              const d = serviceDetails[v];
              const card = VERTICALES_CARDS.find((c) => c.id === v);
              return (
                <div key={v} className="mt-4 border-t pt-4" style={{ borderColor: BRAND.border }}>
                  <p className="text-sm font-semibold" style={{ color: card?.color }}>
                    {card?.icono} {card?.nombre}
                  </p>
                  <p className="text-sm text-[#1a1a1a]">{d.titulo || "—"}</p>
                  {d.descripcion && (
                    <p className="mt-1 text-xs text-[#666]">{d.descripcion}</p>
                  )}
                  {d.precio && (
                    <p className="mt-1 text-sm font-bold" style={{ color: PRIMARY }}>
                      {d.precio}€
                      {v === "alojamiento" ? "/noche" : v === "ninos" ? "/hora" : "/día"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Completitud del perfil</p>
              <p className="text-lg font-bold" style={{ color: PRIMARY }}>
                {completionPct}%
              </p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eee]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${completionPct}%`, backgroundColor: PRIMARY }}
              />
            </div>
            <ul className="mt-4 space-y-1.5">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2 text-sm">
                  <span style={{ color: item.ok ? GREEN : "#ccc" }}>
                    {item.ok ? "✓" : "○"}
                  </span>
                  <span style={{ color: item.ok ? "#444" : "#aaa" }}>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            style={{ backgroundColor: PRIMARY }}
          >
            {loading ? "Enviando..." : "Enviar para revisión →"}
          </button>
        </div>
      );
    }

    if (pasoActual === 8) {
      return (
        <div style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
          <h2
            style={{
              fontSize: 24,
              fontWeight: 300,
              color: "#2a3a4a",
              fontFamily: "Georgia,serif",
              marginBottom: 8,
            }}
          >
            ¡Perfil enviado para revisión!
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#888",
              marginBottom: 24,
              lineHeight: 1.7,
            }}
          >
            Nuestro equipo revisará tu perfil y documentos en menos de 24 horas.
            <br />
            Te avisaremos por email cuando esté verificado.
          </p>
          <div
            style={{
              background: "#e6f4f0",
              borderRadius: 8,
              padding: "16px 24px",
              display: "inline-block",
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: 12, color: "#0e7a5c", fontWeight: 500 }}>
              🎁 Recuerda
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
              Tus primeras 3 reservas son sin comisión
            </div>
          </div>
          <br />
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={{
              background: "#1d4f91",
              color: "#fff",
              border: "none",
              padding: "11px 28px",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Ir a mi dashboard →
          </button>
        </div>
      );
    }

    return null;
  };

  const isConfirmStep = pasoActual === 8;
  const isLastStep = pasoActual === 7;
  const isFirstStep = pasoActual === 1;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
          <h1 className="text-lg font-semibold" style={{ color: PRIMARY, fontFamily: SERIF }}>
            Crea tu perfil de proveedor
          </h1>
        </div>
        <StepBar steps={visibleSteps} pasoActual={pasoActual} />
      </header>

      <input ref={documentInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={handleDocumentFile} />

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {isConfirmStep ? (
          renderStep()
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_290px]">
            <div>
              {errorMessage && (
                <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}
              {renderStep()}
              {!isLastStep && (
                <div className="mt-10 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={goBack}
                    disabled={isFirstStep}
                    className="rounded-xl border px-6 py-3 text-sm font-semibold transition-opacity disabled:opacity-30"
                    style={{ borderColor: "#ccc", color: "#666" }}
                  >
                    ← Volver
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    className="rounded-xl px-6 py-3 text-sm font-semibold text-white"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    Siguiente →
                  </button>
                </div>
              )}
              {isLastStep && !isFirstStep && (
                <button
                  type="button"
                  onClick={goBack}
                  className="mt-6 rounded-xl border px-6 py-3 text-sm font-semibold"
                  style={{ borderColor: "#ccc", color: "#666" }}
                >
                  ← Volver
                </button>
              )}
            </div>
            <PreviewPanel
              profilePhotoPreview={profilePhotoPreview}
              nombre={nombre}
              apellido={apellido}
              ciudad={ciudad}
              verticales={verticalesSeleccionados}
              serviceDetails={serviceDetails}
              idiomas={idiomas}
            />
          </div>
        )}
      </div>
    </div>
  );
}

