"use client";

import Image from "next/image";
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
          {/* Left: text + values */}
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

            {/* FAMILY values as compact row */}
            <div className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {VALUES.map((value) => (
                <div
                  key={value.letter}
                  className="flex flex-col items-center rounded-xl border bg-white py-3 text-center"
                  style={{ borderColor: BRAND.border }}
                >
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: "22px",
                      color: BRAND.primary,
                      opacity: 0.3,
                      lineHeight: 1,
                    }}
                  >
                    {value.letter}
                  </span>
                  <span
                    className="mt-1 text-[10px] font-medium text-[#555]"
                    style={{ lineHeight: 1.2 }}
                  >
                    {value.title}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: team photo */}
          <div
            className="relative overflow-hidden"
            style={{
              borderRadius: "20px",
              aspectRatio: "3/4",
              boxShadow: "0 8px 32px rgba(0,0,0,0.10)",
            }}
          >
            <Image
              src="/team.jpg"
              alt="Equipo Home&Heart"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              style={{ objectFit: "cover", objectPosition: "center top" }}
              priority={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
