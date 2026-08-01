"use client";

import Link from "next/link";
import { useEffect } from "react";
import { SERIF } from "@/app/components/brand";

/**
 * Error boundary de /anuncio/[serviceId] (y /preview).
 * UI amable para el usuario; detalle solo en logs (Vercel).
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("[anuncio] error boundary:", error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col font-sans"
      style={{ backgroundColor: "#f7f5f2", color: "#1a1a1a" }}
    >
      <header
        className="border-b px-5 py-4"
        style={{ borderColor: "#e8e4de" }}
      >
        <Link href="/" className="inline-block no-underline">
          <p
            className="text-[18px] leading-none text-[#111]"
            style={{ fontFamily: SERIF }}
          >
            Home<span className="italic" style={{ color: "#1d4f91" }}>
              &
            </span>
            Heart
          </p>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-5 py-16 text-center">
        <p
          className="text-[11px] font-semibold uppercase tracking-wide"
          style={{ color: "#1d4f91" }}
        >
          Home&Heart
        </p>
        <h1
          className="mt-3 text-[#111]"
          style={{
            fontFamily: SERIF,
            fontWeight: 300,
            fontSize: "clamp(22px, 4vw, 28px)",
            lineHeight: 1.25,
          }}
        >
          Vaya, algo no ha ido bien al cargar este anuncio
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#666]">
          Puede ser un fallo temporal. Prueba a reintentar o vuelve a la
          búsqueda para seguir explorando.
        </p>

        <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1d4f91" }}
          >
            Reintentar
          </button>
          <Link
            href="/buscar"
            className="rounded-lg border px-5 py-2.5 text-center text-[13px] font-medium no-underline transition-opacity hover:opacity-80"
            style={{ borderColor: "#e8e4de", color: "#444", backgroundColor: "#fff" }}
          >
            Volver a la búsqueda
          </Link>
        </div>
      </main>
    </div>
  );
}
