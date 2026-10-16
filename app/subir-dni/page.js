"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { buildLoginUrl } from "@/app/lib/auth-redirect";
import {
  DNI_SUBIR_RUTA,
  getDniRevisionEstado,
  isClienteVerificado,
  sanitizeInternalRedirect,
  TEXTO_CONSENTIMIENTO_DNI,
} from "@/app/lib/dni";
import { resolvePostAuthRedirect } from "@/app/lib/onboarding";
import { persistUserDni } from "@/app/lib/provider-uploads";
import { supabase } from "@/app/lib/supabase";

const PROFILE_SELECT =
  "role, doc_dni_url, dni_estado, onboarding_completed_at, necesidades, ciudad";

function subirDniLoginUrl(nextParam) {
  const next = sanitizeInternalRedirect(nextParam);
  const returnPath = next
    ? `${DNI_SUBIR_RUTA}?next=${encodeURIComponent(next)}`
    : DNI_SUBIR_RUTA;
  return buildLoginUrl(returnPath);
}

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

async function resolveContinueHref(profile, nextParam) {
  const next = sanitizeInternalRedirect(nextParam);
  if (next) return next;
  return resolvePostAuthRedirect(profile);
}

function StatusShell({ children }) {
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
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

function SubirDniForm() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const td = t.subirDni;
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [file, setFile] = useState(null);
  const [consent, setConsent] = useState(false);
  const [continueHref, setContinueHref] = useState("/buscar");

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (userError || !user) {
        router.replace(subirDniLoginUrl(nextParam));
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const href = await resolveContinueHref(profileData, nextParam);
      if (cancelled) return;

      setContinueHref(href);
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
      setError(td.errSinArchivo);
      return;
    }

    if (!consent) {
      setError(td.errConsentimiento);
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace(subirDniLoginUrl(nextParam));
        return;
      }

      await persistUserDni(user.id, file);

      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select(PROFILE_SELECT)
        .eq("id", user.id)
        .maybeSingle();

      const href = await resolveContinueHref(
        updatedProfile || profile,
        nextParam,
      );
      setContinueHref(href);
      setProfile(updatedProfile || { ...profile, dni_estado: "pendiente" });
      setFile(null);
      setConsent(false);
    } catch (err) {
      setError(err.message || td.errGuardar);
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
        <p className="text-sm text-[#888]">{td.cargando}</p>
      </div>
    );
  }

  const revisionEstado = getDniRevisionEstado(profile);
  const skipHref = resolveSkipHref(profile, nextParam);

  if (revisionEstado === "verificado" || isClienteVerificado(profile)) {
    return (
      <StatusShell>
        <h1 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
          {td.verificadoTitulo}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {td.verificadoDesc}
        </p>
        <div
          className="mt-5 rounded-lg px-3 py-2.5 text-sm leading-relaxed"
          style={{ backgroundColor: "#e6f4f0", color: "#085041" }}
        >
          {td.verificadoBadge}
        </div>
        <Link
          href={continueHref}
          className="mt-6 block w-full rounded-xl py-3.5 text-center text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
          style={{ backgroundColor: BRAND.primary }}
        >
          {td.continuar}
        </Link>
      </StatusShell>
    );
  }

  if (revisionEstado === "pendiente") {
    return (
      <StatusShell>
        <h1 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
          {td.revisionTitulo}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {td.revisionDesc}
        </p>
        <div
          className="mt-5 rounded-lg px-3 py-2.5 text-sm leading-relaxed"
          style={{ backgroundColor: "#fdf4e7", color: "#92400e" }}
        >
          {td.revisionBadge}
        </div>
        <Link
          href={continueHref}
          className="mt-6 block w-full rounded-xl border py-3.5 text-center text-sm font-semibold no-underline transition-opacity hover:opacity-90"
          style={{ borderColor: BRAND.border, color: BRAND.primary }}
        >
          {td.volver}
        </Link>
      </StatusShell>
    );
  }

  const isRechazado = revisionEstado === "rechazado";

  return (
    <StatusShell>
      <form onSubmit={handleSubmit}>
        <h1 className="text-2xl text-[#1a1a1a]" style={{ fontFamily: SERIF }}>
          {isRechazado ? td.rechazadoTitulo : td.normTitulo}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#666]">
          {isRechazado ? td.rechazadoDesc : td.normDesc}
        </p>

        {isRechazado && (
          <div
            className="mt-4 rounded-lg px-3 py-2.5 text-sm leading-relaxed"
            style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}
          >
            {td.rechazadoBadge}
          </div>
        )}

        <div className="mt-6">
          <label
            htmlFor="dni-file"
            className="block text-xs font-semibold uppercase tracking-wide text-[#888]"
          >
            {td.labelDocumento}
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
            <p className="mt-1 text-xs text-[#666]">{td.archivo} {file.name}</p>
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
          {saving ? td.guardando : isRechazado ? td.reenviar : td.guardarContinuar}
        </button>

        <p className="mt-4 text-center text-xs text-[#888]">
          <Link
            href={skipHref}
            className="font-medium no-underline hover:underline"
            style={{ color: BRAND.primary }}
          >
            {td.hacerloMasTarde}
          </Link>
          {td.tardeSufijo}
        </p>
      </form>
    </StatusShell>
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
          <p className="text-sm text-[#888]">…</p>
        </div>
      }
    >
      <SubirDniForm />
    </Suspense>
  );
}
