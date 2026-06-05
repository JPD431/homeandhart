"use client";

import Link from "next/link";
import { useState } from "react";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { BRAND, SERIF } from "@/app/components/brand";

const FAQ_ITEMS = [
  {
    q: "¿Qué pasa si no hay alternativas disponibles?",
    a: "Si en 30 minutos no encontramos proveedores verificados disponibles, te reembolsamos el importe íntegro de tu reserva y te ayudamos a buscar manualmente. La garantía cubre el intento activo de sustitución.",
  },
  {
    q: "¿La garantía aplica a los 3 servicios?",
    a: "Sí. La Garantía Home&Heart está disponible para alojamiento, cuidado de niños y cuidado de mascotas, siempre que la reserva original incluyera la garantía al confirmar.",
  },
  {
    q: "¿Qué penalización tiene el proveedor que cancela?",
    a: "Las cancelaciones con menos de 24 horas de antelación afectan la valoración del proveedor y pueden suponer penalización en visibilidad. En casos reiterados, revisamos su permanencia en la plataforma.",
  },
  {
    q: "¿Cómo sé que los alternativos son de confianza?",
    a: "Todos los proveedores alternativos pasan el mismo proceso de verificación que el resto de la red Home&Heart: identidad, referencias y reseñas verificadas. Solo proponemos perfiles con el mismo nivel de confianza.",
  },
];

function CalendarCancelIcon() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
      <svg
        className="h-8 w-8 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
        />
      </svg>
      <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
        ✕
      </span>
    </div>
  );
}

function SearchAnimatedIcon() {
  return (
    <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e8f0fb]">
      <span
        className="absolute inset-0 rounded-2xl border-2 border-[#1d4f91]/30 animate-ping"
        style={{ animationDuration: "2s" }}
        aria-hidden
      />
      <svg
        className="relative h-8 w-8 text-[#1d4f91] animate-pulse"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>
    </div>
  );
}

function CheckIcon() {
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50">
      <svg
        className="h-8 w-8 text-emerald-600"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        />
      </svg>
    </div>
  );
}

function MadridMap() {
  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border bg-[#f7f5f2] p-6"
      style={{ borderColor: BRAND.border }}
    >
      <svg viewBox="0 0 320 280" className="h-auto w-full" aria-label="Mapa de cobertura en Madrid">
        <rect width="320" height="280" fill="#e8f0fb" rx="12" />
        <path
          d="M40 200 Q80 120 140 100 Q200 80 260 110 Q290 130 280 180 Q250 230 180 240 Q100 250 50 220 Z"
          fill="#d4e4f7"
          stroke="#1d4f91"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />
        <circle cx="155" cy="155" r="28" fill="#1d4f91" fillOpacity="0.15" />
        <circle cx="155" cy="155" r="8" fill="#1d4f91" />
        <circle cx="155" cy="155" r="14" fill="none" stroke="#1d4f91" strokeWidth="2" strokeOpacity="0.5">
          <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <text x="155" y="195" textAnchor="middle" className="fill-[#1d4f91] text-[13px] font-semibold" style={{ fontFamily: "system-ui" }}>
          Madrid
        </text>
        <circle cx="95" cy="115" r="4" fill="#cbd5e1" />
        <circle cx="210" cy="125" r="4" fill="#cbd5e1" />
        <circle cx="230" cy="195" r="4" fill="#cbd5e1" />
        <text x="95" y="105" textAnchor="middle" className="fill-[#94a3b8] text-[9px]" style={{ fontFamily: "system-ui" }}>
          BCN
        </text>
        <text x="210" y="115" textAnchor="middle" className="fill-[#94a3b8] text-[9px]" style={{ fontFamily: "system-ui" }}>
          VLC
        </text>
        <text x="230" y="215" textAnchor="middle" className="fill-[#94a3b8] text-[9px]" style={{ fontFamily: "system-ui" }}>
          SEV
        </text>
      </svg>
    </div>
  );
}

