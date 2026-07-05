"use client";

import { PRIMARY } from "@/app/lib/provider-verticals";

export default function ToggleRow({ label, checked, onChange, accentColor = PRIMARY }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-[#444]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative h-7 w-12 shrink-0 rounded-full transition-colors"
        style={{ backgroundColor: checked ? accentColor : "#d1d5db" }}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
          style={{ left: checked ? "calc(100% - 1.625rem)" : "0.125rem" }}
        />
      </button>
    </div>
  );
}
