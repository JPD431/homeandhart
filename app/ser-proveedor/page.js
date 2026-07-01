"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import { BRAND, SERIF } from "@/app/components/brand";
import ServiceOperationalFields from "@/app/components/ServiceOperationalFields";
import { AMENITIES_GROUPS } from "@/app/lib/amenities";
import {
  loadProviderDocuments,
  persistProviderDocument,
} from "@/app/lib/provider-uploads";
import {
  getApplicableDocuments,
  getDocumentDefinition,
  getDocumentStatus,
  getMissingRequiredDocuments,
  normalizeDocumentId,
} from "@/app/lib/provider-documents";
import {
  finalizeOnboarding,
  loadOnboardingState,
  mapDraftRowToServiceDetails,
  parseProfileBio,
  saveOnboardingStep,
  saveProfileStep,
  saveVerticalesStep,
  upsertDraftService,
} from "@/app/lib/onboarding-persist";
import {
  buildVisibleSteps,
  getStepIndex,
  migrateLegacyOnboardingStep,
  STEP_KEY,
} from "@/app/ser-proveedor/onboarding-steps";
import WizardLayout from "@/app/ser-proveedor/WizardLayout";
import ServiceStepHeader from "@/app/components/provider/ServiceStepHeader";
import DireccionContactoFields from "@/app/components/provider/DireccionContactoFields";
import CounterField from "@/app/components/provider/CounterField";
import TagPill from "@/app/components/provider/TagPill";
import ProviderDocumentsSection from "@/app/components/provider/ProviderDocumentsSection";
import {
  CONFIRMACION_LABELS,
  DOCUMENT_LABELS,
  NAV_LABELS,
  PROFILE_LABELS,
  PROVIDER_INPUT_CLASS,
  RESUMEN_LABELS,
  SERVICE_LABELS,
  VERTICALES_STEP_LABELS,
  serviceDescripcionPlaceholder,
  serviceFotosLabel,
  servicePrecioLabel,
} from "@/app/lib/provider-form-labels";
import {
  GREEN,
  ORANGE,
  PRIMARY,
  VERTICALES_CARDS,
  getServiceHeaderTitle,
  getVerticalColor,
} from "@/app/lib/provider-verticals";

const DARK_BLUE = "#163a6b";

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

function inlineDocMeta(docId) {
  const def = getDocumentDefinition(normalizeDocumentId(docId));
  if (def) return { title: def.label, required: def.required };
  return { title: docId, required: false };
}

const EMPTY_SERVICE_DETAILS = {
  alojamiento: {
    titulo: "",
    descripcion: "",
    location_zone: "",
    location_lat: null,
    location_lng: null,
    tipo_alojamiento: "",
    precio: "",
    estancia_minima: "1",
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
    estancia_minima: "1",
    estancia_maxima: "",
    proveedor_emergencia: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
  },
  mascotas: {
    titulo: "",
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
    estancia_minima: "1",
    estancia_maxima: "",
    proveedor_emergencia: false,
    descuentos_duracion_activa: false,
    descuentos_duracion: [{ minDias: "", descuento: "" }],
  },
};

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

const inputClass = PROVIDER_INPUT_CLASS;

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

function DocUploadRow({ docId, title, required, file, uploaded, uploading, onUpload }) {
  const ok = !!(file || uploaded);
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
        <p className="text-xs" style={{ color: ok ? GREEN : required ? ORANGE : "#888" }}>
          {uploading
            ? DOCUMENT_LABELS.subiendo
            : ok
              ? DOCUMENT_LABELS.listo
              : required
                ? DOCUMENT_LABELS.faltaSubir
                : DOCUMENT_LABELS.opcional}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onUpload(docId)}
        disabled={uploading}
        className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
        style={{ borderColor: PRIMARY, color: PRIMARY }}
      >
        {uploading ? "…" : ok ? "Cambiar" : "Subir"}
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
      className="rounded-2xl border bg-white p-4 shadow-sm"
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

function docIsUploaded(docId, documentContext, verticales) {
  return getDocumentStatus(docId, documentContext, verticales).uploaded;
}

