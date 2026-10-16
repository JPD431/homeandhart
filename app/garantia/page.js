"use client";

import Link from "next/link";
import { SERIF } from "@/app/components/brand";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const PRIMARY = "#1d4f91";
const PRIMARY_DARK = "#163a6b";
const GREEN = "#0e7a5c";
const GREEN_DARK = "#085041";
const BORDER = "#e8e4de";
const WARM = "#f7f5f2";

const CITIES = [
  { name: "Madrid", active: true },
  { name: "Barcelona", active: false },
  { name: "Valencia", active: false },
  { name: "Sevilla", active: false },
  { name: "Bilbao", active: false },
];

function GarantiaNavbar() {
  const { lang } = useLang();
  const t = useTranslation(lang);

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
          {t.garantia.navInicio}
        </Link>
        <Link href="/buscar" className="text-sm no-underline" style={{ color: "#666" }}>
          {t.garantia.navServicios}
        </Link>
        <Link
          href="/buscar"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white no-underline"
          style={{ backgroundColor: PRIMARY }}
        >
          {t.garantia.navBuscar}
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
  const { lang } = useLang();
  const t = useTranslation(lang);

  const steps = [
    { num: 1, icon: "📅", title: t.garantia.step1Titulo, desc: t.garantia.step1Desc },
    { num: 2, icon: "🔍", title: t.garantia.step2Titulo, desc: t.garantia.step2Desc },
    { num: 3, icon: "✅", title: t.garantia.step3Titulo, desc: t.garantia.step3Desc },
  ];

  const clientCards = [
    { icon: "💰", title: t.garantia.card1Titulo, desc: t.garantia.card1Desc },
    { icon: "✅", title: t.garantia.card2Titulo, desc: t.garantia.card2Desc },
    { icon: "⚡", title: t.garantia.card3Titulo, desc: t.garantia.card3Desc },
    { icon: "🤝", title: t.garantia.card4Titulo, desc: t.garantia.card4Desc },
  ];

  const providerBenefits = [
    { icon: "💶", text: t.garantia.benefit1 },
    { icon: "🛡️", text: t.garantia.benefit2 },
    { icon: "📈", text: t.garantia.benefit3 },
    { icon: "⭐", text: t.garantia.benefit4 },
  ];

  const faqItems = [
    { q: t.garantia.faq1Q, a: t.garantia.faq1A },
    { q: t.garantia.faq2Q, a: t.garantia.faq2A },
    { q: t.garantia.faq3Q, a: t.garantia.faq3A },
    { q: t.garantia.faq4Q, a: t.garantia.faq4A },
  ];

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
            {t.garantia.soloEn}
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
            {t.garantia.heroTitulo}{" "}
            <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.65)" }}>
              Home&Heart
            </em>
          </h1>

          <p
            className="mx-auto mt-4 text-[15px] leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)", maxWidth: 520 }}
          >
            {t.garantia.heroDesc}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {[
              t.garantia.pill1,
              t.garantia.pill2,
              t.garantia.pill3,
              t.garantia.pill4,
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
          <SectionLabel>{t.garantia.labelComoFunciona}</SectionLabel>
          <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
            {steps.map((step, i) => (
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
                {i < steps.length - 1 && (
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
          <SectionLabel>{t.garantia.labelParaClientes}</SectionLabel>
          <h2
            className="mb-5 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t.garantia.clientesTitulo}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {clientCards.map((card) => (
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
          <SectionLabel>{t.garantia.labelParaProveedores}</SectionLabel>
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
              {t.garantia.proveedoresTitulo}
            </h2>
            <p className="mt-2 text-sm text-white/70">
              {t.garantia.proveedoresDesc}
            </p>
            <Link
              href="/editar-perfil"
              className="mt-5 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold no-underline"
              style={{ color: GREEN }}
            >
              {t.garantia.activarBadge}
            </Link>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {providerBenefits.map((b) => (
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
          <SectionLabel>{t.garantia.labelCobertura}</SectionLabel>
          <h2
            className="mb-4 text-xl text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontWeight: 300 }}
          >
            {t.garantia.ciudadesTitulo}
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
                  <span className="ml-1.5 text-[10px] font-normal">· {t.garantia.proximamente}</span>
                )}
              </span>
            ))}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[#666]">
            {t.garantia.coberturaTexto}
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <SectionLabel>{t.garantia.labelFaq}</SectionLabel>
          <div className="flex flex-col gap-3">
            {faqItems.map((item) => (
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
            {t.garantia.ctaTitulo}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#666]">
            {t.garantia.ctaDesc}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/buscar"
              className="rounded-lg px-6 py-3 text-sm font-semibold text-white no-underline"
              style={{ backgroundColor: PRIMARY }}
            >
              {t.garantia.ctaBuscar}
            </Link>
            <Link
              href="/editar-perfil"
              className="rounded-lg border px-6 py-3 text-sm font-semibold no-underline"
              style={{ borderColor: PRIMARY, color: PRIMARY, backgroundColor: "#fff" }}
            >
              {t.garantia.ctaProveedor}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
