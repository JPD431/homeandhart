"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

const PROBLEM_CARD_KEYS = ["card1", "card2", "card3"];

export default function ProblemSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const p = t.problem;

  return (
    <section
      className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      style={{ backgroundColor: BRAND.warm }}
      aria-labelledby="problem-heading"
    >
      <div className="mx-auto max-w-6xl">
        <p
          className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
          style={{ color: BRAND.primary }}
        >
          {p.label}
        </p>
        <h2
          id="problem-heading"
          className="mt-4 text-center text-2xl leading-snug text-[#1a1a1a] sm:text-3xl lg:text-4xl"
          style={{ fontFamily: SERIF }}
        >
          {p.titulo}
        </h2>
        <p
          className="mx-auto mt-3 max-w-2xl text-center text-base text-[#5c5c5c] sm:text-lg"
          style={{ fontFamily: SERIF }}
        >
          {p.subtitulo}
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
          {PROBLEM_CARD_KEYS.map((cardKey) => (
            <article
              key={cardKey}
              className="flex flex-col rounded-2xl border bg-white p-6 sm:p-7"
              style={{
                borderColor: BRAND.border,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}
            >
              <h3
                className="text-lg font-semibold text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                {p[`${cardKey}titulo`]}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-[#5c5c5c] sm:text-base">
                {p[`${cardKey}desc`]}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
