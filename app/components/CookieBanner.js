"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";
import {
  COOKIE_NOTICE_STORAGE_KEY,
  COOKIE_NOTICE_VERSION,
} from "@/app/lib/cookie-notice";

function hasAcceptedCurrentNotice() {
  try {
    const raw = localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY);
    if (!raw) return false;

    // Formato nuevo: JSON con versión
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return parsed?.version === COOKIE_NOTICE_VERSION && parsed?.accepted === true;
    }

    // Formato antiguo (necessary/custom/all): pedir aceptación del aviso actualizado
    return false;
  } catch {
    return false;
  }
}

function saveAcceptedNotice() {
  try {
    localStorage.setItem(
      COOKIE_NOTICE_STORAGE_KEY,
      JSON.stringify({
        accepted: true,
        version: COOKIE_NOTICE_VERSION,
        accepted_at: new Date().toISOString(),
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      setVisible(!hasAcceptedCurrentNotice());
    } catch {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    saveAcceptedNotice();
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
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <p
            id="cookie-banner-title"
            className="text-sm font-semibold text-[#1a1a1a]"
          >
            Cookies y servicios necesarios
          </p>
          <p
            id="cookie-banner-desc"
            className="mt-1 text-sm leading-relaxed text-[#5c5c5c]"
          >
            Usamos cookies y almacenamiento esenciales para que la plataforma
            funcione (sesión de inicio de sesión y preferencias). También
            cargamos servicios de terceros solo cuando hace falta:{" "}
            <strong className="font-medium text-[#444]">Stripe</strong> para
            procesar pagos al reservar, y{" "}
            <strong className="font-medium text-[#444]">Mapbox</strong> para
            mostrar mapas al buscar. No usamos cookies de publicidad ni
            herramientas de seguimiento o analytics de terceros.{" "}
            <Link
              href="/legal/cookies"
              className="font-medium underline underline-offset-2"
              style={{ color: BRAND.primary }}
            >
              Política de cookies
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link
            href="/legal/cookies"
            className="flex min-h-[44px] w-full items-center justify-center rounded-full border px-4 py-2 text-center text-sm font-medium no-underline transition-colors hover:bg-[#f7f7f7] sm:w-auto"
            style={{ borderColor: BRAND.border, color: BRAND.primary }}
          >
            Más información
          </Link>
          <button
            type="button"
            onClick={handleAccept}
            className="min-h-[44px] w-full rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            style={{ backgroundColor: BRAND.primary }}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
}
