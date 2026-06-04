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
      className="fixed inset-x-0 bottom-0 z-50 border-t bg-white px-4 py-5 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] sm:px-6"
      style={{ borderColor: BRAND.border }}
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
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
        <div className="flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <button
            type="button"
            onClick={() => choose("necessary")}
            className="rounded-full border px-4 py-2 text-sm font-medium text-[#333] transition-colors hover:bg-[#f7f7f7]"
            style={{ borderColor: BRAND.border }}
          >
            Solo necesarias
          </button>
          <button
            type="button"
            onClick={() => choose("custom")}
            className="rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-[#f7f7f7]"
            style={{ borderColor: BRAND.primary, color: BRAND.primary }}
          >
            Configurar
          </button>
          <button
            type="button"
            onClick={() => choose("all")}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND.primary }}
          >
            Aceptar todas
          </button>
        </div>
      </div>
    </div>
  );
}
