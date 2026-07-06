"use client";

import { useState } from "react";
import { BRAND } from "@/app/components/brand";
import {
  getApplicableDocuments,
  getDocumentStatus,
} from "@/app/lib/provider-documents";

const GREEN = "#085041";
const ORANGE = "#c47d1a";
const RED = "#b91c1c";

function normalizeProviderDocumentsMap(providerDocuments) {
  return Object.fromEntries(
    (providerDocuments || []).map((row) => [row.tipo, row.url]),
  );
}

function getDocumentStoredUrl(definition, profile, providerDocuments) {
  if (definition.storage === "profile") {
    return profile?.[definition.profileField] || null;
  }
  if (definition.storage === "tabla") {
    const map = normalizeProviderDocumentsMap(providerDocuments);
    return map[definition.tableTipo] || null;
  }
  return null;
}

function getNruText(services) {
  const aloj = (services || []).find((s) => s.vertical === "alojamiento");
  return String(aloj?.nru ?? "").trim();
}

function isMandatoryDefinition(def) {
  return def.required || def.requiredForPublish;
}

/** @returns {'pending' | 'verified' | 'rejected'} */
function getProviderReviewState(profile) {
  if (profile?.rechazado === true) return "rejected";
  if (profile?.verificado === true) return "verified";
  return "pending";
}

/**
 * Resumen de obligatorios faltantes (misma lógica que la vista; exportado para el badge).
 * @param {Object} profile
 * @param {Array} providerDocuments
 * @param {Array} services
 */
export function getMissingMandatoryDocumentsSummary(
  profile,
  providerDocuments = [],
  services = [],
) {
  const verticales = [
    ...new Set((services || []).map((s) => s.vertical).filter(Boolean)),
  ];
  const context = { profile, providerDocuments, services };
  const mandatory = getApplicableDocuments(verticales).filter(isMandatoryDefinition);
  const missingMandatory = mandatory.filter(
    (def) => !getDocumentStatus(def.id, context, verticales).uploaded,
  );

  return {
    missingMandatory,
    missingCount: missingMandatory.length,
    missingNruPdf: missingMandatory.some((d) => d.id === "nru_comprobante"),
    hasAlojamiento: verticales.includes("alojamiento"),
    verticales,
  };
}

function buildMissingDocsBanner(reviewState, missingMandatory) {
  const labels = missingMandatory.map((d) => d.label).join(", ");
  const count = missingMandatory.length;

  if (reviewState === "verified") {
    return {
      tone: "amber",
      title: "Verificado ✓.",
      body: `En el sistema no constan algunos documentos (${labels}); puede haberse verificado manualmente.`,
    };
  }

  if (reviewState === "rejected") {
    return {
      tone: "red",
      title: `Faltan ${count} documento(s) obligatorio(s):`,
      body: labels,
    };
  }

  return {
    tone: "red",
    title: `Faltan ${count} documento(s) obligatorio(s) — revísalos antes de aprobar.`,
    body: labels,
  };
}

const BANNER_TONES = {
  red: { borderColor: "#fecaca", backgroundColor: "#fef2f2", color: RED },
  amber: { borderColor: "#fcd34d", backgroundColor: "#fdf4e7", color: "#92400e" },
};

function mandatoryHint(def) {
  if (def.required && def.requiredForPublish) return null;
  if (def.requiredForPublish && !def.required) return "Necesario para publicar";
  return null;
}

function FileIcon({ className }) {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function DocumentRow({
  definition,
  status,
  storedUrl,
  textValue,
  loading,
  onOpen,
  highlightMissing,
}) {
  const { uploaded } = status;
  const isText = definition.storage === "texto";
  const hint = mandatoryHint(definition);
  const canOpen = !isText && uploaded && storedUrl;

  return (
    <li
      className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm"
      style={{
        borderColor: highlightMissing ? "#fecaca" : BRAND.border,
        backgroundColor: highlightMissing ? "#fef2f2" : undefined,
      }}
    >
      <FileIcon className="h-5 w-5 shrink-0 text-[#666]" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-[#1a1a1a]">
          {definition.label}
          {hint && (
            <span className="ml-1 text-xs font-normal text-[#888]">
              ({hint})
            </span>
          )}
        </p>
        {isText && uploaded && textValue && (
          <p className="mt-0.5 font-mono text-xs text-[#444]">NRU: {textValue}</p>
        )}
      </div>

      {uploaded ? (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "#e6f4f0", color: GREEN }}
        >
          Subido ✓
        </span>
      ) : (
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "#fdf4e7", color: ORANGE }}
        >
          Falta ⚠
        </span>
      )}

      {canOpen && (
        <button
          type="button"
          disabled={loading}
          onClick={() => onOpen(definition.id, storedUrl)}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[#fafafa] disabled:cursor-wait disabled:opacity-60"
          style={{ borderColor: BRAND.primary, color: BRAND.primary }}
        >
          {loading ? "Abriendo…" : "Ver documento"}
        </button>
      )}
    </li>
  );
}

