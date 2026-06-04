"use client";

import { createContext, useContext, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { BRAND } from "@/app/components/brand";

const ProveedorTranslateContext = createContext(null);

async function traducir(texto) {
  if (!texto) return texto;
  const res = await fetch("https://translate.terraprint.co/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: texto,
      source: "es",
      target: "en",
      format: "text",
    }),
  });
  const data = await res.json();
  return data.translatedText || texto;
}

export function ProveedorTranslateProvider({ bio, services, children }) {
  const [showTranslated, setShowTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [translations, setTranslations] = useState(null);

  async function handleToggle() {
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }

    if (translations) {
      setShowTranslated(true);
      return;
    }

    setLoading(true);
    try {
      const [translatedBio, serviceEntries] = await Promise.all([
        bio ? traducir(bio) : Promise.resolve(""),
        Promise.all(
          services.map(async (service) => {
            const tituloOriginal = service.titulo || "";
            const descripcionOriginal = service.descripcion || "";
            return [
              service.id,
              {
                titulo: tituloOriginal ? await traducir(tituloOriginal) : "",
                descripcion: descripcionOriginal
                  ? await traducir(descripcionOriginal)
                  : "",
              },
            ];
          }),
        ),
      ]);

      const translatedServices = Object.fromEntries(serviceEntries);

      setTranslations({ bio: translatedBio, services: translatedServices });
      setShowTranslated(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProveedorTranslateContext.Provider
      value={{
        showTranslated,
        loading,
        translations,
        handleToggle,
        originalBio: bio,
      }}
    >
      {children}
    </ProveedorTranslateContext.Provider>
  );
}

export function ProveedorTranslateButton() {
  const { lang } = useLang();
  const ctx = useContext(ProveedorTranslateContext);

  if (lang !== "en" || !ctx) return null;

  const { showTranslated, loading, handleToggle } = ctx;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="mt-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:cursor-wait disabled:opacity-60"
      style={{ color: BRAND.primary }}
    >
      {loading
        ? "Translating…"
        : showTranslated
          ? "🌐 Show original"
          : "🌐 Translate profile"}
    </button>
  );
}

function TranslatedBlock({ children, showBadge }) {
  return (
    <span className="inline">
      {children}
      {showBadge && (
        <span className="ml-1.5 text-[10px] font-medium text-[#888]">
          Translated
        </span>
      )}
    </span>
  );
}

export function ProveedorBioText({ bio }) {
  const ctx = useContext(ProveedorTranslateContext);
  if (!bio) return null;

  const showTranslated = ctx?.showTranslated && ctx.translations?.bio;
  const text = showTranslated ? ctx.translations.bio : bio;

  return (
    <p
      className="mt-6 border-t pt-6 text-sm leading-relaxed text-[#5c5c5c] sm:text-base"
      style={{ borderColor: BRAND.border }}
    >
      <TranslatedBlock showBadge={!!showTranslated}>{text}</TranslatedBlock>
    </p>
  );
}

export function ServicioTituloText({ serviceId, titulo }) {
  const ctx = useContext(ProveedorTranslateContext);
  const showTranslated =
    ctx?.showTranslated && ctx.translations?.services?.[serviceId]?.titulo;
  const text = showTranslated
    ? ctx.translations.services[serviceId].titulo
    : titulo;

  return (
    <p className="mt-0.5 text-lg font-semibold text-[#1a1a1a]">
      <TranslatedBlock showBadge={!!showTranslated}>{text}</TranslatedBlock>
    </p>
  );
}

export function ServicioDescripcionText({ serviceId, descripcion }) {
  const ctx = useContext(ProveedorTranslateContext);
  if (!descripcion) return null;

  const showTranslated =
    ctx?.showTranslated &&
    ctx.translations?.services?.[serviceId]?.descripcion;
  const text = showTranslated
    ? ctx.translations.services[serviceId].descripcion
    : descripcion;

  return (
    <p className="mt-2 text-sm leading-relaxed text-[#5c5c5c]">
      <TranslatedBlock showBadge={!!showTranslated}>{text}</TranslatedBlock>
    </p>
  );
}
