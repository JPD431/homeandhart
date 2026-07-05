/**
 * Catálogo y lógica de documentos del proveedor (Fase 3).
 * Fuente única de verdad — wizard y editar-perfil importan desde aquí.
 */

/** @typedef {'comun' | 'especifico' | 'opcional'} DocumentScope */
/** @typedef {'profile' | 'tabla' | 'texto'} DocumentStorage */
/**
 * @typedef {'uploaded' | 'missing' | 'optional_empty' | 'optional_uploaded' | 'not_applicable'} DocumentStatusState
 */

/**
 * @typedef {Object} DocumentDefinition
 * @property {string} id
 * @property {string} label
 * @property {DocumentScope} scope
 * @property {'alojamiento' | 'ninos' | 'mascotas' | null} vertical
 * @property {boolean} required - Bloquea avance en onboarding / validación de alta
 * @property {boolean} [requiredForPublish] - Bloquea publicación/activación del servicio
 * @property {DocumentStorage} storage
 * @property {string} [profileField] - Columna en profiles (storage === 'profile')
 * @property {string} [tableTipo] - Tipo en provider_documents (storage === 'tabla')
 * @property {string} [serviceField] - Campo texto en services (storage === 'texto')
 * @property {(verticales: string[]) => boolean} appliesTo
 */

/** IDs canónicos en provider_documents.tipo */
export const TABLE_DOCUMENT_TYPES = [
  "nru_comprobante",
  "seguro_hogar",
  "primeros_auxilios",
  "titulaciones",
  "certificaciones",
];

/** Alias legacy del wizard → ID canónico */
export const DOCUMENT_ID_ALIASES = {
  dni_propietario: "dni_nie",
  nru: "nru_texto",
};

/**
 * Catálogo completo de documentos.
 * @type {Record<string, DocumentDefinition>}
 */
export const PROVIDER_DOCUMENT_CATALOG = {
  dni_nie: {
    id: "dni_nie",
    label: "DNI / NIE / Pasaporte",
    scope: "comun",
    vertical: null,
    required: true,
    requiredForPublish: true,
    storage: "profile",
    profileField: "doc_dni_url",
    appliesTo: (verticales) => verticales.length > 0,
  },
  certificado_antecedentes: {
    id: "certificado_antecedentes",
    label: "Antecedentes penales",
    scope: "comun",
    vertical: null,
    required: true,
    requiredForPublish: true,
    storage: "profile",
    profileField: "doc_antecedentes_url",
    appliesTo: (verticales) =>
      verticales.includes("ninos") || verticales.includes("mascotas"),
  },
  certificado_delitos_sexuales: {
    id: "certificado_delitos_sexuales",
    label: "Antecedentes sexuales",
    scope: "comun",
    vertical: null,
    required: true,
    requiredForPublish: true,
    storage: "profile",
    profileField: "doc_antecedentes_sexuales_url",
    appliesTo: (verticales) => verticales.includes("ninos"),
  },
  nru_texto: {
    id: "nru_texto",
    label: "NRU (número de registro)",
    scope: "especifico",
    vertical: "alojamiento",
    required: true,
    requiredForPublish: true,
    storage: "texto",
    serviceField: "nru",
    appliesTo: (verticales) => verticales.includes("alojamiento"),
  },
  nru_comprobante: {
    id: "nru_comprobante",
    label: "Resolución NRU (PDF)",
    scope: "especifico",
    vertical: "alojamiento",
    required: false,
    requiredForPublish: true,
    storage: "tabla",
    tableTipo: "nru_comprobante",
    appliesTo: (verticales) => verticales.includes("alojamiento"),
  },
  seguro_hogar: {
    id: "seguro_hogar",
    label: "Seguro del hogar",
    scope: "opcional",
    vertical: "alojamiento",
    required: false,
    requiredForPublish: false,
    storage: "tabla",
    tableTipo: "seguro_hogar",
    appliesTo: (verticales) => verticales.includes("alojamiento"),
  },
  primeros_auxilios: {
    id: "primeros_auxilios",
    label: "Primeros auxilios",
    scope: "opcional",
    vertical: "ninos",
    required: false,
    requiredForPublish: false,
    storage: "tabla",
    tableTipo: "primeros_auxilios",
    appliesTo: (verticales) => verticales.includes("ninos"),
  },
  titulaciones: {
    id: "titulaciones",
    label: "Titulaciones",
    scope: "opcional",
    vertical: "ninos",
    required: false,
    requiredForPublish: false,
    storage: "tabla",
    tableTipo: "titulaciones",
    appliesTo: (verticales) => verticales.includes("ninos"),
  },
  certificaciones: {
    id: "certificaciones",
    label: "Certificaciones",
    scope: "opcional",
    vertical: "mascotas",
    required: false,
    requiredForPublish: false,
    storage: "tabla",
    tableTipo: "certificaciones",
    appliesTo: (verticales) => verticales.includes("mascotas"),
  },
};

