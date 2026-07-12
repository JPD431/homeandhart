"use client";

import Link from "next/link";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

function IdCardIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Zm3-6.75h.008v.008H7.5V12.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  );
}

function ShieldCheckIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}

function LockIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
      />
    </svg>
  );
}

function ClockShieldIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

const PILLAR_ICONS = [IdCardIcon, ShieldCheckIcon, LockIcon, ClockShieldIcon];

const PILLAR_COLORS = ["#1d4f91", "#0e7a5c", "#1d4f91", "#c47d1a"];

export default function TrustSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const c = t.confianza;

  const pillars = [
    { title: c.identidadTitulo, description: c.identidadDesc },
    { title: c.antecedentesTitulo, description: c.antecedentesDesc },
    { title: c.pagoTitulo, description: c.pagoDesc },
    { title: c.garantiaTitulo, description: c.garantiaDesc, link: "/garantia" },
  ];

  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: "#fff", padding: "80px 40px" }}
      aria-labelledby="confianza-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mx-auto max-w-3xl text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            {c.label}
          </p>
          <h2
            id="confianza-heading"
            className="mt-4 text-3xl leading-snug sm:text-4xl lg:text-[2.5rem]"
            style={{ fontFamily: SERIF }}
          >
            {c.titulo}
          </h2>
          <p
            className="mx-auto mt-6 text-base leading-relaxed sm:text-lg"
            style={{ color: "#444", maxWidth: 640 }}
          >
            {c.mensaje}
          </p>
        </header>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:gap-6">
          {pillars.map((pillar, index) => {
            const Icon = PILLAR_ICONS[index];
            const color = PILLAR_COLORS[index];

            return (
              <article
                key={pillar.title}
                className="border bg-white"
                style={{
                  borderColor: BRAND.border,
                  borderRadius: "18px",
                  padding: "24px",
                }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${color}14`, color }}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <h3
                  className="mt-4 text-lg text-[#1a1a1a]"
                  style={{ fontFamily: SERIF }}
                >
                  {pillar.title}
                </h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[#5c5c5c]">
                  {pillar.description}
                </p>
                {pillar.link && (
                  <Link
                    href={pillar.link}
                    className="mt-3 inline-block text-[13px] font-medium transition-opacity hover:opacity-80"
                    style={{ color: BRAND.primary }}
                  >
                    {c.garantiaLink}
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
