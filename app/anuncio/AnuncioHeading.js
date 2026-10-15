"use client";

import Link from "next/link";
import { SERIF } from "@/app/components/brand";
import { normalizeCancelPolicy } from "@/app/lib/cancelacion-politica";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { VERTICAL_DOC_LABELS } from "@/app/lib/provider-verticals";
import { verticalEmojiLabel } from "@/app/lib/vertical-emojis";
import {
  getServiceCardTags,
  getServiceCardThemeLabel,
  getServiceCardZone,
} from "@/app/lib/service-card-display";

/*
 * Textos del anuncio que dependen del idioma. El anuncio público es ISR
 * (server component sin cookies), así que el idioma se resuelve aquí, en cliente.
 */

const CANCEL_KEYS = {
  flexible: "cancelFlexible",
  moderada: "cancelModerada",
  estricta: "cancelEstricta",
};

function Tag({ children, light, color }) {
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: light, color }}
    >
      {children}
    </span>
  );
}

export function AnuncioBackLink() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  return (
    <Link
      href="/buscar"
      className="text-[12px] no-underline transition-opacity hover:opacity-80"
      style={{ color: "#666" }}
    >
      {t.anuncio.volverBusqueda}
    </Link>
  );
}

/** Etiqueta de vertical, título, zona y etiquetas del anuncio. */
export function AnuncioHeading({ service, profile, accent }) {
  const { lang } = useLang();
  const t = useTranslation(lang);

  const verticalLabel = getServiceCardThemeLabel(service.vertical, lang);
  const titulo =
    service.titulo?.trim() || verticalLabel || t.anuncio.servicioFallback;
  const docLabel =
    lang === "en"
      ? verticalEmojiLabel(service.vertical, verticalLabel)
      : VERTICAL_DOC_LABELS[service.vertical] || verticalLabel;
  const zone = getServiceCardZone(service, profile, lang);

  const tags = getServiceCardTags(service, profile, lang);
  const cancelKey = CANCEL_KEYS[normalizeCancelPolicy(service.cancellation_policy)];
  if (cancelKey) {
    tags.push({ text: t.anuncio[cancelKey], light: "#f7f5f2", color: "#888" });
  }

  return (
    <>
      <p
        className="text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: accent }}
      >
        {docLabel}
      </p>

      <h1
        className="mt-2 text-[#111]"
        style={{
          fontFamily: SERIF,
          fontWeight: 300,
          fontSize: "clamp(24px, 4vw, 32px)",
          lineHeight: 1.2,
        }}
      >
        {titulo}
      </h1>

      <p className="mt-2 text-[13px] text-[#888]">{zone}</p>

      {tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Tag key={tag.text} light={tag.light} color={tag.color}>
              {tag.text}
            </Tag>
          ))}
        </div>
      )}
    </>
  );
}
