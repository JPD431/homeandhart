"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";

function LodgingIcon({ className }) {
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

function ChildcareIcon({ className }) {
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
        d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
      />
    </svg>
  );
}

function PetCareIcon({ className }) {
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

const ECOSYSTEM = [
  {
    titleKey: "alojamiento",
    descKey: "alojDesc",
    items: [
      "Pet-friendly disponible",
      "NRU verificado",
      "Check-in flexible",
    ],
    Icon: LodgingIcon,
  },
  {
    titleKey: "ninos",
    descKey: "ninosDesc",
    items: [
      "Antecedentes verificados",
      "Idiomas indicados",
      "Por horas o días",
    ],
    Icon: ChildcareIcon,
  },
  {
    titleKey: "mascotas",
    descKey: "mascotasDesc",
    items: [
      "Paseos incluidos",
      "Fotos y actualizaciones",
      "Cobertura veterinaria",
    ],
    Icon: PetCareIcon,
  },
];

export default function EcosystemSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const e = t.ecosystem;

  return (
    <section
      className="px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-8 lg:py-24"
      style={{ backgroundColor: BRAND.primary }}
      aria-labelledby="ecosystem-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-end lg:gap-12">
          <div>
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              {t.ecosystem.label}
            </p>
            <h2
              id="ecosystem-heading"
              className="mt-4 text-2xl leading-snug text-white sm:text-3xl lg:text-4xl xl:text-[2.5rem] xl:leading-tight"
              style={{ fontFamily: SERIF }}
            >
              {t.ecosystem.titulo}
            </h2>
          </div>
          <p
            className="text-base leading-relaxed sm:text-lg lg:pb-1"
            style={{ color: "rgba(255, 255, 255, 0.6)" }}
          >
            {t.ecosystem.subtitulo}
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6 lg:mt-14">
          {ECOSYSTEM.map((service) => {
            const { Icon } = service;
            const title =
              t.footer[service.titleKey] || t.hero[service.titleKey];
            return (
              <article
                key={service.titleKey}
                className="flex flex-col rounded-2xl border border-[rgba(255,255,255,0.25)] bg-[rgba(255,255,255,0.15)] p-7 transition-colors duration-300 hover:bg-[rgba(255,255,255,0.12)]"
              >
                <span
                  className="inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.12)",
                    color: "rgba(255, 255, 255, 0.7)",
                  }}
                >
                  {e.disponible}
                </span>
                <span className="mt-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(255,255,255,0.1)] text-white">
                  <Icon className="h-6 w-6" />
                </span>
                <h3
                  className="mt-4 text-xl text-white sm:text-2xl"
                  style={{ fontFamily: SERIF }}
                >
                  {title}
                </h3>
                <p
                  className="mt-2 text-sm leading-relaxed sm:text-base"
                  style={{ color: "rgba(255, 255, 255, 0.6)" }}
                >
                  {e[service.descKey]}
                </p>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {service.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2.5 text-sm sm:text-[15px]"
                      style={{ color: "rgba(255, 255, 255, 0.8)" }}
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(255,255,255,0.4)]"
                        aria-hidden
                      />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
