"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

const FEATURE_ICONS = [LockIcon, RectanglesIcon, CheckBadgeIcon];

const COMPARISON_ROWS = [
  { before: "Un sitio para el alojamiento", after: "Todo en H&H" },
  { before: "Otro sitio para la mascota", after: "Un solo buscador" },
  { before: "Grupos para encontrar niñera", after: "Perfiles verificados" },
  { before: "Varios pagos sin garantía", after: "1 pago protegido" },
];

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

function RectanglesIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <rect x="4" y="5" width="7" height="14" rx="1.5" />
      <rect x="13" y="5" width="7" height="14" rx="1.5" />
    </svg>
  );
}

function CheckBadgeIcon({ className }) {
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
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function HomeIcon({ className }) {
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
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function PersonIcon({ className }) {
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
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function PetIcon({ className }) {
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
        d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 11.25a8.966 8.966 0 0 0-3.525-1.462A9.01 9.01 0 0 0 12 9.75c-2.37 0-4.515.92-6.12 2.413A8.966 8.966 0 0 0 3 11.25M15.75 9.75a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM6.75 6.75a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM19.5 6.75a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

function SmallCheckIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-7.5"
      />
    </svg>
  );
}

function CircleCheckIcon({ className }) {
  return (
    <svg
      className={className}
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
  );
}

function BookingLineItem({
  Icon,
  name,
  detail,
  tag,
  price,
}) {
  return (
    <div className="flex items-start gap-3 border-b py-4 last:border-b-0" style={{ borderColor: BRAND.border }}>
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[#1d4f91]"
        style={{ backgroundColor: BRAND.light }}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#1a1a1a]">{name}</p>
        <p className="mt-0.5 text-xs text-[#888]">{detail}</p>
        <span
          className="mt-2 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
        >
          {tag}
        </span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <p className="text-sm font-semibold text-[#1a1a1a]">{price}</p>
        <CircleCheckIcon className="h-5 w-5 text-[#1d4f91]" />
      </div>
    </div>
  );
}

export default function CheckoutSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const c = t.checkout;

  const features = [
    { title: c.beneficio1, description: c.beneficio1desc, Icon: FEATURE_ICONS[0] },
    { title: c.beneficio2, description: c.beneficio2desc, Icon: FEATURE_ICONS[1] },
    { title: c.beneficio3, description: c.beneficio3desc, Icon: FEATURE_ICONS[2] },
  ];

  return (
    <section
      className="bg-white text-[#1a1a1a]"
      style={{ padding: "80px 40px" }}
      aria-labelledby="checkout-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            {t.checkout.label}
          </p>
          <h2
            id="checkout-heading"
            className="mt-4 text-3xl leading-snug sm:text-4xl lg:text-[2.5rem]"
            style={{ fontFamily: SERIF }}
          >
            <span className="italic" style={{ color: BRAND.primary }}>
              {t.checkout.titulo}
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-[#5c5c5c] sm:text-lg">
            {c.subtitulo}
          </p>
        </header>

        <div
          className="mt-14 grid lg:grid-cols-2"
          style={{ gap: "56px" }}
        >
          {/* Columna izquierda */}
          <div>
            <ul className="flex flex-col gap-6">
              {features.map((feature) => {
                const { Icon } = feature;
                return (
                  <li key={feature.title} className="flex gap-4">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#1d4f91]"
                      style={{ backgroundColor: BRAND.light }}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[#1a1a1a]">
                        {feature.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[#5c5c5c]">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div
              className="mt-8"
              style={{
                backgroundColor: BRAND.warm,
                borderRadius: "13px",
                padding: "18px",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#888]">
                {c.antesAhora}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {COMPARISON_ROWS.map((row) => (
                  <li
                    key={row.before}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <span className="text-[#999] line-through decoration-[#ccc]">
                      {row.before}
                    </span>
                    <span className="text-[#bbb]" aria-hidden>
                      →
                    </span>
                    <span
                      className="font-bold"
                      style={{ color: BRAND.primary }}
                    >
                      {row.after}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Columna derecha — panel de reserva */}
          <div
            className="overflow-hidden border"
            style={{ borderColor: BRAND.border, borderRadius: "22px" }}
          >
            <div
              className="px-5 py-5 sm:px-6"
              style={{ backgroundColor: BRAND.primary }}
            >
              <h3
                className="text-lg text-white sm:text-xl"
                style={{ fontFamily: SERIF }}
              >
                Tu reserva · Madrid · 15–18 jul
              </h3>
              <p
                className="mt-1 text-sm"
                style={{ color: "rgba(255, 255, 255, 0.65)" }}
              >
                3 servicios · 1 pago
              </p>
            </div>

            <div style={{ padding: "20px" }}>
              <div
                className="flex items-center gap-2.5 px-3 py-2.5"
                style={{
                  backgroundColor: BRAND.light,
                  borderRadius: "9px",
                }}
              >
                <SmallCheckIcon className="h-4 w-4 shrink-0 text-[#1d4f91]" />
                <p className="text-xs font-medium text-[#1d4f91] sm:text-sm">
                  Disponibilidad confirmada para estas fechas
                </p>
              </div>

              <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
                Alojamiento
              </p>
              <BookingLineItem
                Icon={HomeIcon}
                name="Apartamento Salamanca · 3 noches"
                detail="Ana P. · NRU registrado"
                tag="Pet-friendly · Verified"
                price="210€"
              />

              <p className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-wider text-[#888]">
                Servicios de cuidado
              </p>
              <BookingLineItem
                Icon={PersonIcon}
                name="Niñera · sábado tarde (4h)"
                detail="Sara R. · Certificada"
                tag="English native"
                price="80€"
              />
              <BookingLineItem
                Icon={PetIcon}
                name="Cuidador mascota · 2 días"
                detail="Miguel L. · Paseos incluidos"
                tag="English fluent"
                price="70€"
              />

              <div
                className="mt-5 flex items-end justify-between border-t pt-5"
                style={{ borderColor: BRAND.border }}
              >
                <div>
                  <p className="text-sm text-[#888]">Total</p>
                  <p className="mt-0.5 text-xs text-[#999]">
                    Un único pago · distribuido automáticamente
                  </p>
                </div>
                <p
                  className="text-2xl font-semibold text-[#1a1a1a]"
                  style={{ fontFamily: SERIF }}
                >
                  360€
                </p>
              </div>

              <button
                type="button"
                className="mt-5 w-full py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: BRAND.primary,
                  borderRadius: "12px",
                }}
              >
                {c.reservar}
              </button>

              <p className="mt-4 text-center text-[11px] text-[#888]">
                {c.pagoRetenido}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
