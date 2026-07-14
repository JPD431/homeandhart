"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";

const DISMISS_KEY = "hh_onboarding_banner_dismiss";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

/**
 * Banner discreto: proveedor con alta a medias puede retomar /ser-proveedor.
 * @param {{ className?: string }} props
 */
export default function OnboardingPendienteBanner({ className = "" }) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const handleDismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (dismissed || pathname?.startsWith("/ser-proveedor")) {
    return null;
  }

  return (
    <div
      className={`border-b px-4 py-2.5 text-center text-xs leading-relaxed text-[#5c4a32] ${className}`}
      style={{ borderColor: BORDER, backgroundColor: "#fdf8f0" }}
      role="status"
    >
      <span>Tienes tu alta de proveedor a medias.</span>{" "}
      <Link
        href="/ser-proveedor"
        className="font-semibold no-underline hover:underline"
        style={{ color: PRIMARY }}
      >
        Continuar
      </Link>
      <span className="mx-1.5 text-[#ccc]">·</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="border-0 bg-transparent p-0 text-xs font-medium text-[#888] underline-offset-2 hover:underline"
        style={{ cursor: "pointer" }}
      >
        Ahora no
      </button>
    </div>
  );
}

/** Botón compacto para la barra de nav (sustituye al switch cuando el alta está a medias). */
export function ContinuarAltaProveedorLink({ compact = false, onNavigate, className = "" }) {
  return (
    <Link
      href="/ser-proveedor"
      onClick={onNavigate}
      className={
        compact
          ? `inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border px-3 text-[11px] font-semibold no-underline transition-colors hover:opacity-90 ${className}`
          : `inline-flex min-h-[36px] items-center rounded-lg border px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:opacity-90 ${className}`
      }
      style={{
        borderColor: "#c47d1a",
        backgroundColor: "#fdf8f0",
        color: "#92400e",
      }}
    >
      Continuar alta
    </Link>
  );
}