/**
 * Vista de documentos del proveedor para el panel admin.
 * @param {Object} props
 * @param {Object} props.profile - Fila profiles (doc_*_url, etc.)
 * @param {Array<{ tipo: string, url: string, vertical?: string | null }>} props.providerDocuments
 * @param {Array<{ vertical?: string, nru?: string }>} props.services
 */
export default function AdminProviderDocuments({
  profile,
  providerDocuments = [],
  services = [],
}) {
  const [loadingDoc, setLoadingDoc] = useState(null);
  const [docError, setDocError] = useState("");

  const verticales = [
    ...new Set((services || []).map((s) => s.vertical).filter(Boolean)),
  ];
  const context = { profile, providerDocuments, services };
  const applicable = getApplicableDocuments(verticales);

  const mandatory = applicable.filter(isMandatoryDefinition);
  const optionalUploaded = applicable.filter((def) => {
    if (def.scope !== "opcional") return false;
    return getDocumentStatus(def.id, context, verticales).uploaded;
  });

  const missingMandatory = mandatory.filter(
    (def) => !getDocumentStatus(def.id, context, verticales).uploaded,
  );

  const reviewState = getProviderReviewState(profile);
  const hasAlojamiento = verticales.includes("alojamiento");
  const missingNruPdf = missingMandatory.some((d) => d.id === "nru_comprobante");
  const nruText = getNruText(services);
  const missingBanner =
    missingMandatory.length > 0
      ? buildMissingDocsBanner(reviewState, missingMandatory)
      : null;
  const showNruPublishNotice =
    missingNruPdf &&
    hasAlojamiento &&
    (reviewState === "verified" || reviewState === "pending" || reviewState === "rejected");

  async function handleOpenDocument(docId, storedUrl) {
    setLoadingDoc(docId);
    setDocError("");

    try {
      const res = await fetch(
        `/api/admin/documento-url?storedUrl=${encodeURIComponent(storedUrl)}`,
      );
      const payload = await res.json().catch(() => ({}));

      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "No se pudo abrir el documento");
      }

      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setDocError(err.message || "No se pudo abrir el documento.");
    } finally {
      setLoadingDoc(null);
    }
  }

  if (verticales.length === 0) {
    return (
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
          Documentos
        </p>
        <p className="mt-1 text-sm text-[#888]">
          Sin servicios registrados — no hay documentos aplicables todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        Documentos
      </p>

      {missingBanner && (
        <div
          className="mt-2 rounded-xl border px-3 py-2.5 text-sm"
          style={BANNER_TONES[missingBanner.tone]}
        >
          <strong>{missingBanner.title}</strong>{" "}
          {missingBanner.body}
          {showNruPublishNotice && reviewState !== "verified" && (
            <span className="mt-1 block text-xs">
              El PDF de resolución NRU es necesario para publicar alojamiento.
            </span>
          )}
        </div>
      )}

      {showNruPublishNotice && reviewState === "verified" && (
        <div
          className="mt-2 rounded-xl border px-3 py-2.5 text-xs"
          style={BANNER_TONES.amber}
        >
          Falta el PDF de resolución NRU — necesario para publicar el alojamiento
          (el proveedor ya está verificado; conviene solicitarlo si aún no consta).
        </div>
      )}

      {docError && <p className="mt-2 text-xs text-red-600">{docError}</p>}

      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold text-[#444]">Obligatorios</p>
        {mandatory.length === 0 ? (
          <p className="text-sm text-[#888]">Ninguno aplicable.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {mandatory.map((def) => {
              const status = getDocumentStatus(def.id, context, verticales);
              const storedUrl = getDocumentStoredUrl(
                def,
                profile,
                providerDocuments,
              );
              const highlightMissing =
                !status.uploaded &&
                (def.id === "nru_comprobante" || def.required);

              return (
                <DocumentRow
                  key={def.id}
                  definition={def}
                  status={status}
                  storedUrl={storedUrl}
                  textValue={def.id === "nru_texto" ? nruText : undefined}
                  loading={loadingDoc === def.id}
                  onOpen={handleOpenDocument}
                  highlightMissing={highlightMissing}
                />
              );
            })}
          </ul>
        )}
      </div>

      {optionalUploaded.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold text-[#444]">
            Opcionales subidos
          </p>
          <ul className="flex flex-col gap-2">
            {optionalUploaded.map((def) => {
              const status = getDocumentStatus(def.id, context, verticales);
              const storedUrl = getDocumentStoredUrl(
                def,
                profile,
                providerDocuments,
              );

              return (
                <DocumentRow
                  key={def.id}
                  definition={def}
                  status={status}
                  storedUrl={storedUrl}
                  loading={loadingDoc === def.id}
                  onOpen={handleOpenDocument}
                  highlightMissing={false}
                />
              );
            })}
          </ul>
        </div>
      )}

      {optionalUploaded.length === 0 && mandatory.every((def) => {
        const s = getDocumentStatus(def.id, context, verticales);
        return s.uploaded;
      }) && (
        <p className="mt-2 text-xs text-[#888]">
          Sin documentos opcionales subidos.
        </p>
      )}
    </div>
  );
}
