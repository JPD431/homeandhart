"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

const VALUES = [
  { letter: "F", title: "Faith", descKey: "faith" },
  { letter: "A", title: "Attention", descKey: "attention" },
  { letter: "M", title: "Magic", descKey: "magic" },
  { letter: "I", title: "Integrity", descKey: "integrity" },
  { letter: "L", title: "Links", descKey: "links" },
  { letter: "Y", title: "You First", descKey: "youFirst" },
];

export default function NosotrosSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const n = t.nosotros;

  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="nosotros-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="grid items-center lg:grid-cols-2"
          style={{ gap: "64px" }}
        >
          <div>
            <p
              className="text-[11px] uppercase"
              style={{
                color: BRAND.primary,
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              {t.footer.nosotros}
            </p>
            <h2
              id="nosotros-heading"
              className="mt-4 leading-snug text-[#1a1a1a]"
              style={{ fontFamily: SERIF, fontSize: "30px" }}
            >
              {n.titulo}
            </h2>
            <p
              className="mt-5 text-[14px] text-[#5c5c5c]"
              style={{ lineHeight: 1.8 }}
            >
              {n.subtitulo}
            </p>
            <a
              href="/nuestra-historia"
              className="mt-6 inline-block text-sm transition-opacity hover:opacity-80"
              style={{ color: BRAND.primary, fontWeight: 500 }}
            >
              {n.historia}
            </a>
          </div>

          <div className="grid grid-cols-3 grid-rows-2 gap-3 sm:gap-4">
            {VALUES.map((value) => (
              <article
                key={value.letter}
                className="border bg-white"
                style={{
                  borderColor: BRAND.border,
                  borderRadius: "13px",
                  padding: "14px",
                }}
              >
                <p
                  className="mb-1 leading-none"
                  style={{
                    fontFamily: SERIF,
                    fontSize: "26px",
                    color: BRAND.primary,
                    opacity: 0.22,
                    lineHeight: 1,
                    marginBottom: "4px",
                  }}
                >
                  {value.letter}
                </p>
                <p
                  className="text-[#111]"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    marginBottom: "3px",
                  }}
                >
                  {value.title}
                </p>
                <p
                  className="text-[#aaa]"
                  style={{ fontSize: "11px", lineHeight: 1.4 }}
                >
                  {n[value.descKey]}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
