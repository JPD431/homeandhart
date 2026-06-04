"use client";

import { createContext, useContext, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { BRAND } from "@/app/components/brand";

const ProveedorTranslateContext = createContext(null);

function normalizeServiceId(serviceId) {
  return String(serviceId);
}

async function traducir(texto) {
  if (!texto?.trim()) return texto || "";
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

async function traducirCamposServicio(service) {
  const [titulo, descripcion, oferta_descripcion, oferta_titulo] =
    await Promise.all([
      traducir(service.titulo),
      traducir(service.descripcion),
      traducir(service.oferta_descripcion),
      traducir(service.oferta_titulo),
    ]);

  return { titulo, descripcion, oferta_descripcion, oferta_titulo };
}

export function ProveedorTranslateProvider({ bio, services = [], children }) {
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
            const id = normalizeServiceId(service.id);
            const campos = await traducirCamposServicio(service);
            return [id, campos];
          }),
        ),
      ]);

      setTranslations({
        bio: translatedBio,
        services: Object.fromEntries(serviceEntries),
      });
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
        services,
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

function getServiceTranslation(ctx, serviceId) {
  if (!ctx?.showTranslated || !ctx.translations?.services) return null;
  return ctx.translations.services[normalizeServiceId(serviceId)] ?? null;
}

export function ProveedorBioText({ bio }) {
  const ctx = useContext(ProveedorTranslateContext);
  if (!bio) return null;

  const translated = ctx?.showTranslated && ctx.translations?.bio;
  const text = translated || bio;

  return (
    <p
      className="mt-6 border-t pt-6 text-sm leading-relaxed text-[#5c5c5c] sm:text-base"
      style={{ borderColor: BRAND.border }}
    >
      <TranslatedBlock showBadge={!!translated}>{text}</TranslatedBlock>
    </p>
  );
}

export function ServicioTituloText({ serviceId, titulo }) {
  const ctx = useContext(ProveedorTranslateContext);
  const entry = getServiceTranslation(ctx, serviceId);
  const translated = entry?.titulo;
  const text = translated || titulo;

  return (
    <p className="mt-0.5 text-lg font-semibold text-[#1a1a1a]">
      <TranslatedBlock showBadge={!!translated}>{text}</TranslatedBlock>
    </p>
  );
}

export function ServicioDescripcionText({
  serviceId,
  descripcion,
  field = "descripcion",
}) {
  const ctx = useContext(ProveedorTranslateContext);
  if (!descripcion) return null;

  const entry = getServiceTranslation(ctx, serviceId);
  const translated = entry?.[field];
  const text = translated || descripcion;

  return (
    <p className="mt-2 text-sm leading-relaxed text-[#5c5c5c]">
      <TranslatedBlock showBadge={!!translated}>{text}</TranslatedBlock>
    </p>
  );
}

export function ServicioOfertaTituloText({
  serviceId,
  ofertaTitulo,
  descuento,
  validaHastaLabel,
}) {
  const ctx = useContext(ProveedorTranslateContext);
  const entry = getServiceTranslation(ctx, serviceId);
  const translated = entry?.oferta_titulo;
  const tituloMostrado = translated || ofertaTitulo;

  return (
    <div
      className="mt-3 rounded-xl px-4 py-3 text-sm leading-relaxed text-[#92400e]"
      style={{ backgroundColor: "#fef3c7" }}
    >
      <TranslatedBlock showBadge={!!translated}>
        🏷️ {tituloMostrado} — {descuento}% descuento · Válida hasta{" "}
        {validaHastaLabel}
      </TranslatedBlock>
    </div>
  );
}
