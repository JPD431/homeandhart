"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

function StarIcon({ className }) {
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
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.563.563 0 0 0 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    </svg>
  );
}

function CalendarIcon({ className }) {
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
        d="M6.75 3v2.25M17.25 3v2.25M4.5 8.25h15M4.5 19.5h15a1.5 1.5 0 0 0 1.5-1.5V8.25a1.5 1.5 0 0 0-1.5-1.5h-15a1.5 1.5 0 0 0-1.5 1.5v9.75a1.5 1.5 0 0 0 1.5 1.5Z"
      />
    </svg>
  );
}

function ListIcon({ className }) {
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
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
    </svg>
  );
}

const CARD_ICONS = [StarIcon, CalendarIcon, ListIcon];

export default function RetentionSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const r = t.retention;

  const cards = [
    { title: r.circulo, description: r.circulodesc, Icon: CARD_ICONS[0] },
    { title: r.recurrentes, description: r.recurrentesdesc, Icon: CARD_ICONS[1] },
    { title: r.historial, description: r.historialdesc, Icon: CARD_ICONS[2] },
  ];

  return (
    <section
      className="text-white"
      style={{
        backgroundColor: BRAND.primary,
        padding: "80px 40px",
      }}
      aria-labelledby="retention-slogan"
    >
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p
            id="retention-slogan"
            className="italic text-white"
            style={{
              fontFamily: SERIF,
              fontSize: "48px",
              letterSpacing: "-0.8px",
              lineHeight: 1.15,
            }}
          >
            {t.footer.slogan}
          </p>
          <p
            className="mx-auto mt-6 text-base leading-relaxed sm:text-lg"
            style={{
              maxWidth: "480px",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            {r.titulo}
            {lang === "es" &&
              " Somos el ecosistema que tu familia usa cada vez que lo necesita — en casa o de viaje."}
          </p>
        </header>

        <div className="mt-14 grid gap-5 md:grid-cols-3 md:gap-6">
          {cards.map((card) => {
            const { Icon } = card;
            return (
              <article
                key={card.title}
                className="border"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.07)",
                  borderColor: "rgba(255, 255, 255, 0.12)",
                  borderRadius: "18px",
                  padding: "24px",
                }}
              >
                <Icon className="h-6 w-6 text-white" />
                <h3
                  className="mt-4 text-xl text-white"
                  style={{ fontFamily: SERIF }}
                >
                  {card.title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "rgba(255, 255, 255, 0.55)" }}
                >
                  {card.description}
                </p>
              </article>
            );
          })}
        </div>

        <div
          className="mt-10 flex flex-col items-start justify-between gap-6 border sm:flex-row sm:items-center"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderRadius: "16px",
            padding: "22px 28px",
          }}
        >
          <div>
            <h3
              className="text-xl text-white sm:text-2xl"
              style={{ fontFamily: SERIF }}
            >
              {r.cta}
            </h3>
            <p
              className="mt-2 max-w-md text-sm leading-relaxed sm:text-base"
              style={{ color: "rgba(255, 255, 255, 0.6)" }}
            >
              {r.ctadesc}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-xl px-6 py-3 text-sm transition-opacity hover:opacity-90 sm:text-base"
            style={{
              backgroundColor: "#fff",
              color: BRAND.primary,
              fontWeight: 500,
            }}
          >
            {r.ctaBtn}
          </button>
        </div>
      </div>
    </section>
  );
}
