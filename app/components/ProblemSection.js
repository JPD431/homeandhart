"use client";

import { useState } from "react";
import { BRAND, SERIF } from "./brand";

function FamilyTripIcon({ className }) {
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
        d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 21v-4.5c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

function CityIcon({ className }) {
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
        d="M2.25 21h19.5M3.75 21V9.75m0 0h16.5M3.75 9.75 12 3l8.25 6.75M9.75 21v-6h4.5v6"
      />
    </svg>
  );
}

function GlobeIcon({ className }) {
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
        d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.558"
      />
    </svg>
  );
}

const SITUATIONS = [
  {
    id: 0,
    number: "01",
    title: "Viaje en familia",
    phrase: "Tres necesidades, tres mundos distintos — y tú en el centro.",
    antes:
      "Una web para el alojamiento. Otra para la mascota. Otra para la niñera. 3 webs, 3 pagos, 0 coordinación.",
    conHH:
      "Una sola plataforma. Un buscador, un checkout, todo coordinado.",
    Icon: FamilyTripIcon,
  },
  {
    id: 1,
    number: "02",
    title: "En tu ciudad",
    phrase: "Cuando lo urgente es encontrar a alguien de confianza cerca.",
    antes:
      "Grupos de WhatsApp, recomendaciones de conocidos, perfiles sin verificar.",
    conHH:
      "Perfil verificado, antecedentes comprobados, pago protegido. Hoy mismo.",
    Icon: CityIcon,
  },
  {
    id: 2,
    number: "03",
    title: "Turista internacional",
    phrase: "Llegar sin red local y sin saber por dónde empezar.",
    antes:
      "Búsquedas interminables. Reseñas sin verificar. Sin saber si hablan tu idioma.",
    conHH:
      "Todo verificado. Idiomas indicados. Un solo lugar de confianza.",
    Icon: GlobeIcon,
  },
];

export default function ProblemSection() {
  const [activeSituation, setActiveSituation] = useState(0);

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
          el problema que resolvemos
        </p>
        <h2
          id="problem-heading"
          className="mt-4 text-center text-2xl leading-snug text-[#1a1a1a] sm:text-3xl lg:text-4xl"
          style={{ fontFamily: SERIF }}
        >
          ¿Te suena alguna de estas situaciones?
        </h2>
        <p
          className="mx-auto mt-3 max-w-lg text-center text-base italic text-[#777] sm:text-lg"
          style={{ fontFamily: SERIF }}
        >
          Hasta ahora no existía una solución. Ahora sí.
        </p>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
          {SITUATIONS.map((situation) => {
            const isActive = activeSituation === situation.id;
            const { Icon } = situation;
            return (
              <button
                key={situation.id}
                type="button"
                onClick={() => setActiveSituation(situation.id)}
                className="flex w-full flex-col rounded-2xl border bg-white p-6 text-left transition-all duration-200 sm:p-7"
                style={{
                  borderColor: isActive ? BRAND.primary : BRAND.border,
                  boxShadow: isActive
                    ? "0 8px 30px rgba(29, 79, 145, 0.12)"
                    : "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="text-xs font-medium tabular-nums tracking-widest"
                    style={{ color: isActive ? BRAND.primary : "#aaa" }}
                  >
                    {situation.number}
                  </span>
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl"
                    style={{
                      backgroundColor: isActive ? BRAND.light : BRAND.warm,
                      color: BRAND.primary,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#888] sm:text-[11px]">
                  {situation.title}
                </p>
                <p
                  className="mt-2 text-base leading-relaxed text-[#333] sm:text-lg"
                  style={{ fontFamily: SERIF, fontStyle: "italic" }}
                >
                  {situation.phrase}
                </p>
                <div className="mt-6">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[#aaa]">
                    Antes
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#999] line-through decoration-[#ccc]">
                    {situation.antes}
                  </p>
                </div>
                {isActive && (
                  <div
                    className="mt-5 rounded-xl px-4 py-3.5"
                    style={{ backgroundColor: BRAND.light }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider"
                      style={{ color: BRAND.primary }}
                    >
                      Con Home&Heart
                    </p>
                    <p
                      className="mt-1.5 text-sm leading-relaxed"
                      style={{ color: BRAND.primary }}
                    >
                      {situation.conHH}
                    </p>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div
          className="mt-12 flex flex-col items-center justify-between gap-6 rounded-2xl border bg-white px-6 py-8 sm:flex-row sm:px-10 sm:py-9"
          style={{ borderColor: BRAND.border }}
        >
          <p
            className="text-center text-lg text-[#1a1a1a] sm:text-left sm:text-xl"
            style={{ fontFamily: SERIF }}
          >
            ¿Te identificas? Ya puedes resolverlo.
          </p>
          <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Reservar ahora
            </button>
            <button
              type="button"
              className="rounded-lg px-6 py-3 text-sm font-medium text-[#666] transition-colors hover:text-[#1d4f91]"
            >
              Ver cómo funciona →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
