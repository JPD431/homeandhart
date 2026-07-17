import {
  REVISION_APROBADO,
  REVISION_BORRADOR,
  REVISION_EN_REVISION,
  REVISION_RECHAZADO,
} from "@/app/lib/onboarding-persist";
import { needsDireccionFields } from "@/app/lib/service-payload";
import { validateHuespedesPrecio } from "@/app/lib/huespedes-precio";

/**
 * Completo vs incompleto (listo para cola de moderación).
 *
 * Regla (alineada con validateStep del wizard):
 * - Todas: título + precio (número ≥ 0) + ciudad del perfil
 * - Alojamiento: + tipo_alojamiento + NRU
 * - Niñera/mascotas: + modalidad; si modalidad exige dirección → dirección
 * - Campos de precio por unidad válidos si están rellenos
 *
 * @returns {{ complete: boolean, missing: string[] }}
 */
export function getServiceCompleteness(details, vertical, { ciudad = "" } = {}) {
  const missing = [];
  const d = details || {};

  if (!String(d.titulo || "").trim()) {
    missing.push("título");
  }

  const precioRaw = d.precio;
  if (precioRaw === "" || precioRaw == null) {
    missing.push("precio");
  } else {
    const n = Number(precioRaw);
    if (!Number.isFinite(n) || n < 0) {
      missing.push("precio válido");
    }
  }

  if (!String(ciudad || "").trim()) {
    missing.push("ciudad (en tu perfil)");
  }

  if (vertical === "alojamiento") {
    if (!String(d.tipo_alojamiento || "").trim()) {
      missing.push("tipo de alojamiento");
    }
    if (!String(d.nru || "").trim()) {
      missing.push("NRU");
    }
  }

  if (vertical === "ninos" || vertical === "mascotas") {
    if (!String(d.modalidad || "").trim()) {
      missing.push("modalidad");
    }
    if (needsDireccionFields(vertical, d.modalidad)) {
      if (!String(d.direccion_exacta || "").trim()) {
        missing.push("dirección");
      }
    }
  }

  const unidadesError = validateHuespedesPrecio(d, vertical);
  if (unidadesError) {
    missing.push("datos de capacidad/precio por unidad");
  }

  return { complete: missing.length === 0, missing };
}

/**
 * Estado de revisión al guardar.
 * - Incompleto → borrador (no degrada aprobado/null publicados)
 * - Completo + aprobado/null (legacy) → se mantiene publicado
 * - Completo + nuevo/borrador/rechazado/en_revision → en_revision
 */
export function resolveRevisionEstadoOnSave({
  details,
  vertical,
  ciudad = "",
  currentRevisionEstado = null,
  isNew = false,
} = {}) {
  const { complete, missing } = getServiceCompleteness(details, vertical, {
    ciudad,
  });

  if (!complete) {
    if (
      !isNew &&
      (currentRevisionEstado === REVISION_APROBADO ||
        currentRevisionEstado == null)
    ) {
      return {
        revision_estado: currentRevisionEstado,
        complete: false,
        missing,
        keptPublished: true,
      };
    }
    return {
      revision_estado: REVISION_BORRADOR,
      complete: false,
      missing,
      keptPublished: false,
    };
  }

  if (isNew) {
    return {
      revision_estado: REVISION_EN_REVISION,
      complete: true,
      missing: [],
      keptPublished: false,
    };
  }

  if (currentRevisionEstado === REVISION_APROBADO) {
    return {
      revision_estado: REVISION_APROBADO,
      complete: true,
      missing: [],
      keptPublished: true,
    };
  }

  // Legacy null = ya tratado como aprobado en búsqueda; no forzar re-revisión
  if (currentRevisionEstado == null) {
    return {
      revision_estado: null,
      complete: true,
      missing: [],
      keptPublished: true,
    };
  }

  return {
    revision_estado: REVISION_EN_REVISION,
    complete: true,
    missing: [],
    keptPublished: false,
  };
}

/** Etiqueta de estado real para la lista del proveedor (solo revisión). */
export function getServiceRevisionDisplay(revisionEstado) {
  if (revisionEstado === REVISION_BORRADOR) {
    return {
      label: "Borrador (incompleto)",
      subtitle: "Completa los datos obligatorios y guarda para enviarlo a revisión",
      color: "#666",
    };
  }
  if (revisionEstado === REVISION_EN_REVISION) {
    return {
      label: "En revisión",
      subtitle: "Aparecerá publicado cuando lo aprobemos (normalmente < 24h)",
      color: "#c47d1a",
    };
  }
  if (revisionEstado === REVISION_RECHAZADO) {
    return {
      label: "Rechazado",
      subtitle: "Edita y guarda de nuevo para volver a enviarlo a revisión",
      color: "#b91c1c",
    };
  }
  // aprobado o null (legacy)
  return {
    label: "Publicado",
    subtitle: "Aprobado y visible cuando esté activo",
    color: "#0e7a5c",
  };
}

