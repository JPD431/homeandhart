"use client";

import {
  getMascotasDocumentacionStatus,
  getNinosDocumentacionStatus,
} from "@/app/lib/provider-documents";
import {
  REVISION_APROBADO,
  REVISION_EN_REVISION,
  REVISION_RECHAZADO,
} from "@/app/lib/onboarding-persist";

const STYLES = {
  ok: {
    bg: "#e6f4f0",
    color: "#085041",
    border: "1px solid #a7f3d0",
    borderWidth: "1px",
  },
  pending: {
    bg: "#fdf4e7",
    color: "#92400e",
    border: "1px solid #fcd34d",
    borderWidth: "1px",
  },
  pendingAdmin: {
    bg: "#fff7ed",
    color: "#9a3412",
    border: "2px solid #f59e0b",
    borderWidth: "2px",
  },
  rejected: {
    bg: "#fef2f2",
    color: "#b91c1c",
    border: "2px solid #ef4444",
    borderWidth: "2px",
  },
  na: {
    bg: "#f3f4f6",
    color: "#6b7280",
    border: "1px solid #e5e7eb",
    borderWidth: "1px",
  },
};

const MARK = {
  ok: "✓",
  pending: "·",
  pendingAdmin: "!",
  rejected: "✗",
  na: "—",
};

/**
 * @param {object} provider
 * @param {object[]} services
 * @returns {{
 *   items: Array<{ id: string, label: string, status: string, detail: string }>,
 *   rejectedLabels: string[],
 *   faltaLabels: string[],
 * }}
 */
export function buildProviderStatusItems(provider, services = []) {
  const list = Array.isArray(services) ? services : [];
  const verticals = new Set(list.map((s) => s.vertical).filter(Boolean));
  const hasAlojamiento = verticals.has("alojamiento");
  const hasNinos = verticals.has("ninos");
  const hasMascotas = verticals.has("mascotas");

  const dniVerificado = provider?.dni_estado === "verificado";
  const dniRechazado = provider?.dni_estado === "rechazado";
  const hasDni = Boolean(provider?.doc_dni_url);
  const edadOk = provider?.mayor_de_edad_confirmada === true;

  /** @type {Array<{ id: string, label: string, status: string, detail: string }>} */
  const items = [];

  // DNI
  if (dniRechazado) {
    items.push({
      id: "dni",
      label: "DNI",
      status: "rejected",
      detail: "Rechazado",
    });
  } else if (dniVerificado) {
    items.push({
      id: "dni",
      label: "DNI",
      status: "ok",
      detail: "Verificado",
    });
  } else if (hasDni) {
    items.push({
      id: "dni",
      label: "DNI",
      status: "pendingAdmin",
      detail: "Pendiente de verificar",
    });
  } else {
    items.push({
      id: "dni",
      label: "DNI",
      status: "pending",
      detail: "Sin documento",
    });
  }

  // 18+
  if (edadOk) {
    items.push({
      id: "edad",
      label: "18+",
      status: "ok",
      detail: "Confirmada",
    });
  } else if (hasDni || dniVerificado) {
    items.push({
      id: "edad",
      label: "18+",
      status: "pendingAdmin",
      detail: "Pendiente",
    });
  } else {
    items.push({
      id: "edad",
      label: "18+",
      status: "pending",
      detail: "Pendiente",
    });
  }

  // Cobros
  if (provider?.cobros_activos === true) {
    items.push({
      id: "cobros",
      label: "Cobros",
      status: "ok",
      detail: "Activos",
    });
  } else if (provider?.stripe_account_id) {
    items.push({
      id: "cobros",
      label: "Cobros",
      status: "pending",
      detail: "En configuración",
    });
  } else {
    items.push({
      id: "cobros",
      label: "Cobros",
      status: "pending",
      detail: "Pendientes",
    });
  }

  // Cuenta
  if (provider?.rechazado === true) {
    items.push({
      id: "cuenta",
      label: "Cuenta",
      status: "rejected",
      detail: "Rechazada",
    });
  } else if (provider?.verificado === true) {
    items.push({
      id: "cuenta",
      label: "Cuenta",
      status: "ok",
      detail: "Verificada",
    });
  } else {
    items.push({
      id: "cuenta",
      label: "Cuenta",
      status: "pendingAdmin",
      detail: "Pendiente de aprobar",
    });
  }

  // Anuncio(s)
  if (list.length === 0) {
    items.push({
      id: "anuncios",
      label: "Anuncio(s)",
      status: "pending",
      detail: "Sin anuncios",
    });
  } else {
    const hasRejected = list.some(
      (s) => s.revision_estado === REVISION_RECHAZADO,
    );
    const hasInReview = list.some(
      (s) => s.revision_estado === REVISION_EN_REVISION,
    );
    const allApproved = list.every(
      (s) =>
        s.revision_estado == null || s.revision_estado === REVISION_APROBADO,
    );
    if (hasRejected) {
      items.push({
        id: "anuncios",
        label: "Anuncio(s)",
        status: "rejected",
        detail: "Hay anuncios rechazados",
      });
    } else if (hasInReview) {
      items.push({
        id: "anuncios",
        label: "Anuncio(s)",
        status: "pendingAdmin",
        detail: "En revisión",
      });
    } else if (allApproved) {
      items.push({
        id: "anuncios",
        label: "Anuncio(s)",
        status: "ok",
        detail: "Aprobado(s)",
      });
    } else {
      items.push({
        id: "anuncios",
        label: "Anuncio(s)",
        status: "pending",
        detail: "Borrador / incompleto",
      });
    }
  }

  // NRU
  if (!hasAlojamiento) {
    items.push({
      id: "nru",
      label: "NRU",
      status: "na",
      detail: "N/A",
    });
  } else {
    const aloj = list.filter((s) => s.vertical === "alojamiento");
    const anyRejected = aloj.some((s) => s.nru_estado === "rechazado");
    const allVerified =
      aloj.length > 0 && aloj.every((s) => s.nru_estado === "verificado");
    if (anyRejected) {
      items.push({
        id: "nru",
        label: "NRU",
        status: "rejected",
        detail: "Rechazado",
      });
    } else if (allVerified) {
      items.push({
        id: "nru",
        label: "NRU",
        status: "ok",
        detail: "Verificado",
      });
    } else {
      const hasText = aloj.some((s) => (s.nru || "").trim());
      items.push({
        id: "nru",
        label: "NRU",
        status: hasText ? "pendingAdmin" : "pending",
        detail: hasText ? "Pendiente de verificar" : "Sin declarar",
      });
    }
  }

  // Docs niños
  if (!hasNinos) {
    items.push({
      id: "docs_ninos",
      label: "Docs niños",
      status: "na",
      detail: "N/A",
    });
  } else {
    const st = getNinosDocumentacionStatus(provider);
    if (st.approved) {
      items.push({
        id: "docs_ninos",
        label: "Docs niños",
        status: "ok",
        detail: "Aprobados",
      });
    } else if (st.allUploaded) {
      items.push({
        id: "docs_ninos",
        label: "Docs niños",
        status: "pendingAdmin",
        detail: "Pendiente de aprobar",
      });
    } else {
      items.push({
        id: "docs_ninos",
        label: "Docs niños",
        status: "pending",
        detail: "Incompletos",
      });
    }
  }

  // Docs mascotas
  if (!hasMascotas) {
    items.push({
      id: "docs_mascotas",
      label: "Docs mascotas",
      status: "na",
      detail: "N/A",
    });
  } else {
    const st = getMascotasDocumentacionStatus(provider);
    if (st.approved) {
      items.push({
        id: "docs_mascotas",
        label: "Docs mascotas",
        status: "ok",
        detail: "Aprobados",
      });
    } else if (st.allUploaded) {
      items.push({
        id: "docs_mascotas",
        label: "Docs mascotas",
        status: "pendingAdmin",
        detail: "Pendiente de aprobar",
      });
    } else {
      items.push({
        id: "docs_mascotas",
        label: "Docs mascotas",
        status: "pending",
        detail: "Incompletos",
      });
    }
  }

  const rejectedLabels = items
    .filter((i) => i.status === "rejected")
    .map((i) => i.label);
  const faltaLabels = items
    .filter((i) => i.status !== "ok" && i.status !== "na")
    .map((i) => i.label);

  return { items, rejectedLabels, faltaLabels };
}

