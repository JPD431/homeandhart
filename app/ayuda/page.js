"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import AyudaSoporteForm from "@/app/components/AyudaSoporteForm";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/app/lib/supabase";

function AyudaInner() {
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
          ¿Necesitas ayuda?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[#555]">
          Para dudas de cuenta, activación o pagos. Si el problema es con una
          reserva concreta, usa{" "}
          <strong>Reportar incidencia</strong> desde esa reserva.
        </p>

        <div className="mt-6">
          {authed === null ? (
            <p className="text-sm text-[#888]">Cargando…</p>
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
                Inicia sesión para enviarnos un mensaje con el contexto de tu
                cuenta, o escríbenos a{" "}
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
                Iniciar sesión
              </Link>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-[#888]">
          <Link href="/dashboard" style={{ color: BRAND.primary }}>
            Volver al panel
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
