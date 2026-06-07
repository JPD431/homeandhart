"use client";

import Link from "next/link";
import { SERIF } from "@/app/components/brand";

const PRIMARY = "#1d4f91";
const PRIMARY_DARK = "#163a6b";
const GREEN = "#0e7a5c";
const GREEN_DARK = "#085041";
const BORDER = "#e8e4de";
const WARM = "#f7f5f2";

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

const STEPS = [
  {
    num: 1,
    icon: "📅",
    title: "Tu proveedor cancela",
    desc: "Recibes aviso de cancelación con menos de 24 h de antelación. Activamos la garantía al instante.",
  },
  {
    num: 2,
    icon: "🔍",
    title: "Activamos la búsqueda",
    desc: "Nuestro sistema contacta a la red de emergencia verificada en tu zona y fechas.",
  },
  {
    num: 3,
    icon: "✅",
    title: "3 alternativas en 30 min",
    desc: "Te enviamos hasta 3 opciones equivalentes. Eliges y reservas sin esperar confirmación.",
  },
];

const CLIENT_CARDS = [
  {
    icon: "💰",
    title: "Precio garantizado",
    desc: "Intentamos ofrecerte alternativas con precio similar al de tu reserva original.",
  },
  {
    icon: "✅",
    title: "Mismo nivel de verificación",
    desc: "Todos los alternativos están verificados con el mismo proceso que el resto de la red.",
  },
  {
    icon: "⚡",
    title: "Reserva inmediata",
    desc: "Sin esperar confirmación del proveedor. Activa en minutos.",
  },
  {
    icon: "🤝",
    title: "Sin gestiones extra",
    desc: "Nosotros lo gestionamos todo. Tú solo eliges la alternativa.",
  },
];

const PROVIDER_BENEFITS = [
  { icon: "💶", text: "+5% sobre tu precio en reservas de emergencia" },
  { icon: "🛡️", text: "Badge especial en tu perfil" },
  { icon: "📈", text: "Más visibilidad en búsquedas prioritarias" },
  { icon: "⭐", text: "Puntos de confianza extra en tu reputación" },
];

const CITIES = [
  { name: "Madrid", active: true },
  { name: "Barcelona", active: false },
  { name: "Valencia", active: false },
  { name: "Sevilla", active: false },
  { name: "Bilbao", active: false },
];

function GarantiaNavbar() {
  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-3"
      style={{ borderColor: BORDER }}
    >
      <Link
        href="/"
        className="no-underline"
        style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "#1a1a1a" }}
      >
        Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
      </Link>
      <div className="flex flex-wrap items-center gap-5">
        <Link href="/" className="text-sm no-underline" style={{ color: "#666" }}>
          Inicio
        </Link>
        <Link href="/buscar" className="text-sm no-underline" style={{ color: "#666" }}>
          Servicios
        </Link>
        <Link
          href="/buscar"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline"
          style={{ backgroundColor: PRIMARY }}
        >
          Buscar proveedores
        </Link>
      </div>
    </nav>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span
        className="shrink-0 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: PRIMARY }}
      >
        {children}
      </span>
      <div className="h-px flex-1" style={{ backgroundColor: BORDER }} />
    </div>
  );
}

