"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  DNI_SUBIR_RUTA,
  hasDniUploaded,
  sanitizeInternalRedirect,
  TEXTO_CONSENTIMIENTO_DNI,
} from "@/app/lib/dni";
import { resolvePostAuthRedirect } from "@/app/lib/onboarding";
import { persistUserDni } from "@/app/lib/provider-uploads";
import { supabase } from "@/app/lib/supabase";

function resolveSkipHref(profile, nextParam) {
  const next = sanitizeInternalRedirect(nextParam);
  if (next) return next;
  if (profile?.role === "proveedor") {
    return profile?.onboarding_completed_at
      ? "/dashboard?tab=proveedor"
      : "/ser-proveedor";
  }
  return "/buscar";
}

async function resolveSuccessHref(profile, nextParam) {
  const next = sanitizeInternalRedirect(nextParam);
  if (next) return next;
  return resolvePostAuthRedirect(profile);
}

function SubirDniForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        router.replace(`/login?next=${encodeURIComponent(DNI_SUBIR_RUTA)}`);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "role, doc_dni_url, onboarding_completed_at, necesidades, ciudad",
        )
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (hasDniUploaded(profileData)) {
        const href = await resolveSuccessHref(profileData, nextParam);
        router.replace(href);
        return;
      }

      setProfile(profileData);
      setLoading(false);
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [router, nextParam]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Selecciona una foto o PDF de tu documento.");
      return;
    }

    if (!consent) {
      setError("Debes aceptar el consentimiento para continuar.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace(`/login?next=${encodeURIComponent(DNI_SUBIR_RUTA)}`);
        return;
      }

      await persistUserDni(user.id, file);

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select(
          "role, doc_dni_url, onboarding_completed_at, necesidades, ciudad",
        )
        .eq("id", user.id)
        .maybeSingle();

      const href = await resolveSuccessHref(updatedProfile || profile, nextParam);
      router.push(href);
    } catch (err) {
      setError(err.message || "No se pudo guardar el documento.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <p className="text-sm text-[#888]">Cargando…</p>
      </div>
    );
  }

  const skipHref = resolveSkipHref(profile, nextParam);

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10 font-sans"
      style={{ backgroundColor: BRAND.warm }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border bg-white shadow-sm"
        style={{ borderColor: BRAND.border }}
      >
        <div className="border-b px-6 py-5" style={{ borderColor: BRAND.border }}>
          <Link
            href="/"
            className="block text-center text-xl font-semibold text-[#1a1a1a] no-underline"
          >
            Home<span className="italic text-[#1d4f91]">&</span>Heart
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6">
          <h1 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
            Verifica tu identidad
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#666]">
            Para la seguridad de las familias y proveedores de Home&Heart,
            necesitamos verificar tu identidad. Sube una foto o PDF de tu DNI,
            NIE o pasaporte vigente.
          </p>

          <div className="mt-6">
            <label
              htmlFor="dni-file"
              className="block text-xs font-semibold uppercase tracking-wide text-[#888]"
            >
              Documento de identidad
            </label>
            <input
              id="dni-file"
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-2 w-full rounded-xl border px-3 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f0fb] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[#1d4f91]"
              style={{ borderColor: BRAND.border }}
            />
            {file && (
              <p className="mt-1 text-xs text-[#666]">Archivo: {file.name}</p>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#1d4f91]"
            />
            <span className="text-xs leading-relaxed text-[#666]">
              {TEXTO_CONSENTIMIENTO_DNI}
            </span>
          </label>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !file || !consent}
            className="mt-6 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: BRAND.primary }}
          >
            {saving ? "Guardando…" : "Guardar y continuar"}
          </button>

          <p className="mt-4 text-center text-xs text-[#888]">
            Puedes{" "}
            <Link
              href={skipHref}
              className="font-medium no-underline hover:underline"
              style={{ color: BRAND.primary }}
            >
              hacerlo más tarde
            </Link>
            . Necesitarás el DNI para reservar o publicar servicios.
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SubirDniPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center font-sans"
          style={{ backgroundColor: BRAND.warm }}
        >
          <p className="text-sm text-[#888]">Cargando…</p>
        </div>
      }
    >
      <SubirDniForm />
    </Suspense>
  );
}
