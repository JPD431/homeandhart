"use client";

import { BRAND } from "@/app/components/brand";

export default function ProveedorEmergenciaToggle({ checked, onChange }) {
  return (
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
      <button
        type="button"
        id="proveedor-emergencia"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors"
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
  );
}
