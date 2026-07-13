"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "@/app/components/brand";

function StoryPhoto() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const h = t.historiaPage;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <figure
      className="overflow-hidden border bg-white"
      style={{
        borderColor: BRAND.border,
        borderRadius: "22px",
      }}
    >
      <div
        className="relative"
        style={{
          aspectRatio: "16 / 9",
          background: "linear-gradient(160deg, #e8f0fb, #f7f5f2)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/nuestra-historia.jpg"
          alt={h.fotoAlt}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: loaded && !error ? "block" : "none",
          }}
        />

        {(!loaded || error) && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="text-center">
              <p
                className="text-[32px] leading-none"
                style={{ fontFamily: SERIF, color: BRAND.primary, opacity: 0.35 }}
              >
                {h.fotoCaption}
              </p>
              <p className="mt-3 text-xs" style={{ color: "#888" }}>
                {h.fotoHint}
              </p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}

function Section({ title, text }) {
  const paragraphs = useMemo(() => {
    return String(text || "")
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
  }, [text]);

  return (
    <section className="mt-10">
      <h2
        className="text-[14px] font-bold"
        style={{ color: "#111", marginBottom: 14 }}
      >
        {title}
      </h2>
      <div className="flex flex-col gap-5">
        {paragraphs.map((p, idx) => (
          <p
            key={`${title}-${idx}`}
            className="text-[15px]"
            style={{ color: "#3b3b3b", lineHeight: 1.95 }}
          >
            {p}
          </p>
        ))}
      </div>
    </section>
  );
}

export default function NuestraHistoriaPage() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const h = t.historiaPage;

  const sections = [
    { title: h.s1titulo, text: h.s1texto },
    { title: h.s2titulo, text: h.s2texto },
    { title: h.s3titulo, text: h.s3texto },
    { title: h.s4titulo, text: h.s4texto },
    { title: h.s5titulo, text: h.s5texto },
    { title: h.s6titulo, text: h.s6texto },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.warm }}>
      <Navbar />

      <main className="px-4 py-14 sm:px-6 sm:py-16">
        <div className="mx-auto" style={{ maxWidth: 860 }}>
          <header className="text-center">
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: BRAND.primary }}
            >
              Home&Heart
            </p>
            <h1
              className="mt-4 text-[#111]"
              style={{
                fontFamily: SERIF,
                fontWeight: 300,
                fontSize: "clamp(32px, 5vw, 52px)",
                letterSpacing: "-0.6px",
              }}
            >
              {h.titulo}
            </h1>
          </header>

          <div className="mt-10">
            <StoryPhoto />
          </div>

          <article className="mx-auto mt-12" style={{ maxWidth: 680 }}>
            {sections.map((s) => (
              <Section key={s.title} title={s.title} text={s.text} />
            ))}

            <p
              className="mt-12 text-center italic"
              style={{
                fontFamily: SERIF,
                fontSize: 24,
                color: BRAND.primary,
                opacity: 0.9,
              }}
            >
              {h.cierre}
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/buscar"
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: BRAND.primary,
                  borderRadius: "999px",
                }}
              >
                {h.ctaBuscar}
              </Link>
              <Link
                href="/ser-proveedor"
                className="inline-flex items-center justify-center border px-6 py-3 text-sm font-semibold transition-colors"
                style={{
                  borderColor: BRAND.border,
                  borderRadius: "999px",
                  backgroundColor: "#fff",
                  color: "#111",
                }}
              >
                {h.ctaOfrecer}
              </Link>
            </div>
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}

