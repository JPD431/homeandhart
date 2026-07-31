"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  LEGAL_DOC_PATHS,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/app/lib/legal-versions";
import { BRAND } from "@/app/components/brand";

const PRIMARY = BRAND.primary;

const SKIP_PREFIXES = [
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/nueva-contrasena",
  "/legal",
  "/api",
  "/auth",
  "/referencias/",
];

function shouldSkipPath(pathname) {
  if (!pathname) return true;
  return SKIP_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(p),
  );
}

/**
 * Modal bloqueante para usuarios logueados sin consentimiento vigente
 * (cuentas antiguas o tras cambio de versión de documentos).
 */
export default function LegalConsentGate() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (shouldSkipPath(pathname)) {
      setOpen(false);
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function check() {
      setChecking(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) {
          if (!cancelled) setOpen(false);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select(
            "acepto_terminos_at, terminos_version, acepto_privacidad_at, privacidad_version",
          )
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        // Si columnas aún no existen en BD, no bloquear la app
        if (profileError) {
          setOpen(false);
          return;
        }

        const ok =
          profile?.acepto_terminos_at &&
          profile?.terminos_version === TERMS_VERSION &&
          profile?.acepto_privacidad_at &&
          profile?.privacidad_version === PRIVACY_VERSION;

        setOpen(!ok);
      } catch {
        if (!cancelled) setOpen(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  async function handleAccept() {
    setError("");
    if (!aceptaTerminos || !aceptaPrivacidad) {
      setError("Debes aceptar ambos documentos para continuar.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/accept-legal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          acepto_terminos: true,
          acepto_privacidad: true,
          source: "reaceptacion",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "No se pudo guardar");
      }
      setOpen(false);
      setAceptaTerminos(false);
      setAceptaPrivacidad(false);
    } catch (err) {
      setError(err?.message || "Error al guardar el consentimiento");
    } finally {
      setLoading(false);
    }
  }

  if (checking || !open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="legal-consent-title"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        style={{ border: `1px solid ${BRAND.border}` }}
      >
        <h2
          id="legal-consent-title"
          className="text-lg font-semibold text-[#1a1a1a]"
        >
          Actualiza tu aceptación legal
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#555]">
          Para seguir usando Home&amp;Heart necesitamos tu aceptación de los
          términos y la política de privacidad vigentes (versiones{" "}
          {TERMS_VERSION} / {PRIVACY_VERSION}).
        </p>

        <label className="mt-5 flex min-h-[44px] cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span className="text-xs leading-relaxed text-[#444]">
            Acepto los{" "}
            <Link
              href={LEGAL_DOC_PATHS.terminos}
              target="_blank"
              className="font-medium underline"
              style={{ color: PRIMARY }}
            >
              Términos de uso
            </Link>{" "}
            (v. {TERMS_VERSION})
          </span>
        </label>

        <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={aceptaPrivacidad}
            onChange={(e) => setAceptaPrivacidad(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0"
          />
          <span className="text-xs leading-relaxed text-[#444]">
            Acepto la{" "}
            <Link
              href={LEGAL_DOC_PATHS.privacidad}
              target="_blank"
              className="font-medium underline"
              style={{ color: PRIMARY }}
            >
              Política de privacidad
            </Link>{" "}
            (v. {PRIVACY_VERSION})
          </span>
        </label>

        {error && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={loading || !aceptaTerminos || !aceptaPrivacidad}
          className="mt-5 min-h-[44px] w-full rounded-lg text-sm font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: PRIMARY }}
        >
          {loading ? "Guardando…" : "Continuar"}
        </button>
      </div>
    </div>
  );
}
