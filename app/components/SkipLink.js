"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const TARGET_ID = "contenido";

/**
 * Primer elemento enfocable del <body> (WCAG 2.4.1). Apunta a <main id="contenido">;
 * si una página aún no define ese id, usa el primer <main id="contenido"> y se lo asigna.
 */
export default function SkipLink() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  function handleClick(e) {
    const target =
      document.getElementById(TARGET_ID) ?? document.querySelector("main");
    if (!target) return;
    e.preventDefault();
    if (!target.id) target.id = TARGET_ID;
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
    target.scrollIntoView();
  }

  return (
    <a
      href={`#${TARGET_ID}`}
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-[#1d4f91] focus:shadow-lg"
    >
      {t.a11y.skip}
    </a>
  );
}