function FaqItem({ question, answer, isOpen, onToggle }) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-white transition-shadow hover:shadow-sm"
      style={{ borderColor: BRAND.border }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={isOpen}
      >
        <span className="text-sm font-semibold text-[#111] sm:text-base">{question}</span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-light transition-transform duration-200"
          style={{
            backgroundColor: BRAND.light,
            color: BRAND.primary,
            transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
          }}
          aria-hidden
        >
          +
        </span>
      </button>
      {isOpen && (
        <div className="border-t px-5 pb-4 pt-3" style={{ borderColor: BRAND.border }}>
          <p className="text-sm leading-relaxed text-[#5c5c5c]">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function GarantiaPage() {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      {/* Header */}
      <section
        className="relative overflow-hidden px-4 py-16 text-center text-white sm:px-6 sm:py-20 lg:py-24"
        style={{ backgroundColor: "#1d4f91" }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-3xl">
          <span className="text-6xl sm:text-7xl" role="img" aria-label="Escudo">
            🛡️
          </span>
          <h1
            className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
            style={{ fontFamily: SERIF }}
          >
            Garantía Home&Heart
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-white/90 sm:text-lg">
            Si algo falla, lo resolvemos en menos de 30 minutos
          </p>
        </div>
      </section>

      <main className="flex-1">
        {/* Sección 1 — ¿Qué es? */}
        <section className="px-4 py-14 sm:px-6 lg:py-20" style={{ backgroundColor: BRAND.warm }}>
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              ¿Qué es la Garantía?
            </h2>
            <p className="mt-5 text-base leading-relaxed text-[#444] sm:text-lg">
              Somos el primer marketplace en España que garantiza una alternativa
              verificada si tu proveedor cancela con menos de 24 horas de
              antelación.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {["Solo en Home&Heart", "Verificados", "En 30 minutos"].map((pill) => (
                <span
                  key={pill}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
                  style={{ backgroundColor: BRAND.primary }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Sección 2 — Cómo funciona */}
        <section className="px-4 py-14 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-5xl">
            <h2
              className="text-center text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Cómo funciona
            </h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
              {[
                {
                  num: "01",
                  icon: <CalendarCancelIcon />,
                  title: "Tu proveedor cancela",
                  desc: "Recibes aviso de cancelación con menos de 24 h de antelación. Activamos la garantía al instante.",
                },
                {
                  num: "02",
                  icon: <SearchAnimatedIcon />,
                  title: "Activamos la búsqueda",
                  desc: "Nuestro sistema contacta a la red de emergencia verificada en tu zona y fechas.",
                },
                {
                  num: "03",
                  icon: <CheckIcon />,
                  title: "Recibes 3 alternativas en 30 minutos",
                  desc: "Te enviamos hasta 3 opciones equivalentes. Eliges y reservas sin esperar confirmación.",
                },
              ].map((step, i) => (
                <div key={step.num} className="relative flex flex-col items-center text-center">
                  {i < 2 && (
                    <div
                      className="absolute left-[calc(50%+4rem)] top-8 hidden h-0.5 w-[calc(100%-8rem)] md:block"
                      style={{ backgroundColor: BRAND.border }}
                      aria-hidden
                    />
                  )}
                  <span
                    className="text-4xl font-bold tracking-tight"
                    style={{ color: BRAND.light, WebkitTextStroke: `1px ${BRAND.primary}` }}
                  >
                    {step.num}
                  </span>
                  <div className="mt-4">{step.icon}</div>
                  <h3 className="mt-5 text-lg font-semibold text-[#111]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sección 3 — Para clientes */}
        <section className="px-4 py-14 sm:px-6 lg:py-20" style={{ backgroundColor: BRAND.warm }}>
          <div className="mx-auto max-w-5xl">
            <h2
              className="text-center text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Tu tranquilidad está protegida
            </h2>
            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {[
                {
                  emoji: "💰",
                  title: "Precio garantizado",
                  desc: "Intentamos ofrecerte alternativas con precio similar al de tu reserva original. El precio final puede variar según disponibilidad.",
                },
                {
                  emoji: "✅",
                  title: "Mismo nivel de verificación",
                  desc: "Todos los alternativos están verificados.",
                },
                {
                  emoji: "⚡",
                  title: "Reserva inmediata",
                  desc: "Sin esperar confirmación del proveedor.",
                },
                {
                  emoji: "🤝",
                  title: "Sin gestiones extra",
                  desc: "Nosotros lo gestionamos todo.",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                  style={{ borderColor: BRAND.border }}
                >
                  <span className="text-3xl" role="img" aria-hidden>
                    {card.emoji}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-[#111]">{card.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666]">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sección 4 — Para proveedores */}
        <section className="px-4 py-14 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Únete a la red de emergencia
            </h2>
            <ul className="mt-8 space-y-4 text-left sm:mx-auto sm:max-w-md">
              {[
                "+5% sobre tu precio en reservas de emergencia",
                "Badge especial 🛡️ en tu perfil",
                "Más visibilidad en búsquedas prioritarias",
                "Puntos de confianza extra en tu reputación",
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-[#444] sm:text-base">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: BRAND.primary }}
                    aria-hidden
                  >
                    ✓
                  </span>
                  {benefit}
                </li>
              ))}
            </ul>
            <Link
              href="/editar-perfil"
              className="mt-8 inline-block rounded-xl px-8 py-3.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Activar mi badge de emergencia
            </Link>
          </div>
        </section>

        {/* Sección 5 — Cobertura */}
        <section className="px-4 py-14 sm:px-6 lg:py-20" style={{ backgroundColor: BRAND.warm }}>
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Cobertura actual
            </h2>
            <p className="mt-4 text-base text-[#444] sm:text-lg">
              Actualmente disponible en{" "}
              <strong className="text-[#1d4f91]">Madrid</strong>
            </p>
            <div className="mt-8">
              <MadridMap />
            </div>
            <p className="mt-6 text-sm text-[#888]">
              Próximamente:{" "}
              <span className="font-medium text-[#444]">Barcelona, Valencia, Sevilla</span>
            </p>
          </div>
        </section>

        {/* Sección 6 — FAQ */}
        <section className="px-4 py-14 sm:px-6 lg:py-20">
          <div className="mx-auto max-w-2xl">
            <h2
              className="text-center text-2xl font-semibold text-[#111] sm:text-3xl"
              style={{ fontFamily: SERIF }}
            >
              Preguntas frecuentes
            </h2>
            <div className="mt-10 space-y-3">
              {FAQ_ITEMS.map((item, i) => (
                <FaqItem
                  key={item.q}
                  question={item.q}
                  answer={item.a}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Footer CTA */}
        <section
          className="px-4 py-14 text-center sm:px-6"
          style={{ backgroundColor: BRAND.primary }}
        >
          <div className="mx-auto max-w-xl">
            <p className="text-lg font-medium text-white/90 sm:text-xl">
              ¿Listo para reservar con tranquilidad?
            </p>
            <Link
              href="/buscar"
              className="mt-6 inline-block rounded-xl bg-white px-8 py-3.5 text-sm font-semibold no-underline transition-opacity hover:opacity-90"
              style={{ color: BRAND.primary }}
            >
              Buscar proveedores con Garantía
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
