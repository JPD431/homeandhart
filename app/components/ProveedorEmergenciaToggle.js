"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND } from "@/app/components/brand";

export default function ProveedorEmergenciaToggle({ checked, onChange }) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <>
      <div
        className="mt-4 flex items-start justify-between gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: BRAND.border, backgroundColor: BRAND.warm }}
      >
        <label
          htmlFor="proveedor-emergencia"
          className="cursor-pointer text-sm leading-relaxed text-[#444]"
        >
          🛡️ Proveedor de emergencia — Disponible para cubrir cancelaciones de
          última hora con +5% sobre mi precio
        </label>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="text-xs text-[#888] underline-offset-2 transition-colors hover:text-[#1d4f91] hover:underline"
          >
            ¿Qué es la red de emergencia?
          </button>
          <button
            type="button"
            id="proveedor-emergencia"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className="relative h-7 w-12 rounded-full transition-colors"
            style={{
              backgroundColor: checked ? BRAND.primary : "#d1d5db",
            }}
          >
            <span
              className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
              style={{ left: checked ? "22px" : "2px" }}
            />
          </button>
        </div>
      </div>

      {infoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="w-full max-w-sm rounded-2xl border bg-white p-5 shadow-xl"
            style={{ borderColor: BRAND.border }}
            role="dialog"
            aria-labelledby="emergencia-info-title"
            aria-modal="true"
          >
            <h3
              id="emergencia-info-title"
              className="text-base font-semibold text-[#111]"
            >
              🛡️ Red de emergencia Home&Heart
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-[#5c5c5c]">
              Si activas esta opción, aparecerás como alternativa verificada
              cuando otro proveedor cancele con menos de 24h. Recibirás un +5%
              sobre tu precio habitual y un badge especial en tu perfil.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-[#5c5c5c]">
              El cliente verá tu precio real con una nota indicando que puede
              variar respecto a su reserva original.
            </p>
            <Link
              href="/garantia"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-block text-sm font-medium no-underline transition-colors hover:opacity-80"
              style={{ color: BRAND.primary }}
            >
              Saber más →
            </Link>
            <button
              type="button"
              onClick={() => setInfoOpen(false)}
              className="mt-5 w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