/**
 * Compatibilidad con wizard (Fase 2): { title, required } por id.
 * @deprecated Usar PROVIDER_DOCUMENT_CATALOG en código nuevo.
 */
export const DOCUMENT_CATALOG = Object.fromEntries(
  Object.values(PROVIDER_DOCUMENT_CATALOG).map((def) => [
    def.id,
    { title: def.label, required: def.required },
  ]),
);

/** Mapeo docId → columna profiles (solo storage profile). */
export const DOC_ID_TO_PROFILE_FIELD = Object.fromEntries(
  Object.values(PROVIDER_DOCUMENT_CATALOG)
    .filter((def) => def.storage === "profile" && def.profileField)
    .flatMap((def) => [[def.id, def.profileField]]),
);

const SCOPE_ORDER = { comun: 0, especifico: 1, opcional: 2 };

/**
 * @param {string} docId
 * @returns {string}
 */
export function normalizeDocumentId(docId) {
  return DOCUMENT_ID_ALIASES[docId] || docId;
}

/**
 * @param {string} docId
 * @returns {DocumentDefinition | null}
 */
export function getDocumentDefinition(docId) {
  const id = normalizeDocumentId(docId);
  return PROVIDER_DOCUMENT_CATALOG[id] || null;
}

export function getProfileFieldForDocId(docId) {
  const def = getDocumentDefinition(docId);
  return def?.storage === "profile" ? def.profileField || null : null;
}

/**
 * @param {string[]} verticales
 * @returns {DocumentDefinition[]}
 */
export function getApplicableDocuments(verticales = []) {
  const verts = [...new Set(verticales)];
  const seen = new Set();

  const docs = Object.values(PROVIDER_DOCUMENT_CATALOG).filter((def) => {
    if (!def.appliesTo(verts)) return false;
    if (seen.has(def.id)) return false;
    seen.add(def.id);
    return true;
  });

  return docs.sort((a, b) => {
    const scopeDiff = SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope];
    if (scopeDiff !== 0) return scopeDiff;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.label.localeCompare(b.label, "es");
  });
}

/**
 * @typedef {Object} DocumentContext
 * @property {Record<string, string | null | undefined>} [profile]
 * @property {Array<{ tipo: string, url: string, vertical?: string | null }> | Record<string, string>} [providerDocuments]
 * @property {Array<{ vertical?: string, nru?: string, details?: { nru?: string } }>} [services]
 * @property {Record<string, File | unknown>} [sessionFiles]
 */

function normalizeProviderDocumentsMap(providerDocuments) {
  if (!providerDocuments) return {};
  if (Array.isArray(providerDocuments)) {
    return Object.fromEntries(
      providerDocuments.map((row) => [row.tipo, row.url]),
    );
  }
  return providerDocuments;
}

function getAlojamientoNru(services) {
  const list = Array.isArray(services) ? services : [];
  const aloj = list.find((s) => s.vertical === "alojamiento");
  const raw = aloj?.nru ?? aloj?.details?.nru ?? "";
  return String(raw).trim();
}

function hasProfileUrl(profile, field) {
  return !!(profile?.[field]?.trim?.() || profile?.[field]);
}

function hasTableUrl(providerDocsMap, tableTipo) {
  return !!(tableTipo && providerDocsMap[tableTipo]?.trim?.());
}

function hasSessionFile(sessionFiles, docId) {
  return !!(sessionFiles?.[docId] || sessionFiles?.[normalizeDocumentId(docId)]);
}