function bannerText(rejectedLabels) {
  if (!rejectedLabels.length) return null;
  if (rejectedLabels.length === 1) {
    return `⚠ Este proveedor tiene ${rejectedLabels[0]} rechazado`;
  }
  return `⚠ Este proveedor tiene rechazos: ${rejectedLabels.join(", ")}`;
}

/**
 * Resumen visual de requisitos del proveedor (admin).
 */
export default function ProviderStatusSummary({ provider, services = [] }) {
  const { items, rejectedLabels, faltaLabels } = buildProviderStatusItems(
    provider,
    services,
  );
  const banner = bannerText(rejectedLabels);

  return (
    <div className="mt-3">
      {banner && (
        <div
          className="mb-3 rounded-xl px-3 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: "#fef2f2",
            border: "2px solid #ef4444",
            color: "#b91c1c",
          }}
        >
          {banner}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const style = STYLES[item.status] || STYLES.na;
          return (
            <span
              key={item.id}
              title={item.detail}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
              style={{
                backgroundColor: style.bg,
                color: style.color,
                border: style.border,
              }}
            >
              <span aria-hidden>{MARK[item.status] || "·"}</span>
              {item.label}
              <span className="font-medium opacity-80">· {item.detail}</span>
            </span>
          );
        })}
      </div>

      {faltaLabels.length > 0 ? (
        <p className="mt-2 text-xs font-medium text-[#92400e]">
          Falta: {faltaLabels.join(", ")}
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-[#085041]">
          Todos los requisitos visibles están OK
        </p>
      )}
    </div>
  );
}
