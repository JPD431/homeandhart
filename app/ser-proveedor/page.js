"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { buildLoginUrl } from "@/app/lib/auth-redirect";
import { supabase } from "@/app/lib/supabase";
import AmenitiesPicker from "@/app/components/AmenitiesPicker";
import BanoTipoSelector from "@/app/components/BanoTipoSelector";
import AlojamientoServiceFields from "@/app/components/provider/AlojamientoServiceFields";
import HuespedesPrecioFields from "@/app/components/provider/HuespedesPrecioFields";
import ModalidadCobroFields from "@/app/components/provider/ModalidadCobroFields";
import NinosServiceFields from "@/app/components/provider/NinosServiceFields";
import MascotasServiceFields from "@/app/components/provider/MascotasServiceFields";
import ToggleRow from "@/app/components/provider/ToggleRow";
import ServiceOperationalFields from "@/app/components/ServiceOperationalFields";
import { BRAND, SERIF } from "@/app/components/brand";
import { validateHuespedesPrecio } from "@/app/lib/huespedes-precio";
import { validateNruLax } from "@/app/lib/nru";
import {
  seedModalidadesCobroFromLegacy,
  validateModalidadCobro,
} from "@/app/lib/modalidad-cobro";
import { loadServiceModalidadesForm } from "@/app/lib/modalidad-cobro-persist";
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
import ServicePhotoUploadField from "@/app/components/provider/ServicePhotoUploadField";
import {
  syncDetailsPhotos,
} from "@/app/lib/service-photos";
import {
  finalizeOnboarding,
  loadOnboardingState,
  mapDraftRowToServiceDetails,
  parseProfileBio,
  saveOnboardingStep,
  saveProfileStep,
  saveVerticalesStep,
  upsertDraftService,
  REVISION_EN_REVISION,
} from "@/app/lib/onboarding-persist";
import { buildServicesSaveFeedback } from "@/app/lib/service-revision";
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
import ServiceCard from "@/app/components/ServiceCard";
import ServiceAnuncioContent from "@/app/components/ServiceAnuncioContent";
import {
  buildWizardPreviewServices,
  getWizardPreviewSummary,
  getWizardPreviewVerticalHeading,
} from "@/app/lib/wizard-preview-adapter";
import { buildAnuncioPreviewHref } from "@/app/lib/service-card-display";
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
  buildPostOnboardingPendingSteps,
  getWizardQualityGaps,
} from "@/app/lib/listing-completeness";
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

import {
  TIPO_ALOJAMIENTO_OPTIONS,
  MODALIDAD_NINOS_OPTIONS,
  MODALIDAD_MASCOTAS_OPTIONS,
  getModalidadServicioFormCopy,
} from "@/app/lib/service-form-tags";