function calcCompletion(verticales, fields, documentContext) {
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
  getApplicableDocuments(verticales)
    .filter((d) => d.required)
    .forEach((d) => {
      check(docIsUploaded(d.id, documentContext, verticales));
    });
  return total > 0 ? Math.round((done / total) * 100) : 0;
}


export default function SerProveedorPage() {
  const router = useRouter();
  const profilePhotoRef = useRef(null);
  const servicePhotoRefs = useRef({ alojamiento: null, ninos: null, mascotas: null });
  const documentInputRef = useRef(null);
  const activePhotoVerticalRef = useRef(null);

  const [currentStepKey, setCurrentStepKey] = useState(STEP_KEY.PERFIL);
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
  const [savedDocUrls, setSavedDocUrls] = useState({
    doc_dni_url: null,
    doc_antecedentes_url: null,
    doc_antecedentes_sexuales_url: null,
  });
  const [providerDocuments, setProviderDocuments] = useState([]);
  const [uploadingDocId, setUploadingDocId] = useState(null);
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [fotoPerfilUrl, setFotoPerfilUrl] = useState(null);
  const [draftServiceIds, setDraftServiceIds] = useState({
    alojamiento: null,
    ninos: null,
    mascotas: null,
  });
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingStep, setSavingStep] = useState(false);
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
    () => buildVisibleSteps(verticalesSeleccionados),
    [verticalesSeleccionados],
  );
  const documentContext = useMemo(
    () => ({
      profile: savedDocUrls,
      providerDocuments,
      services: verticalesSeleccionados.map((v) => ({
        vertical: v,
        nru: serviceDetails[v]?.nru,
        details: serviceDetails[v],
      })),
      sessionFiles: documentFiles,
    }),
    [
      savedDocUrls,
      providerDocuments,
      verticalesSeleccionados,
      serviceDetails,
      documentFiles,
    ],
  );
  const completionPct = calcCompletion(verticalesSeleccionados, {
    nombre,
    apellido,
    ciudad,
    sobreTi,
    serviceDetails,
  }, documentContext);

  const allIdiomas = [...IDIOMAS_DEFAULT, ...customIdiomas];

  function hasUploadedDoc(docId) {
    return getDocumentStatus(docId, documentContext, verticalesSeleccionados)
      .uploaded;
  }

  useEffect(() => {
    let cancelled = false;

    async function resumeOnboarding() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (authError || !user) {
        router.replace("/login?next=/ser-proveedor");
        return;
      }

      try {
        const { profile, drafts } = await loadOnboardingState(user.id);

        if (cancelled) return;

        if (profile?.onboarding_completed_at) {
          router.replace("/dashboard?tab=proveedor");
          return;
        }

        setUserId(user.id);

        if (profile) {
          setNombre(profile.nombre || "");
          setApellido(profile.apellido || "");
          setCiudad(profile.ciudad || "");
          const bio = parseProfileBio(profile.descripcion);
          setSobreTi(bio.sobreTi);
          setPersonalidad(bio.personalidad);
          setMotivacion(bio.motivacion);
          setAnosExperiencia(
            profile.anos_experiencia != null
              ? String(profile.anos_experiencia)
              : bio.anosExperiencia,
          );
          setIdiomas(Array.isArray(profile.idiomas) ? profile.idiomas : []);
          if (profile.foto_perfil) {
            setFotoPerfilUrl(profile.foto_perfil);
            setProfilePhotoPreview(profile.foto_perfil);
          }
          setSavedDocUrls({
            doc_dni_url: profile.doc_dni_url || null,
            doc_antecedentes_url: profile.doc_antecedentes_url || null,
            doc_antecedentes_sexuales_url: profile.doc_antecedentes_sexuales_url || null,
          });
          const providerDocs = await loadProviderDocuments(user.id);
          if (!cancelled) setProviderDocuments(providerDocs);
          if (Array.isArray(profile.onboarding_verticales) && profile.onboarding_verticales.length > 0) {
            setVerticalesSeleccionados(profile.onboarding_verticales);
          }
          if (profile.onboarding_step) {
            const verts =
              Array.isArray(profile.onboarding_verticales) &&
              profile.onboarding_verticales.length > 0
                ? profile.onboarding_verticales
                : verticalesSeleccionados;
            const stepKey = migrateLegacyOnboardingStep(
              profile.onboarding_step,
              verts,
            );
            setCurrentStepKey(stepKey);
          }
        }

        if (drafts.length > 0) {
          const nextDetails = { ...EMPTY_SERVICE_DETAILS };
          const nextDraftIds = { alojamiento: null, ninos: null, mascotas: null };
          const nextPreviews = { alojamiento: [], ninos: [], mascotas: [] };

          for (const row of drafts) {
            const vertical = row.vertical;
            if (!vertical || !nextDetails[vertical]) continue;
            nextDetails[vertical] = {
              ...nextDetails[vertical],
              ...mapDraftRowToServiceDetails(row),
            };
            nextDraftIds[vertical] = row.id;
            if (row.foto_url) {
              nextPreviews[vertical] = [row.foto_url];
            }
          }

          setServiceDetails(nextDetails);
          setDraftServiceIds(nextDraftIds);
          setServicePhotoPreviews(nextPreviews);
        }
      } catch (err) {
        console.error("[ser-proveedor] Error cargando borrador:", err);
        if (!cancelled) {
          setErrorMessage("No se pudo cargar tu progreso. Puedes continuar desde aquí.");
          setUserId(user.id);
        }
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    }

    resumeOnboarding();

    return () => {
      cancelled = true;
    };
  }, [router]);

  async function persistStepData(stepKey) {
    if (!userId) throw new Error("No hay sesión activa.");

    if (stepKey === STEP_KEY.VERTICALES) {
      await saveVerticalesStep(userId, verticalesSeleccionados, stepKey);
      return;
    }

    if (stepKey === STEP_KEY.PERFIL) {
      const newFotoUrl = await saveProfileStep(
        userId,
        {
          nombre,
          apellido,
          ciudad,
          sobreTi,
          personalidad,
          motivacion,
          anosExperiencia,
          idiomas,
          fotoPerfilUrl,
          profilePhotoFile: profilePhoto,
        },
        stepKey,
      );
      if (newFotoUrl) {
        setFotoPerfilUrl(newFotoUrl);
        setProfilePhotoPreview(newFotoUrl);
        setProfilePhoto(null);
      }
      return;
    }

    if (
      stepKey === STEP_KEY.SERVICIO_ALOJAMIENTO &&
      verticalesSeleccionados.includes("alojamiento")
    ) {
      const id = await upsertDraftService(
        userId,
        "alojamiento",
        ciudad,
        serviceDetails.alojamiento,
        draftServiceIds.alojamiento,
        servicePhotos.alojamiento,
      );
      setDraftServiceIds((prev) => ({ ...prev, alojamiento: id }));
      if (servicePhotos.alojamiento.length > 0) {
        setServicePhotos((prev) => ({ ...prev, alojamiento: [] }));
      }
      await saveOnboardingStep(userId, stepKey);
      return;
    }

    if (
      stepKey === STEP_KEY.SERVICIO_NINOS &&
      verticalesSeleccionados.includes("ninos")
    ) {
      const id = await upsertDraftService(
        userId,
        "ninos",
        ciudad,
        serviceDetails.ninos,
        draftServiceIds.ninos,
        servicePhotos.ninos,
      );
      setDraftServiceIds((prev) => ({ ...prev, ninos: id }));
      if (servicePhotos.ninos.length > 0) {
        setServicePhotos((prev) => ({ ...prev, ninos: [] }));
      }
      await saveOnboardingStep(userId, stepKey);
      return;
    }

    if (
      stepKey === STEP_KEY.SERVICIO_MASCOTAS &&
      verticalesSeleccionados.includes("mascotas")
    ) {
      const id = await upsertDraftService(
        userId,
        "mascotas",
        ciudad,
        serviceDetails.mascotas,
        draftServiceIds.mascotas,
        servicePhotos.mascotas,
      );
      setDraftServiceIds((prev) => ({ ...prev, mascotas: id }));
      if (servicePhotos.mascotas.length > 0) {
        setServicePhotos((prev) => ({ ...prev, mascotas: [] }));
      }
      await saveOnboardingStep(userId, stepKey);
      return;
    }

    if (
      stepKey === STEP_KEY.DOCUMENTOS ||
      stepKey === STEP_KEY.PREVIEW ||
      stepKey === STEP_KEY.RESUMEN
    ) {
      await saveOnboardingStep(userId, stepKey);
    }
  }

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
    const docId = activeDocumentId;
    if (!file || !docId || !userId) return;
    e.target.value = "";

    setUploadingDocId(docId);
    setErrorMessage("");
    persistProviderDocument(userId, docId, file)
      .then((result) => {
        if (result.storage === "profile" && result.profileField) {
          setSavedDocUrls((prev) => ({
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
        setDocumentFiles((prev) => {
          const next = { ...prev };
          delete next[docId];
          delete next[normalizeDocumentId(docId)];
          return next;
        });
      })
      .catch((err) => {
        setErrorMessage(err.message || "Error al subir el documento.");
      })
      .finally(() => {
        setUploadingDocId(null);
        setActiveDocumentId(null);
      });
  }

  function validateStep(stepKey) {
    setErrorMessage("");
    if (stepKey === STEP_KEY.VERTICALES) {
      if (verticalesSeleccionados.length === 0) {
        setErrorMessage("Selecciona al menos un servicio.");
        return false;
      }
    }
    if (stepKey === STEP_KEY.PERFIL) {
      if (!nombre.trim() || !apellido.trim() || !ciudad.trim()) {
        setErrorMessage("Completa nombre, apellidos y ciudad.");
        return false;
      }
      if (!sobreTi.trim()) {
        setErrorMessage("Cuéntanos por qué deberían elegirte.");
        return false;
      }
    }
    if (stepKey === STEP_KEY.SERVICIO_ALOJAMIENTO) {
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
    if (stepKey === STEP_KEY.SERVICIO_NINOS) {
      const d = serviceDetails.ninos;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de niñera.");
        return false;
      }
    }
    if (stepKey === STEP_KEY.SERVICIO_MASCOTAS) {
      const d = serviceDetails.mascotas;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de mascotas.");
        return false;
      }
    }
    if (stepKey === STEP_KEY.DOCUMENTOS) {
      const missing = getMissingRequiredDocuments(
        verticalesSeleccionados,
        documentContext,
      );
      if (missing.length > 0) {
        setErrorMessage(
          `Faltan documentos obligatorios: ${missing.map((d) => d.label).join(", ")}`,
        );
        return false;
      }
    }
    return true;
  }

  async function goNext() {
    if (!validateStep(currentStepKey)) return;
    setSavingStep(true);
    setErrorMessage("");
    try {
      await persistStepData(currentStepKey);
      const idx = getStepIndex(visibleSteps, currentStepKey);
      if (idx < visibleSteps.length - 1) {
        const nextKey = visibleSteps[idx + 1].key;
        setCurrentStepKey(nextKey);
        if (userId) await saveOnboardingStep(userId, nextKey);
      }
    } catch (err) {
      setErrorMessage(err.message || "Error al guardar. Inténtalo de nuevo.");
    } finally {
      setSavingStep(false);
    }
  }

  function goBack() {
    const idx = getStepIndex(visibleSteps, currentStepKey);
    if (idx > 0) setCurrentStepKey(visibleSteps[idx - 1].key);
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

      const uid = user.id;
      setUserId(uid);

      await saveProfileStep(
        uid,
        {
          nombre,
          apellido,
          ciudad,
          sobreTi,
          personalidad,
          motivacion,
          anosExperiencia,
          idiomas,
          fotoPerfilUrl,
          profilePhotoFile: profilePhoto,
        },
        STEP_KEY.RESUMEN,
      );

      const finalDraftIds = { ...draftServiceIds };

      for (const vertical of verticalesSeleccionados) {
        const servicioData =
          vertical === "alojamiento"
            ? serviceDetails.alojamiento
            : vertical === "ninos"
              ? serviceDetails.ninos
              : serviceDetails.mascotas;

        const id = await upsertDraftService(
          uid,
          vertical,
          ciudad,
          servicioData,
          finalDraftIds[vertical],
          servicePhotos[vertical],
        );
        finalDraftIds[vertical] = id;
      }

      setDraftServiceIds(finalDraftIds);

      await finalizeOnboarding(uid, verticalesSeleccionados, finalDraftIds);

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

      setCurrentStepKey(STEP_KEY.CONFIRMACION);
    } catch (err) {
      console.error("Error inesperado:", err);
      setErrorMessage("Error inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  }


  const renderStep = () => {
    if (currentStepKey === STEP_KEY.VERTICALES) {
      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {VERTICALES_STEP_LABELS.title}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            {VERTICALES_STEP_LABELS.subtitle}
          </p>
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
          <p className="mt-6 text-xs leading-relaxed text-[#666]">
            {VERTICALES_STEP_LABELS.notaDni}
          </p>
        </div>
      );
    }

    if (currentStepKey === STEP_KEY.PERFIL) {
      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {PROFILE_LABELS.title}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            {PROFILE_LABELS.subtitle}
          </p>
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
              {PROFILE_LABELS.foto}
            </span>
          </button>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.nombre}</label>
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.apellidos}</label>
              <input value={apellido} onChange={(e) => setApellido(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.ciudad}</label>
              <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{PROFILE_LABELS.anosExperiencia}</label>
              <input type="number" min="0" value={anosExperiencia} onChange={(e) => setAnosExperiencia(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              {PROFILE_LABELS.bio} <span className="text-red-500">*</span>
            </label>
            <textarea rows={4} value={sobreTi} onChange={(e) => setSobreTi(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              {PROFILE_LABELS.personalidad} <span className="text-[#888]">{PROFILE_LABELS.opcional}</span>
            </label>
            <textarea rows={3} value={personalidad} onChange={(e) => setPersonalidad(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-medium text-[#444]">
              {PROFILE_LABELS.motivacion} <span className="text-[#888]">{PROFILE_LABELS.opcional}</span>
            </label>
            <textarea rows={3} value={motivacion} onChange={(e) => setMotivacion(e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-[#444]">{PROFILE_LABELS.idiomas}</p>
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

    if (currentStepKey === STEP_KEY.SERVICIO_ALOJAMIENTO) {
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
          <ServiceStepHeader title={getServiceHeaderTitle("alojamiento")} color={getVerticalColor("alojamiento")} />
          <input ref={(el) => { servicePhotoRefs.current.alojamiento = el; }} type="file" accept="image/*" multiple className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label={serviceFotosLabel("alojamiento")}
              previews={servicePhotoPreviews.alojamiento}
              onAdd={() => openServicePhotoUpload("alojamiento")}
              onRemove={(i) => removeServicePhoto("alojamiento", i)}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.titulo}</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.descripcion}</label>
              <textarea
                value={d.descripcion || ""}
                onChange={(e) => upd("descripcion", e.target.value)}
                placeholder={serviceDescripcionPlaceholder("alojamiento")}
                rows={4}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{servicePrecioLabel("alojamiento")}</label>
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
          <p className="mt-6 mb-3 text-xs font-medium text-[#444]">{SERVICE_LABELS.capacidad}</p>
          <div className="grid grid-cols-4 gap-3">
            <CounterField label={SERVICE_LABELS.capacidadPersonas} value={d.capacidad.personas} onChange={(v) => updCap("personas", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadHabitaciones} value={d.capacidad.habitaciones} onChange={(v) => updCap("habitaciones", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadCamas} value={d.capacidad.camas} onChange={(v) => updCap("camas", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadBanos} value={d.capacidad.banos} onChange={(v) => updCap("banos", v)} min={1} />
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
            </div>
          </div>
          <ServiceOperationalFields
            vertical="alojamiento"
            details={d}
            onChange={(next) => updateServiceDetails("alojamiento", next)}
            collapsible
            sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
          />
          <div className="mt-6 space-y-2">
            <p className="text-xs font-semibold text-[#444]">Documentos</p>
            {alojDocs.map((docId) => (
              <DocUploadRow
                key={docId}
                docId={docId}
                title={inlineDocMeta(docId).title}
                required={inlineDocMeta(docId).required}
                file={documentFiles[docId]}
                uploaded={hasUploadedDoc(docId)}
                uploading={uploadingDocId === docId}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }


    if (currentStepKey === STEP_KEY.SERVICIO_NINOS) {
      const d = serviceDetails.ninos;
      const upd = (field, val) => updateServiceDetails("ninos", { ...d, [field]: val });
      const ninosDocs = getDocsForVertical("ninos");
      const allFormacion = [...FORMACION_TAGS, ...customTags.formacion];
      const allActividades = [...ACTIVIDADES_TAGS, ...customTags.actividades];

      return (
        <div>
          <ServiceStepHeader title={getServiceHeaderTitle("ninos")} color={getVerticalColor("ninos")} />
          <input ref={(el) => { servicePhotoRefs.current.ninos = el; }} type="file" accept="image/*" className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label={serviceFotosLabel("ninos")}
              previews={servicePhotoPreviews.ninos}
              onAdd={() => openServicePhotoUpload("ninos")}
              onRemove={(i) => removeServicePhoto("ninos", i)}
              multiple={false}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.titulo}</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.descripcion}</label>
              <textarea
                value={d.descripcion || ""}
                onChange={(e) => upd("descripcion", e.target.value)}
                placeholder={serviceDescripcionPlaceholder("ninos")}
                rows={4}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
              <input type="number" min="0" value={d.anos_experiencia} onChange={(e) => upd("anos_experiencia", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{servicePrecioLabel("ninos")}</label>
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
            <p className="mb-2 text-xs font-medium text-[#444]">Actividades</p>
            <div className="flex flex-wrap gap-2">
              {allActividades.map((tag) => (
                <TagPill key={tag} label={tag} selected={(d.actividadesTags || []).includes(tag)} onClick={() => toggleTag("ninos", "actividadesTags", tag)} color={GREEN} />
              ))}
              <TagPill label="+ Otro" selected={false} onClick={() => addCustomTag("ninos", "actividadesTags", "actividades")} color="#666" />
            </div>
          </div>
          <ServiceOperationalFields
            vertical="ninos"
            details={d}
            onChange={(next) => updateServiceDetails("ninos", next)}
            collapsible
            sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
          />
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
                title={inlineDocMeta(docId).title}
                required={inlineDocMeta(docId).required}
                file={documentFiles[docId]}
                uploaded={hasUploadedDoc(docId)}
                uploading={uploadingDocId === docId}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }

    if (currentStepKey === STEP_KEY.SERVICIO_MASCOTAS) {
      const d = serviceDetails.mascotas;
      const upd = (field, val) => updateServiceDetails("mascotas", { ...d, [field]: val });
      const mascotasDocs = getDocsForVertical("mascotas");
      const allAnimales = [...ANIMALES_TAGS, ...customTags.animales];
      const allCert = [...CERT_MASCOTAS_TAGS, ...customTags.certMascotas];

      return (
        <div>
          <ServiceStepHeader title={getServiceHeaderTitle("mascotas")} color={getVerticalColor("mascotas")} />
          <input ref={(el) => { servicePhotoRefs.current.mascotas = el; }} type="file" accept="image/*" className="hidden" onChange={handleServicePhotos} />
          <div className="mt-6">
            <PhotoUploadGrid
              label={serviceFotosLabel("mascotas")}
              previews={servicePhotoPreviews.mascotas}
              onAdd={() => openServicePhotoUpload("mascotas")}
              onRemove={(i) => removeServicePhoto("mascotas", i)}
              multiple={false}
            />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.titulo}</label>
              <input value={d.titulo} onChange={(e) => upd("titulo", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{SERVICE_LABELS.descripcion}</label>
              <textarea
                value={d.descripcion || ""}
                onChange={(e) => upd("descripcion", e.target.value)}
                placeholder={serviceDescripcionPlaceholder("mascotas")}
                rows={4}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
              <input type="number" min="0" value={d.anos_experiencia} onChange={(e) => upd("anos_experiencia", e.target.value)} className={inputClass} style={{ borderColor: BRAND.border }} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#444]">{servicePrecioLabel("mascotas")}</label>
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
          <ServiceOperationalFields
            vertical="mascotas"
            details={d}
            onChange={(next) => updateServiceDetails("mascotas", next)}
            collapsible
            sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
          />
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
                title={inlineDocMeta(docId).title}
                required={inlineDocMeta(docId).required}
                file={documentFiles[docId]}
                uploaded={hasUploadedDoc(docId)}
                uploading={uploadingDocId === docId}
                onUpload={openDocumentUpload}
              />
            ))}
          </div>
        </div>
      );
    }


    if (currentStepKey === STEP_KEY.DOCUMENTOS) {
      return (
        <ProviderDocumentsSection
          verticales={verticalesSeleccionados}
          context={documentContext}
          uploadingDocId={uploadingDocId}
          onUpload={openDocumentUpload}
        />
      );
    }

    if (currentStepKey === STEP_KEY.PREVIEW) {
      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            Vista previa
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Así verán tu perfil las familias en Home&Heart
          </p>
          <div className="mt-6 max-w-sm">
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
        </div>
      );
    }

    if (currentStepKey === STEP_KEY.RESUMEN) {
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
        ...getApplicableDocuments(verticalesSeleccionados)
          .filter((d) => d.required)
          .map((d) => ({
            label: d.label,
            ok: getDocumentStatus(d.id, documentContext, verticalesSeleccionados)
              .uploaded,
          })),
      ];

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {RESUMEN_LABELS.title}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            {RESUMEN_LABELS.subtitle}
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
            {loading ? RESUMEN_LABELS.enviando : RESUMEN_LABELS.enviar}
          </button>
        </div>
      );
    }

    if (currentStepKey === STEP_KEY.CONFIRMACION) {
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
            {CONFIRMACION_LABELS.title}
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#888",
              marginBottom: 24,
              lineHeight: 1.7,
            }}
          >
            {CONFIRMACION_LABELS.subtitle}
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

  const isConfirmStep = currentStepKey === STEP_KEY.CONFIRMACION;
  const isLastStep = currentStepKey === STEP_KEY.RESUMEN;
  const isFirstStep = currentStepKey === STEP_KEY.PERFIL;

  const wizardFooter =
    !isConfirmStep && !isLastStep ? (
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirstStep}
          className="rounded-xl border px-6 py-3 text-sm font-semibold transition-opacity disabled:opacity-30"
          style={{ borderColor: "#ccc", color: "#666" }}
        >
          {NAV_LABELS.atras}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={savingStep}
          className="rounded-xl px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: PRIMARY }}
        >
          {savingStep ? NAV_LABELS.guardando : NAV_LABELS.continuar}
        </button>
      </div>
    ) : isLastStep ? (
      <button
        type="button"
        onClick={goBack}
        className="rounded-xl border px-6 py-3 text-sm font-semibold"
        style={{ borderColor: "#ccc", color: "#666" }}
      >
        {NAV_LABELS.atras}
      </button>
    ) : null;

  if (initialLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <p className="text-sm text-[#888]">Cargando tu progreso…</p>
      </div>
    );
  }

  return (
    <>
      <input
        ref={documentInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleDocumentFile}
      />

      <WizardLayout
        visibleSteps={visibleSteps}
        currentStepKey={currentStepKey}
        verticales={verticalesSeleccionados}
        footer={wizardFooter}
      >
        {errorMessage && !isConfirmStep && (
          <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}
        {renderStep()}
      </WizardLayout>
    </>
  );
}