function isDocumentUploaded(def, context) {
  const profile = context.profile || {};
  const providerDocsMap = normalizeProviderDocumentsMap(context.providerDocuments);
  const sessionFiles = context.sessionFiles || {};

  if (hasSessionFile(sessionFiles, def.id)) return true;

  if (def.storage === "profile") {
    return hasProfileUrl(profile, def.profileField);
  }

  if (def.storage === "tabla") {
    return hasTableUrl(providerDocsMap, def.tableTipo);
  }

  if (def.storage === "texto") {
    return getAlojamientoNru(context.services || []) !== "";
  }

  return false;
}

/**
 * @param {string} docId
 * @param {DocumentContext} context
 * @param {string[]} [verticales]
 * @returns {{ state: DocumentStatusState, definition: DocumentDefinition | null, uploaded: boolean }}
 */
export function getDocumentStatus(docId, context, verticales = []) {
  const definition = getDocumentDefinition(docId);
  if (!definition) {
    return { state: "not_applicable", definition: null, uploaded: false };
  }

  const verts = verticales.length > 0 ? verticales : inferVerticalesFromContext(context);
  if (!definition.appliesTo(verts)) {
    return { state: "not_applicable", definition, uploaded: false };
  }

  const uploaded = isDocumentUploaded(definition, context);

  if (uploaded) {
    return {
      state: definition.required || definition.requiredForPublish
        ? "uploaded"
        : "optional_uploaded",
      definition,
      uploaded: true,
    };
  }

  if (definition.required) {
    return { state: "missing", definition, uploaded: false };
  }

  if (definition.requiredForPublish) {
    return { state: "missing", definition, uploaded: false };
  }

  return { state: "optional_empty", definition, uploaded: false };
}

function inferVerticalesFromContext(context) {
  const fromServices = (context.services || [])
    .map((s) => s.vertical)
    .filter(Boolean);
  return [...new Set(fromServices)];
}

/**
 * Documentos obligatorios para avanzar en el onboarding (no incluye solo-publicación).
 * @param {string[]} verticales
 * @param {DocumentContext} context
 * @returns {DocumentDefinition[]}
 */
export function getMissingRequiredDocuments(verticales = [], context = {}) {
  return getApplicableDocuments(verticales).filter((def) => {
    if (!def.required) return false;
    return !isDocumentUploaded(def, context);
  });
}

/**
 * Documentos obligatorios para publicar/activar (p. ej. PDF NRU en alojamiento).
 * @param {string[]} verticales
 * @param {DocumentContext} context
 * @returns {DocumentDefinition[]}
 */
export function getMissingPublishDocuments(verticales = [], context = {}) {
  return getApplicableDocuments(verticales).filter((def) => {
    if (!def.requiredForPublish) return false;
    return !isDocumentUploaded(def, context);
  });
}

/**
 * Documentos NRU necesarios para activar alojamiento (sin DNI — lo cubre verificado).
 * @param {DocumentContext} context
 * @returns {DocumentDefinition[]}
 */
export function getMissingAlojamientoNruForPublish(context = {}) {
  return ["nru_texto", "nru_comprobante"]
    .map((id) => getDocumentDefinition(id))
    .filter(Boolean)
    .filter((def) => !isDocumentUploaded(def, context));
}

/**
 * ¿NRU texto + PDF resolución listos para activar alojamiento?
 * @param {DocumentContext} context
 * @returns {boolean}
 */
export function alojamientoNruPublishReady(context = {}) {
  return getMissingAlojamientoNruForPublish(context).length === 0;
}

/**
 * ¿Puede activarse/publicarse el alojamiento? (NRU texto + PDF resolución + DNI vía catálogo completo)
 * @param {DocumentContext} context
 * @returns {boolean}
 */
export function canPublishAlojamiento(context) {
  return (
    getMissingPublishDocuments(["alojamiento"], context).length === 0
  );
}

/**
 * Agrupa documentos aplicables por scope para la UI.
 * @param {string[]} verticales
 */
export function groupApplicableDocuments(verticales = []) {
  const docs = getApplicableDocuments(verticales);
  return {
    comunes: docs.filter((d) => d.scope === "comun"),
    especificos: docs.filter((d) => d.scope === "especifico"),
    opcionales: docs.filter((d) => d.scope === "opcional"),
    all: docs,
  };
}
