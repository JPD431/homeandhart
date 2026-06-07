"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";

const STORAGE_KEY = "cookie_consent";

function saveConsent(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota / private mode */
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function choose(value) {
    saveConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-0 z-50 border-t bg-white px-4 py-5 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]"
      style={{
        borderColor: BRAND.border,
        left: 0,
        right: 0,
        width: "100%",
        maxWidth: "100vw",
        boxSizing: "border-box",
      }}
    >
      <div className="mx-auto flex max-w-5xl flex-col flex-wrap gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p
            id="cookie-banner-title"
            className="text-sm font-semibold text-[#1a1a1a]"
          >
            Cookies
          </p>
          <p
            id="cookie-banner-desc"
            className="mt-1 text-sm leading-relaxed text-[#5c5c5c]"
          >
            Usamos cookies propias y de terceros para mejorar tu experiencia.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => choose("necessary")}
            className="w-full rounded-full border px-4 py-2 text-sm font-medium text-[#333] transition-colors hover:bg-[#f7f7f7] sm:w-auto"
            style={{ borderColor: BRAND.border }}
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={() => choose("custom")}
            className="w-full rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#f7f7f7] sm:w-auto"
            style={{ borderColor: BRAND.primary, color: BRAND.primary }}
          >
            Configurar
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            style={{ backgroundColor: BRAND.primary }}
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