/**
 * Etiqueta de publicación para cabecera (revision_estado + disponible).
 * - aprobado/null + disponible → Publicado
 * - aprobado/null + !disponible → En pausa
 * - en_revision / rechazado / borrador → solo estado de revisión
 */
export function getServiceAvailabilityDisplay(revisionEstado, disponible) {
  if (revisionEstado === REVISION_BORRADOR) {
    return { label: "Borrador", color: "#666" };
  }
  if (revisionEstado === REVISION_EN_REVISION) {
    return { label: "En revisión", color: "#c47d1a" };
  }
  if (revisionEstado === REVISION_RECHAZADO) {
    return { label: "Rechazado", color: "#b91c1c" };
  }
  // aprobado o null
  if (disponible) {
    return { label: "Publicado", color: "#0e7a5c" };
  }
  return { label: "En pausa", color: "#666" };
}

/**
 * Mensaje post-guardado según outcomes de uno o varios servicios.
 * @param {Array<{ revision_estado: string|null, complete: boolean, missing: string[], keptPublished?: boolean }>} outcomes
 */
export function buildServicesSaveFeedback(outcomes) {
  const list = Array.isArray(outcomes) ? outcomes.filter(Boolean) : [];
  if (list.length === 0) {
    return "Cambios guardados correctamente ✓";
  }

  const drafts = list.filter(
    (o) => o.revision_estado === REVISION_BORRADOR && !o.keptPublished,
  );
  const publishedIncomplete = list.filter(
    (o) => o.complete === false && o.keptPublished,
  );
  const inReview = list.filter(
    (o) => o.revision_estado === REVISION_EN_REVISION,
  );
  const published = list.filter(
    (o) =>
      o.complete !== false &&
      (o.keptPublished === true ||
        o.revision_estado === REVISION_APROBADO ||
        o.revision_estado == null),
  );

  if (drafts.length > 0 && inReview.length === 0 && published.length === 0) {
    const missing = [...new Set(drafts.flatMap((o) => o.missing || []))];
    const falta =
      missing.length > 0 ? missing.join(", ") : "datos obligatorios";
    return `Tu servicio se ha guardado como borrador. Para publicarlo, completa: ${falta}.`;
  }

  if (
    inReview.length > 0 &&
    drafts.length === 0 &&
    publishedIncomplete.length === 0
  ) {
    return "Tu servicio se ha guardado y está en revisión. Aparecerá publicado cuando lo aprobemos (normalmente en menos de 24h).";
  }

  if (
    published.length > 0 &&
    inReview.length === 0 &&
    drafts.length === 0 &&
    publishedIncomplete.length === 0
  ) {
    return "Cambios guardados. Tu servicio sigue publicado.";
  }

  if (
    publishedIncomplete.length > 0 &&
    inReview.length === 0 &&
    drafts.length === 0
  ) {
    const missing = [
      ...new Set(publishedIncomplete.flatMap((o) => o.missing || [])),
    ];
    const falta =
      missing.length > 0 ? missing.join(", ") : "datos obligatorios";
    return `Cambios guardados. Tu servicio sigue publicado, pero falta completar: ${falta}.`;
  }

  // Mixto
  const parts = [];
  if (inReview.length > 0) {
    parts.push(
      "uno o más servicios quedaron en revisión (aparecerán al aprobarlos)",
    );
  }
  if (published.length > 0 && publishedIncomplete.length === 0) {
    parts.push("los ya aprobados siguen publicados");
  }
  if (publishedIncomplete.length > 0) {
    const missing = [
      ...new Set(publishedIncomplete.flatMap((o) => o.missing || [])),
    ];
    parts.push(
      `servicios publicados con datos incompletos${
        missing.length ? ` (falta: ${missing.join(", ")})` : ""
      }`,
    );
  }
  if (drafts.length > 0) {
    const missing = [...new Set(drafts.flatMap((o) => o.missing || []))];
    parts.push(
      `hay borradores incompletos${
        missing.length ? ` (falta: ${missing.join(", ")})` : ""
      }`,
    );
  }
  return `Cambios guardados: ${parts.join("; ")}.`;
}
