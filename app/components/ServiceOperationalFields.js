"use client";

import { useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import { SERVICE_LABELS } from "@/app/lib/provider-form-labels";
import { DIAS_SEMANA, DIAS_DISPONIBLES_DEFAULT } from "@/app/lib/service-payload";

const DARK_BLUE = "#163a6b";

const CANCEL_POLICIES = [
  { value: "flexible", label: "Flexible" },
  { value: "moderada", label: "Moderada" },
  { value: "estricta", label: "Estricta" },
];

const ANTELACION_OPTIONS = [
  { value: 0, label: "Sin restricción" },
  { value: 1, label: "Al menos 1 hora antes" },
  { value: 3, label: "Al menos 3 horas antes" },
  { value: 6, label: "Al menos 6 horas antes" },
  { value: 12, label: "Al menos 12 horas antes" },
  { value: 24, label: "Al menos 24 horas antes" },
  { value: 48, label: "Al menos 48 horas antes" },
  { value: 72, label: "Al menos 3 días antes" },
  { value: 168, label: "Al menos 7 días antes" },
];

const ESTANCIA_PLACEHOLDERS = {
  alojamiento: { min: "Mínimo de noches", max: "Máximo de noches" },
  ninos: { min: "Mínimo de horas", max: "Máximo de horas" },
  mascotas: { min: "Mínimo de días", max: "Máximo de días" },
};

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function cancelLabel(value) {
  return CANCEL_POLICIES.find((p) => p.value === value)?.label || "Moderada";
}

function operationalSummary(details) {
  const cancel = cancelLabel(details.cancelacion || "moderada");
  const reserva = details.reserva_inmediata ? "Inmediata" : "Con confirmación";
  const antelacion =
    ANTELACION_OPTIONS.find(
      (o) => o.value === Number(details.antelacion_minima ?? 24),
    )?.label || "24 horas antes";
  const diasCount = (
    Array.isArray(details.dias_disponibles) && details.dias_disponibles.length > 0
      ? details.dias_disponibles
      : DIAS_DISPONIBLES_DEFAULT
  ).length;
  const dias =
    diasCount === DIAS_DISPONIBLES_DEFAULT.length
      ? "Todos los días"
      : `${diasCount} días/semana`;
  return `${cancel} · ${reserva} · ${antelacion} · ${dias}`;
}

export default function ServiceOperationalFields({
  vertical,
  details,
  onChange,
  collapsible = false,
  className = "",
  sectionSubtitle = "",
}) {
  const [open, setOpen] = useState(!collapsible);

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  const placeholders = ESTANCIA_PLACEHOLDERS[vertical] || ESTANCIA_PLACEHOLDERS.alojamiento;
  const dias =
    Array.isArray(details.dias_disponibles) && details.dias_disponibles.length > 0
      ? details.dias_disponibles
      : DIAS_DISPONIBLES_DEFAULT;

  const fields = (
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Estancia mínima
        </label>
        <input
          type="number"
          min="1"
          placeholder={placeholders.min}
          value={details.estancia_minima ?? ""}
          onChange={(e) => update("estancia_minima", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Estancia máxima
        </label>
        <input
          type="number"
          min="1"
          placeholder={placeholders.max}
          value={details.estancia_maxima ?? ""}
          onChange={(e) => update("estancia_maxima", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Antelación mínima para reservar
        </label>
        <select
          value={String(details.antelacion_minima ?? 24)}
          onChange={(e) => update("antelacion_minima", Number(e.target.value))}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        >
          {ANTELACION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium text-[#444]">Días disponibles</p>
        <div className="flex flex-wrap gap-2">
          {DIAS_SEMANA.map((dia) => {
            const isSelected = dias.includes(dia.id);
            return (
              <button
                key={dia.id}
                type="button"
                onClick={() => {
                  const next = isSelected
                    ? dias.filter((d) => d !== dia.id)
                    : [...dias, dia.id];
                  update("dias_disponibles", next.length > 0 ? next : []);
                }}
                className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  borderColor: isSelected ? BRAND.primary : BRAND.border,
                  backgroundColor: isSelected ? BRAND.light : "#fff",
                  color: isSelected ? DARK_BLUE : "#666",
                }}
              >
                {dia.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          Política de cancelación
        </label>
        <select
          value={details.cancelacion || "moderada"}
          onChange={(e) => update("cancelacion", e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        >
          {CANCEL_POLICIES.map((policy) => (
            <option key={policy.value} value={policy.value}>
              {policy.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium text-[#444]">Tipo de reserva</p>
        <div className="flex flex-col gap-2">
          {[
            { value: false, title: "Con confirmación", sub: "Tú aceptas o rechazas" },
            { value: true, title: "Reserva inmediata", sub: "Reserva directa" },
          ].map((option) => {
            const selected = details.reserva_inmediata === option.value;
            return (
              <button
                key={String(option.value)}
                type="button"
                onClick={() => update("reserva_inmediata", option.value)}
                className="rounded-xl border p-3 text-left transition-colors"
                style={{
                  borderColor: selected ? BRAND.primary : BRAND.border,
                  backgroundColor: selected ? BRAND.light : "#fff",
                }}
              >
                <span className="text-sm font-semibold text-[#1a1a1a]">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-xs text-[#666]">{option.sub}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (!collapsible) {
    return (
      <div className={`sm:col-span-2 ${className}`.trim()}>
        <p className="mb-2 text-xs font-semibold text-[#444]">
          {SERVICE_LABELS.operativo.title}
        </p>
        {sectionSubtitle ? (
          <p className="mb-3 text-xs text-[#888]">{sectionSubtitle}</p>
        ) : null}
        {fields}
      </div>
    );
  }

  return (
    <div
      className={`mt-6 rounded-xl border ${className}`.trim()}
      style={{ borderColor: BRAND.border }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-xs font-semibold text-[#444]">{SERVICE_LABELS.operativo.title}</p>
          {sectionSubtitle ? (
            <p className="mt-1 text-xs text-[#888]">{sectionSubtitle}</p>
          ) : null}
          {!open && (
            <p className="mt-1 text-xs text-[#888]">{operationalSummary(details)}</p>
          )}
        </div>
        <span className="text-sm text-[#888]" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && <div className="border-t px-4 pb-4" style={{ borderColor: BRAND.border }}>{fields}</div>}
    </div>
  );
}
