"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

const DARK_BLUE = "#163a6b";

function Pill({ children, variant = "dark" }) {
  const isDark = variant === "dark";
  return (
    <span
      className="text-[11px]"
      style={{
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.12)"
          : BRAND.light,
        color: isDark ? "rgba(255, 255, 255, 0.8)" : DARK_BLUE,
        borderRadius: "20px",
        padding: "4px 11px",
      }}
    >
      {children}
    </span>
  );
}

export default function DoubleCTASection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const d = t.doubleCTA;

  const travelPills = [d.pill1, d.pill2, d.pill3, d.pill4];
  const cityPills = [d.pill5, d.pill6, d.pill7, d.pill8];

  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="double-cta-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            {d.titulo}
          </p>
          <h2
            id="double-cta-heading"
            className="mt-4 text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontSize: "32px" }}
          >
            {d.subtitulo}
          </h2>
          <p className="mt-3 text-base text-[#5c5c5c] sm:text-lg">
            {d.subtitulo2}
          </p>
        </header>

        <div className="mx-auto mt-12" style={{ maxWidth: "960px" }}>
        <div
          className="grid md:grid-cols-2"
          style={{ gap: "18px" }}
        >
          {/* Tarjeta azul — Si viajas */}
          <article
            className="relative overflow-hidden text-white"
            style={{
              backgroundColor: BRAND.primary,
              borderRadius: "22px",
              padding: "36px",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {d.siViajas}
            </p>
            <h3
              className="mt-3 text-2xl text-white"
              style={{ fontFamily: SERIF }}
            >
              {d.siViajasTitle}
            </h3>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.65)" }}
            >
              {d.siViajasDesc}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {travelPills.map((pill) => (
                <Pill key={pill} variant="dark">
                  {pill}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              className="relative z-10 mt-6 px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "#fff",
                color: BRAND.primary,
                fontWeight: 500,
                borderRadius: "22px",
              }}
            >
              {d.buscar}
            </button>
            <span
              className="pointer-events-none absolute select-none text-white"
              style={{
                right: "-10px",
                bottom: "-20px",
                fontFamily: SERIF,
                fontSize: "130px",
                opacity: 0.06,
                lineHeight: 1,
              }}
              aria-hidden
            >
              ✈
            </span>
          </article>

          {/* Tarjeta blanca — Si estás en tu ciudad */}
          <article
            className="relative overflow-hidden border bg-white"
            style={{
              borderColor: BRAND.border,
              borderRadius: "22px",
              padding: "36px",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#aaa]">
              {d.siCiudad}
            </p>
            <h3
              className="mt-3 text-2xl text-[#111]"
              style={{ fontFamily: SERIF }}
            >
              {d.siCiudadTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5c5c5c]">
              {d.siCiudadDesc}
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {cityPills.map((pill) => (
                <Pill key={pill} variant="light">
                  {pill}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              className="relative z-10 mt-6 px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
              style={{
                backgroundColor: BRAND.primary,
                borderRadius: "22px",
              }}
            >
              {d.verProveedores}
            </button>
            <span
              className="pointer-events-none absolute select-none"
              style={{
                right: "-10px",
                bottom: "-20px",
                fontFamily: SERIF,
                fontSize: "130px",
                color: BRAND.primary,
                opacity: 0.06,
                lineHeight: 1,
              }}
              aria-hidden
            >
              ⌂
            </span>
          </article>
        </div>

        {/* Proveedores */}
        <div
          className="mt-0 text-center text-white"
          style={{
            backgroundColor: DARK_BLUE,
            borderRadius: "16px",
            padding: "48px",
          }}
        >
          <h3
            className="text-2xl text-white"
            style={{ fontFamily: SERIF }}
          >
            {d.proveedor}
          </h3>
          <p
            className="mx-auto mt-3 text-sm leading-relaxed sm:text-base"
            style={{
              maxWidth: "360px",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            {d.proveedorDesc}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              className="rounded-full border px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                borderColor: "rgba(255, 255, 255, 0.25)",
                color: "rgba(255, 255, 255, 0.8)",
              }}
            >
              {d.saberMas}
            </button>
            <button
              type="button"
              className="rounded-full px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "#fff",
                color: BRAND.primary,
                fontWeight: 500,
              }}
            >
              {d.crearPerfil}
            </button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