function FaqCard({ question, answer }) {
  return (
    <div
      className="rounded-xl border bg-white p-5"
      style={{ borderColor: BORDER }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-[#1a1a1a]">{question}</p>
        <span className="shrink-0 text-[#888]" aria-hidden>
          ↓
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[#666]">{answer}</p>
    </div>
  );
}

export default function GarantiaPage() {
  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#fff", color: "#1a1a1a" }}>
      <GarantiaNavbar />

      {/* Hero */}
      <section
        className="relative overflow-hidden text-center text-white"
        style={{
          padding: "64px 28px",
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
        }}
      >
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full"
          style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
        />

        <div className="relative mx-auto max-w-[640px]">
          <span
            className="inline-block text-[9px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            Solo en Home&Heart
          </span>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logoo1.png"
            alt="Home&Heart"
            style={{
              width: 120,
              height: 120,
              objectFit: "contain",
              marginBottom: 16,
              marginLeft: "auto",
              marginRight: "auto",
              marginTop: 16,
              display: "block",
            }}
          />

          <h1
            className="text-[36px] leading-tight text-white"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            Garantía{" "}
            <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.65)" }}>
              Home&Heart
            </em>
          </h1>

          <p
            className="mx-auto mt-4 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)", maxWidth: 520 }}
          >
            Si tu proveedor cancela con menos de 24 horas, activamos la red de
            emergencia y te proponemos alternativas verificadas en 30 minutos.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              "✓ Solo en Home&Heart",
              "✓ Proveedores verificados",
              "✓ En 30 minutos",
              "✓ Precio protegido",
            ].map((pill) => (
              <span
                key={pill}
                className="rounded-full px-3 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.9)",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Body */}
      <main className="mx-auto" style={{ maxWidth: 900, padding: "40px 24px" }}>
        {/* Cómo funciona */}
        <section className="mb-12">
          <SectionLabel>Cómo funciona</SectionLabel>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {STEPS.map((step, i) => (
              <div key={step.num} className="contents">
                <div
                  className="rounded-xl border bg-white p-5"
                  style={{ borderColor: BORDER }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: PRIMARY }}
                    >
                      {step.num}
                    </span>
                    <span className="text-2xl" aria-hidden>
                      {step.icon}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[#1a1a1a]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#666]">
                    {step.desc}
                  </p>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="hidden items-center justify-center text-[#ccc] md:flex"
                    aria-hidden
                  >
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Para clientes */}
        <section className="mb-12">
          <SectionLabel>Para clientes</SectionLabel>
          <h2
            className="mb-5 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            Tu tranquilidad está protegida
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CLIENT_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border bg-white p-5"
                style={{ borderColor: BORDER }}
              >
                <span className="text-2xl" aria-hidden>
                  {card.icon}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-[#1a1a1a]">
                  {card.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#666]">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Para proveedores */}
        <section className="mb-12">
          <SectionLabel>Para proveedores</SectionLabel>
          <div
            className="rounded-xl p-6 text-white sm:p-8"
            style={{
              borderRadius: 12,
              background: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
            }}
          >
            <h2
              className="text-xl"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              Únete a la red de emergencia
            </h2>
            <p className="mt-2 text-sm text-white/70">
              Activa tu badge y recibe reservas prioritarias cuando un proveedor
              cancela en tu zona.
            </p>
            <Link
              href="/editar-perfil"
              className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold no-underline"
              style={{ color: GREEN }}
            >
              Activar mi badge →
            </Link>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PROVIDER_BENEFITS.map((b) => (
                <div key={b.text} className="flex items-start gap-3">
                  <span className="text-lg" aria-hidden>
                    {b.icon}
                  </span>
                  <p className="text-sm text-white/90">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cobertura */}
        <section className="mb-12">
          <SectionLabel>Cobertura</SectionLabel>
          <h2
            className="mb-4 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            Ciudades disponibles
          </h2>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((city) => (
              <span
                key={city.name}
                className="rounded-full border px-4 py-2 text-sm font-medium"
                style={
                  city.active
                    ? {
                        backgroundColor: "#e8f0fb",
                        borderColor: PRIMARY,
                        color: PRIMARY,
                      }
                    : {
                        backgroundColor: "#f3f4f6",
                        borderColor: BORDER,
                        color: "#999",
                      }
                }
              >
                {city.name}
                {!city.active && (
                  <span className="ml-1.5 text-[10px] font-normal">· Próximamente</span>
                )}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[#666]">
            La Garantía Home&Heart está operativa en Madrid. Estamos ampliando
            cobertura a más ciudades. Las reservas fuera de zona activa no
            incluyen sustitución automática, pero sí el resto de protecciones de
            la plataforma.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <SectionLabel>Preguntas frecuentes</SectionLabel>
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((item) => (
              <FaqCard key={item.q} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        {/* CTA final */}
        <section
          className="rounded-xl px-6 py-10 text-center"
          style={{ backgroundColor: WARM }}
        >
          <h2
            className="text-2xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            ¿Listo para reservar con tranquilidad?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#666]">
            Encuentra proveedores verificados con la Garantía Home&Heart activa
            en cada reserva.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/buscar"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white no-underline"
              style={{ backgroundColor: PRIMARY }}
            >
              Buscar proveedores verificados →
            </Link>
            <Link
              href="/editar-perfil"
              className="rounded-lg border px-6 py-3 text-sm font-semibold no-underline"
              style={{ borderColor: PRIMARY, color: PRIMARY, backgroundColor: "#fff" }}
            >
              Ser proveedor de emergencia
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
