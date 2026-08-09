"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import AyudaSoporteForm from "@/app/components/AyudaSoporteForm";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/app/lib/supabase";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

function AyudaInner() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const ta = t.ayuda;
  const searchParams = useSearchParams();
  const [authed, setAuthed] = useState(null);
  const asuntoParam = searchParams?.get("asunto") || "";
  const highlighted = searchParams?.get("destacado") === "1";

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setAuthed(Boolean(user));
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.warm }}>
      <Navbar />
      <main className="mx-auto max-w-lg px-4 py-10">
        <h1
          className="text-2xl text-[#1a1a1a]"
          style={{ fontFamily: SERIF }}
        >
          {ta.titulo}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#555]">
          {ta.subtituloA}{" "}
          <strong>{ta.subtituloB}</strong> {ta.subtituloC}
        </p>

        <div className="mt-6">
          {authed === null ? (
            <p className="text-sm text-[#888]">{ta.cargando}</p>
          ) : authed ? (
            <AyudaSoporteForm
              highlighted={highlighted}
              defaultAsunto={asuntoParam}
            />
          ) : (
            <div
              className="rounded-xl border bg-white p-5"
              style={{ borderColor: BRAND.border }}
            >
              <p className="text-sm text-[#444]">
                {ta.noAuthedA}{" "}
                <a
                  href="mailto:soporte@homeandheart.es"
                  className="font-semibold"
                  style={{ color: BRAND.primary }}
                >
                  soporte@homeandheart.es
                </a>
                .
              </p>
              <Link
                href="/login?next=/ayuda"
                className="mt-4 inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                {ta.iniciarSesion}
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#888]">
          <Link href="/dashboard" style={{ color: BRAND.primary }}>
            {ta.volverPanel}
          </Link>
        </p>
      </main>
      <Footer />
    </div>
  );
}

export default function AyudaPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen" style={{ backgroundColor: BRAND.warm }}>
          <Navbar />
          <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-[#888]">
            Cargando…
          </main>
        </div>
      }
    >
      <AyudaInner />
    </Suspense>
  );
}
