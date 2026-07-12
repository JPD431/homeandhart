"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND, SERIF } from "./brand";
import {
  ChildcareIcon,
  LodgingIcon,
  PetIcon,
} from "./vertical-icons";

const ECOSYSTEM = [
  {
    titleKey: "alojamiento",
    descKey: "alojDesc",
    itemKeys: ["aloj1", "aloj2", "aloj3"],
    Icon: LodgingIcon,
  },
  {
    titleKey: "ninos",
    descKey: "ninosDesc",
    itemKeys: ["ninos1", "ninos2", "ninos3"],
    Icon: ChildcareIcon,
  },
  {
    titleKey: "mascotas",
    descKey: "mascotasDesc",
    itemKeys: ["masc1", "masc2", "masc3"],
    Icon: PetIcon,
  },
];

export default function EcosystemSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const e = t.ecosystem;

  return (
    <section
      id="como-funciona"
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
                  {service.itemKeys.map((key) => (
                    <li
                      key={key}
                      className="flex items-start gap-2.5 text-sm sm:text-[15px]"
                      style={{ color: "rgba(255, 255, 255, 0.8)" }}
                    >
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[rgba(255,255,255,0.4)]"
                        aria-hidden
                      />
                      {e[key]}
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
