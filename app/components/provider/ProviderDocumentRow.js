"use client";

import { BRAND } from "@/app/components/brand";
import { DOCUMENT_LABELS } from "@/app/lib/provider-form-labels";
import { GREEN, ORANGE, PRIMARY } from "@/app/lib/provider-verticals";

/**
 * @param {Object} props
 * @param {{ id: string, label: string, required?: boolean, requiredForPublish?: boolean, storage?: string }} props.definition
 * @param {{ state: string, uploaded: boolean }} props.status
 * @param {boolean} [props.uploading]
 * @param {(docId: string) => void} [props.onUpload]
 * @param {string} [props.hint]
 */
export default function ProviderDocumentRow({
  definition,
  status,
  uploading = false,
  onUpload,
  hint,
}) {
  const isTextField = definition.storage === "texto";
  const { uploaded, state } = status;
  const publishOnly =
    !definition.required && definition.requiredForPublish === true;

  let statusLabel = DOCUMENT_LABELS.opcional;
  let statusColor = "#888";

  if (uploading) {
    statusLabel = DOCUMENT_LABELS.subiendo;
    statusColor = PRIMARY;
  } else if (uploaded) {
    statusLabel = DOCUMENT_LABELS.yaLoTenemos;
    statusColor = GREEN;
  } else if (state === "missing") {
    statusLabel = publishOnly
      ? DOCUMENT_LABELS.pendientePublicar
      : DOCUMENT_LABELS.faltaSubir;
    statusColor = ORANGE;
  } else if (state === "optional_empty") {
    statusLabel = DOCUMENT_LABELS.opcional;
    statusColor = "#888";
  }

  const showUpload = !isTextField && onUpload;
  const showChange = showUpload && uploaded && !uploading;

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-xl border p-3"
      style={{ borderColor: BRAND.border }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#1a1a1a]">
          {definition.label}
          {publishOnly && !uploaded && (
            <span className="ml-1 text-xs font-normal text-[#888]">
              (necesario para publicar)
            </span>
          )}
          {definition.scope === "opcional" && (
            <span className="ml-1 text-xs font-normal text-[#888]">
              (opcional)
            </span>
          )}
        </p>
        {hint && (
          <p className="mt-0.5 text-xs text-[#888]">{hint}</p>
        )}
        <p className="mt-0.5 text-xs" style={{ color: statusColor }}>
          {statusLabel}
        </p>
      </div>
      {showUpload && (
        <button
          type="button"
          onClick={() => onUpload(definition.id)}
          disabled={uploading}
          className="shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
          style={{ borderColor: PRIMARY, color: PRIMARY }}
        >
          {uploading
            ? "…"
            : showChange
              ? DOCUMENT_LABELS.cambiar
              : DOCUMENT_LABELS.subir}
        </button>
      )}
    </div>
  );
}