const MODALIDAD_OPTIONS = {
  ninos: MODALIDAD_NINOS_OPTIONS,
  mascotas: MODALIDAD_MASCOTAS_OPTIONS,
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
    capacidad: { personas: 2, habitaciones: 1, camas: 1, banos: 1, bano_tipo: null },
    capacidad_maxima: "2",
    huespedes_incluidos: "2",
    precio_huesped_extra: "",
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
    fotos: [],
    foto_url: "",
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
    modalidades_cobro: seedModalidadesCobroFromLegacy("ninos", {}),
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
    capacidad_maxima: "2",
    huespedes_incluidos: "1",
    precio_huesped_extra: "",
    fotos: [],
    foto_url: "",
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
    modalidades_cobro: seedModalidadesCobroFromLegacy("mascotas", { precio: "0" }),
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
    capacidad_maxima: "2",
    huespedes_incluidos: "1",
    precio_huesped_extra: "",
    fotos: [],
    foto_url: "",
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
  const documentInputRef = useRef(null);

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
  const [openingPreviewVertical, setOpeningPreviewVertical] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [savingStep, setSavingStep] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [postOnboardingPending, setPostOnboardingPending] = useState([]);
  const [accountEmail, setAccountEmail] = useState(null);

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
  const previewServices = useMemo(
    () =>
      buildWizardPreviewServices(verticalesSeleccionados, {
        serviceDetails,
        nombre,
        apellido,
        ciudad,
        idiomas,
        userId,
      }),
    [
      verticalesSeleccionados,
      serviceDetails,
      nombre,
      apellido,
      ciudad,
      idiomas,
      userId,
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
        router.replace(buildLoginUrl("/ser-proveedor"));
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
            setVerticalesSeleccionados([...new Set(profile.onboarding_verticales)]);
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

          for (const row of drafts) {
            const vertical = row.vertical;
            if (!vertical || !nextDetails[vertical]) continue;
            const mapped = mapDraftRowToServiceDetails(row);
            const cobro = await loadServiceModalidadesForm(
              row.id,
              vertical,
              row,
            );
            nextDetails[vertical] = {
              ...nextDetails[vertical],
              ...mapped,
              ...cobro,
            };
            nextDraftIds[vertical] = row.id;
          }

          setServiceDetails(nextDetails);
          setDraftServiceIds(nextDraftIds);
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
      const result = await upsertDraftService(
        userId,
        "alojamiento",
        ciudad,
        serviceDetails.alojamiento,
        draftServiceIds.alojamiento,
        [],
      );
      applyDraftSaveResult("alojamiento", result);
      await saveOnboardingStep(userId, stepKey);
      await notifyAdminsServiceInReview(result.id, result.revisionMeta);
      return { revisionMeta: result.revisionMeta };
    }

    if (
      stepKey === STEP_KEY.SERVICIO_NINOS &&
      verticalesSeleccionados.includes("ninos")
    ) {
      const result = await upsertDraftService(
        userId,
        "ninos",
        ciudad,
        serviceDetails.ninos,
        draftServiceIds.ninos,
        [],
      );
      applyDraftSaveResult("ninos", result);
      await saveOnboardingStep(userId, stepKey);
      await notifyAdminsServiceInReview(result.id, result.revisionMeta);
      return { revisionMeta: result.revisionMeta };
    }

    if (
      stepKey === STEP_KEY.SERVICIO_MASCOTAS &&
      verticalesSeleccionados.includes("mascotas")
    ) {
      const result = await upsertDraftService(
        userId,
        "mascotas",
        ciudad,
        serviceDetails.mascotas,
        draftServiceIds.mascotas,
        [],
      );
      applyDraftSaveResult("mascotas", result);
      await saveOnboardingStep(userId, stepKey);
      await notifyAdminsServiceInReview(result.id, result.revisionMeta);
      return { revisionMeta: result.revisionMeta };
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
    setVerticalesSeleccionados((prev) => {
      const next = prev.includes(id)
        ? prev.filter((v) => v !== id)
        : [...prev, id];
      return [...new Set(next)];
    });
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

  function applyDraftSaveResult(vertical, { id, fotos }) {
    setDraftServiceIds((prev) => ({ ...prev, [vertical]: id }));
    setServiceDetails((prev) => ({
      ...prev,
      [vertical]: syncDetailsPhotos({ ...prev[vertical], fotos }),
    }));
  }

  async function notifyAdminsServiceInReview(serviceId, revisionMeta) {
    if (!serviceId || revisionMeta?.revision_estado !== REVISION_EN_REVISION) {
      return;
    }
    try {
      await fetch("/api/services/revision-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: serviceId }),
      });
    } catch (err) {
      console.error("[ser-proveedor] revision-notify", err);
    }
  }

  async function handleOpenFullAnuncioPreview(vertical) {
    if (!userId || !draftServiceIds[vertical]) return;

    setOpeningPreviewVertical(vertical);
    setErrorMessage("");
    try {
      const result = await upsertDraftService(
        userId,
        vertical,
        ciudad,
        serviceDetails[vertical],
        draftServiceIds[vertical],
        [],
      );
      applyDraftSaveResult(vertical, result);
      window.open(buildAnuncioPreviewHref(result.id), "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error abriendo vista previa:", err);
      setErrorMessage(
        "No se pudo abrir la vista previa: " + (err.message || "error desconocido"),
      );
    } finally {
      setOpeningPreviewVertical(null);
    }
  }

  function handleProfilePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfilePhoto(file);
    setProfilePhotoPreview(URL.createObjectURL(file));
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
      {
        const nruCheck = validateNruLax(d.nru);
        if (!nruCheck.ok) {
          setErrorMessage(nruCheck.error);
          return false;
        }
      }
      const huespedesError = validateHuespedesPrecio(d, "alojamiento");
      if (huespedesError) {
        setErrorMessage(huespedesError);
        return false;
      }
    }
    if (stepKey === STEP_KEY.SERVICIO_NINOS) {
      const d = serviceDetails.ninos;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de niñera.");
        return false;
      }
      const cobroError = validateModalidadCobro(d, "ninos");
      if (cobroError) {
        setErrorMessage(cobroError);
        return false;
      }
      const unidadesError = validateHuespedesPrecio(d, "ninos");
      if (unidadesError) {
        setErrorMessage(unidadesError);
        return false;
      }
    }
    if (stepKey === STEP_KEY.SERVICIO_MASCOTAS) {
      const d = serviceDetails.mascotas;
      if (!d.titulo.trim() || !d.precio) {
        setErrorMessage("Completa título y precio del servicio de mascotas.");
        return false;
      }
      const cobroError = validateModalidadCobro(d, "mascotas");
      if (cobroError) {
        setErrorMessage(cobroError);
        return false;
      }
      const unidadesError = validateHuespedesPrecio(d, "mascotas");
      if (unidadesError) {
        setErrorMessage(unidadesError);
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
    setSuccessMessage("");
    try {
      const persistResult = await persistStepData(currentStepKey);
      if (persistResult?.revisionMeta) {
        setSuccessMessage(
          buildServicesSaveFeedback([persistResult.revisionMeta]),
        );
      }
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
      setAccountEmail(user.email || null);

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

        const result = await upsertDraftService(
          uid,
          vertical,
          ciudad,
          servicioData,
          finalDraftIds[vertical],
          [],
        );
        finalDraftIds[vertical] = result.id;
      }

      setDraftServiceIds(finalDraftIds);

      await finalizeOnboarding(uid, verticalesSeleccionados, finalDraftIds);

      const notifyIds = Object.values(finalDraftIds).filter(Boolean);
      if (notifyIds.length > 0) {
        try {
          await fetch("/api/services/revision-notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_ids: notifyIds }),
          });
        } catch (notifyErr) {
          console.error("[ser-proveedor] revision-notify final:", notifyErr);
        }
      }

      await fetch("/api/onboarding/notify-nuevo-proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          verticales: verticalesSeleccionados,
        }),
      });

      const { data: profileAfter } = await supabase
        .from("profiles")
        .select(
          "id, role, telefono, email_contacto, cobros_activos, doc_dni_url, dni_estado, verificado",
        )
        .eq("id", uid)
        .maybeSingle();

      const listingServices = verticalesSeleccionados.map((v) => {
        const d = serviceDetails[v] || {};
        return {
          id: finalDraftIds[v],
          vertical: v,
          titulo: d.titulo,
          nru: d.nru,
          nru_estado: "pendiente",
          details: d,
          direccion_exacta: d.direccion_exacta,
          fotos: d.fotos,
          foto_url: d.foto_url,
        };
      });

      setPostOnboardingPending(
        buildPostOnboardingPendingSteps({
          perfil: {
            ...profileAfter,
            doc_dni_url:
              profileAfter?.doc_dni_url || savedDocUrls.doc_dni_url,
            dni_estado: profileAfter?.dni_estado,
          },
          accountEmail: user.email || null,
          services: listingServices,
          documentContext: {
            profile: {
              doc_dni_url:
                profileAfter?.doc_dni_url || savedDocUrls.doc_dni_url,
            },
            providerDocuments,
            services: listingServices,
            sessionFiles: documentFiles,
          },
        }),
      );

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
      const updCap = (key, val) => {
        const next = {
          ...d,
          capacidad: { ...d.capacidad, [key]: val },
        };
        if (key === "personas") {
          next.capacidad_maxima = val != null && val !== "" ? String(val) : "";
        }
        updateServiceDetails("alojamiento", next);
      };
      const alojDocs = getDocsForVertical("alojamiento");

      return (
        <div>
          <ServiceStepHeader title={getServiceHeaderTitle("alojamiento")} color={getVerticalColor("alojamiento")} />
          <ServicePhotoUploadField
            vertical="alojamiento"
            userId={userId}
            serviceId={draftServiceIds.alojamiento}
            details={d}
            onChange={(details) => updateServiceDetails("alojamiento", details)}
            onUploadError={setErrorMessage}
            label={serviceFotosLabel("alojamiento")}
            multiple
          />
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <CounterField label={SERVICE_LABELS.capacidadPersonas} value={d.capacidad.personas} onChange={(v) => updCap("personas", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadHabitaciones} value={d.capacidad.habitaciones} onChange={(v) => updCap("habitaciones", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadCamas} value={d.capacidad.camas} onChange={(v) => updCap("camas", v)} min={1} />
            <CounterField label={SERVICE_LABELS.capacidadBanos} value={d.capacidad.banos} onChange={(v) => updCap("banos", v)} min={1} />
          </div>
          <BanoTipoSelector
            className="mt-4"
            value={d.capacidad.bano_tipo ?? null}
            onChange={(v) => updCap("bano_tipo", v)}
            accentColor={PRIMARY}
          />
          <HuespedesPrecioFields
            className="mt-6"
            vertical="alojamiento"
            details={d}
            onChange={(next) => updateServiceDetails("alojamiento", next)}
          />
          <AlojamientoServiceFields
            details={d}
            onChange={(next) => updateServiceDetails("alojamiento", next)}
            accentColor={PRIMARY}
          />
          <AmenitiesPicker
            className="mt-6"
            value={d.amenities || []}
            onChange={(ids) => upd("amenities", ids)}
            accentColor={PRIMARY}
          />
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

      return (
        <div>
          <ServiceStepHeader title={getServiceHeaderTitle("ninos")} color={getVerticalColor("ninos")} />
          <ServicePhotoUploadField
            vertical="ninos"
            userId={userId}
            serviceId={draftServiceIds.ninos}
            details={d}
            onChange={(details) => updateServiceDetails("ninos", details)}
            onUploadError={setErrorMessage}
            label={serviceFotosLabel("ninos")}
            multiple
          />
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
            <div className="sm:col-span-2">
              <ModalidadCobroFields
                vertical="ninos"
                details={d}
                onChange={(next) => updateServiceDetails("ninos", next)}
                accentColor={GREEN}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-medium text-[#444]">
                {getModalidadServicioFormCopy("ninos").title}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed text-[#666]">
                {getModalidadServicioFormCopy("ninos").help}
              </p>
              <div className="flex flex-wrap gap-2">
                {MODALIDAD_OPTIONS.ninos.map((opt) => (
                  <TagPill key={opt.value} label={opt.label} selected={d.modalidad === opt.value} onClick={() => upd("modalidad", opt.value)} color={GREEN} />
                ))}
              </div>
            </div>
            <DireccionContactoFields d={d} upd={upd} vertical="ninos" />
          </div>
          <HuespedesPrecioFields
            className="mt-6"
            vertical="ninos"
            details={d}
            onChange={(next) => updateServiceDetails("ninos", next)}
            hideExtra
          />
          <NinosServiceFields
            details={d}
            onChange={(next) => updateServiceDetails("ninos", next)}
            accentColor={GREEN}
            showAnosExperiencia={false}
          />
          <ServiceOperationalFields
            vertical="ninos"
            details={d}
            onChange={(next) => updateServiceDetails("ninos", next)}
            collapsible
            sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
          />
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

      return (
        <div>
          <ServiceStepHeader title={getServiceHeaderTitle("mascotas")} color={getVerticalColor("mascotas")} />
          <ServicePhotoUploadField
            vertical="mascotas"
            userId={userId}
            serviceId={draftServiceIds.mascotas}
            details={d}
            onChange={(details) => updateServiceDetails("mascotas", details)}
            onUploadError={setErrorMessage}
            label={serviceFotosLabel("mascotas")}
            multiple
          />
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
            <div className="sm:col-span-2">
              <ModalidadCobroFields
                vertical="mascotas"
                details={d}
                onChange={(next) => updateServiceDetails("mascotas", next)}
                accentColor={ORANGE}
              />
            </div>
            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-medium text-[#444]">
                {getModalidadServicioFormCopy("mascotas").title}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed text-[#666]">
                {getModalidadServicioFormCopy("mascotas").help}
              </p>
              <div className="flex flex-col gap-2">
                {MODALIDAD_OPTIONS.mascotas.map((opt) => {
                  const selected = d.modalidad === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => upd("modalidad", opt.value)}
                      className="rounded-xl border p-3 text-left transition-colors"
                      style={{
                        borderColor: selected ? ORANGE : BRAND.border,
                        backgroundColor: selected ? "#fff7ed" : "#fff",
                      }}
                    >
                      <span className="text-sm font-semibold text-[#1a1a1a]">
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <DireccionContactoFields d={d} upd={upd} vertical="mascotas" />
          </div>
          <HuespedesPrecioFields
            className="mt-6"
            vertical="mascotas"
            details={d}
            onChange={(next) => updateServiceDetails("mascotas", next)}
            hideExtra
          />
          <MascotasServiceFields
            details={d}
            onChange={(next) => updateServiceDetails("mascotas", next)}
            accentColor={ORANGE}
            showAnosExperiencia={false}
          />
          <ServiceOperationalFields
            vertical="mascotas"
            details={d}
            onChange={(next) => updateServiceDetails("mascotas", next)}
            collapsible
            sectionSubtitle={SERVICE_LABELS.operativo.subtitle}
          />
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
            Así te verán las familias
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            Revisa que todo esté bien antes de enviar. Cada servicio aparece como un
            anuncio.
          </p>

          <div className="mt-8 space-y-10">
            {[...new Set(verticalesSeleccionados)].map((vertical) => {
              const service = previewServices.find((s) => s.vertical === vertical);
              if (!service) return null;
              const color = getVerticalColor(vertical);
              const summary = getWizardPreviewSummary(
                vertical,
                serviceDetails[vertical],
              );
              const draftId = draftServiceIds[vertical];
              const canOpenFullPreview = Boolean(draftId);
              const isOpeningPreview = openingPreviewVertical === vertical;

              return (
                <section key={vertical}>
                  <p
                    className="mb-3 text-sm font-semibold"
                    style={{ color }}
                  >
                    {getWizardPreviewVerticalHeading(vertical)}
                  </p>
                  <div
                    className="max-w-md overflow-hidden rounded-lg border bg-white shadow-sm"
                    style={{
                      borderColor: BRAND.border,
                      borderLeftWidth: 4,
                      borderLeftColor: color,
                    }}
                  >
                    <ServiceCard service={service} isPreview lang="es" />
                    <div className="border-t px-4 pb-4" style={{ borderColor: BRAND.border }}>
                      <ServiceAnuncioContent
                        service={service}
                        showGallery={(service.fotos?.length ?? 0) > 1}
                      />
                    </div>
                  </div>
                  <dl className="mt-4 grid max-w-md gap-2 sm:grid-cols-2">
                    {summary.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border px-3 py-2"
                        style={{ borderColor: BRAND.border, backgroundColor: "#fafaf9" }}
                      >
                        <dt className="text-[10px] font-medium uppercase tracking-wide text-[#888]">
                          {item.label}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-[#1a1a1a]">
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 max-w-md">
                    {canOpenFullPreview ? (
                      <button
                        type="button"
                        onClick={() => handleOpenFullAnuncioPreview(vertical)}
                        disabled={isOpeningPreview}
                        className="text-sm font-semibold transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
                        style={{ color }}
                      >
                        {isOpeningPreview
                          ? "Guardando borrador…"
                          : "Ver anuncio completo →"}
                      </button>
                    ) : (
                      <p className="text-xs text-[#aaa]">
                        Completa este servicio para ver la vista previa completa
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
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
      const qualityGaps = getWizardQualityGaps({
        verticales: verticalesSeleccionados,
        serviceDetails,
      });

      return (
        <div>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {RESUMEN_LABELS.title}
          </h2>
          <p className="mt-1 text-sm text-[#666]">
            {RESUMEN_LABELS.subtitle}
          </p>
          {qualityGaps.length > 0 ? (
            <div
              className="mt-4 rounded-xl border px-4 py-3 text-sm leading-relaxed"
              style={{
                borderColor: "#93c5fd",
                backgroundColor: "#eff6ff",
                color: "#1e3a5f",
              }}
              role="status"
            >
              <p className="font-semibold">Puedes enviar a revisión</p>
              <p className="mt-1 text-[13px]">
                Te recomendamos añadir antes:{" "}
                <strong>{qualityGaps.join(", ")}</strong>. Podrás completarlos
                después desde tu dashboard; no alargamos el alta.
              </p>
            </div>
          ) : null}
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
      const pending =
        postOnboardingPending.length > 0
          ? postOnboardingPending
          : buildPostOnboardingPendingSteps({
              perfil: {
                telefono: null,
                cobros_activos: false,
                doc_dni_url: savedDocUrls.doc_dni_url,
                dni_estado: savedDocUrls.doc_dni_url ? "pendiente" : null,
              },
              accountEmail,
              services: verticalesSeleccionados.map((v) => ({
                id: draftServiceIds[v],
                vertical: v,
                titulo: serviceDetails[v]?.titulo,
                nru: serviceDetails[v]?.nru,
                nru_estado: "pendiente",
                details: serviceDetails[v],
                direccion_exacta: serviceDetails[v]?.direccion_exacta,
                fotos: serviceDetails[v]?.fotos,
              })),
              documentContext: {
                profile: { doc_dni_url: savedDocUrls.doc_dni_url },
                providerDocuments,
                services: verticalesSeleccionados.map((v) => ({
                  vertical: v,
                  nru: serviceDetails[v]?.nru,
                  details: serviceDetails[v],
                })),
                sessionFiles: documentFiles,
              },
            });

      return (
        <div style={{ textAlign: "center", padding: "40px 20px 60px" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✨</div>
          <h2
            style={{
              fontSize: 22,
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
              color: "#666",
              marginBottom: 16,
              lineHeight: 1.7,
              maxWidth: 420,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {CONFIRMACION_LABELS.subtitle}
          </p>
          <ul
            style={{
              listStyle: "none",
              margin: "0 auto 20px",
              padding: 0,
              maxWidth: 420,
              textAlign: "left",
            }}
          >
            {pending.map((step) => (
              <li
                key={step.id}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "10px 12px",
                  marginBottom: 8,
                  borderRadius: 8,
                  border: "1px solid #e8e4de",
                  background: step.actor === "equipo" ? "#f7f5f2" : "#fff",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    marginTop: 5,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background:
                      step.actor === "equipo" ? "#c47d1a" : PRIMARY,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "#2a3a4a",
                      lineHeight: 1.45,
                    }}
                  >
                    {step.label}
                  </p>
                  {step.actor === "equipo" ? (
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 11,
                        color: "#888",
                      }}
                    >
                      Lo completa el equipo · te avisamos por email
                    </p>
                  ) : (
                    <a
                      href={step.href}
                      style={{
                        display: "inline-block",
                        marginTop: 4,
                        fontSize: 12,
                        fontWeight: 600,
                        color: PRIMARY,
                      }}
                    >
                      Ir a completar →
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <div
            style={{
              background: "#e6f4f0",
              borderRadius: 8,
              padding: "14px 20px",
              display: "inline-block",
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 12, color: "#0e7a5c", fontWeight: 500 }}>
              🎁 Recuerda
            </div>
            <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
              Tus primeras 3 reservas son sin comisión
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/dashboard?tab=proveedor")}
              style={{
                background: "#1d4f91",
                color: "#fff",
                border: "none",
                padding: "12px 28px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                fontWeight: 600,
                minWidth: 220,
              }}
            >
              Completar lo que falta →
            </button>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              style={{
                background: "transparent",
                color: "#666",
                border: "1px solid #ccc",
                padding: "10px 22px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
                minWidth: 220,
              }}
            >
              Ir a mi dashboard
            </button>
          </div>
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
        {successMessage && !isConfirmStep && (
          <p className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </p>
        )}
        {renderStep()}
      </WizardLayout>
    </>
  );
}

