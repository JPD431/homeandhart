"use client";

import { useEffect } from "react";
import Link from "next/link";

const PRIMARY = "#1d4f91";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const SERIF = 'Georgia, "Times New Roman", Times, serif';

/**
 * Error boundary de segmento (app/).
 * No expone stack traces al usuario.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    try {
      console.error("[app/error]", error);
    } catch {
      // no-op: el boundary no debe lanzar
    }
  }, [error]);

  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-16 text-center"
      style={{ backgroundColor: WARM, color: "#1a1a1a" }}
    >
      <p
        className="text-[22px] leading-none"
        style={{ fontFamily: SERIF, fontWeight: 600 }}
      >
        Home
        <span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
        Heart
      </p>
      <h1
        className="mt-8 max-w-md text-[22px] font-normal leading-snug"
        style={{ fontFamily: SERIF }}
      >
        Algo no ha ido bien
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#666]">
        No te preocupes, no es culpa tuya. Puedes reintentar o volver al inicio.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            try {
              reset();
            } catch (err) {
              console.error("[app/error] reset failed", err);
            }
          }}
          className="min-h-[44px] rounded-xl px-5 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY }}
        >
          Reintentar
        </button>
        <Link
          href="/"
          className="inline-flex min-h-[44px] items-center rounded-xl border px-5 text-sm font-semibold no-underline"
          style={{ borderColor: BORDER, color: PRIMARY }}
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
