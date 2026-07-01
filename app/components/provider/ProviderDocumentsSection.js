"use client";

import { BRAND, SERIF } from "@/app/components/brand";
import { DOCUMENT_LABELS } from "@/app/lib/provider-form-labels";
import {
  getDocumentStatus,
  groupApplicableDocuments,
} from "@/app/lib/provider-documents";
import ProviderDocumentRow from "@/app/components/provider/ProviderDocumentRow";

const NRU_TEXTO_HINT =
  "Lo rellenas en el paso de alojamiento. Aquí solo comprobamos que esté hecho.";

/**
 * @param {Object} props
 * @param {string[]} props.verticales
 * @param {import('@/app/lib/provider-documents').DocumentContext} props.context
 * @param {string | null} [props.uploadingDocId]
 * @param {(docId: string) => void} props.onUpload
 * @param {boolean} [props.showHeader]
 */
export default function ProviderDocumentsSection({
  verticales,
  context,
  uploadingDocId = null,
  onUpload,
  showHeader = true,
}) {
  const groups = groupApplicableDocuments(verticales);

  function renderRow(definition) {
    const status = getDocumentStatus(definition.id, context, verticales);
    if (status.state === "not_applicable") return null;

    const hint =
      definition.id === "nru_texto" ? NRU_TEXTO_HINT : undefined;

    return (
      <ProviderDocumentRow
        key={definition.id}
        definition={definition}
        status={status}
        uploading={uploadingDocId === definition.id}
        onUpload={definition.storage === "texto" ? undefined : onUpload}
        hint={hint}
      />
    );
  }

  function renderBlock(title, docs) {
    if (!docs.length) return null;
    const rows = docs.map(renderRow).filter(Boolean);
    if (!rows.length) return null;

    return (
      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold text-[#444]">{title}</p>
        <div className="space-y-2">{rows}</div>
      </div>
    );
  }

  return (
    <div>
      {showHeader && (
        <>
          <h2 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            {DOCUMENT_LABELS.title}
          </h2>
          <p className="mt-1 text-sm text-[#666]">{DOCUMENT_LABELS.subtitle}</p>
        </>
      )}

      {groups.all.length === 0 ? (
        <p className="mt-6 text-sm text-[#666]">
          Elige al menos un servicio para ver qué documentos necesitas.
        </p>
      ) : (
        <>
          {renderBlock("Documentos comunes", groups.comunes)}
          {renderBlock("Documentos de tu servicio", groups.especificos)}
          {renderBlock("Mejora tu perfil (opcional)", groups.opcionales)}
        </>
      )}
    </div>
  );
}
