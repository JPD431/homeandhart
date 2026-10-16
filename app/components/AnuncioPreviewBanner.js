"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

/**
 * Aviso en /anuncio/[serviceId]/preview cuando el dueño ve su anuncio no publicado.
 */
export default function AnuncioPreviewBanner() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  return (
    <div
      className="border-b px-5 py-3 text-center text-[12px] leading-relaxed"
      style={{
        backgroundColor: "#fdf3e3",
        borderColor: "#e8dcc8",
        color: "#5c4a32",
      }}
      role="status"
    >
      <strong className="font-semibold">{t.anuncio.previewTitulo}</strong>
      {t.anuncio.previewTexto}
      <span className="text-[#92400e]">{t.anuncio.previewNoPublicado}</span>
    </div>
  );
}
