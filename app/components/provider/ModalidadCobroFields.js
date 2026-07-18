"use client";

import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import {
  MODALIDAD_COBRO_OPTIONS,
  getHorasPorUnidadHint,
  getHorasPorUnidadLabel,
  getPrecioCobroLabel,
  modalidadCobroNeedsHoras,
  resolveModalidadCobro,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

const inputClass = PROVIDER_INPUT_CLASS;

/**
 * Selector de modalidad de cobro + precio etiquetado + horas informativas.
 * Solo niñera / mascotas. No afecta el cálculo de reserva (paso 1).
 */
export default function ModalidadCobroFields({
  vertical,
  details,
  onChange,
  accentColor = BRAND.primary,
  showPrecio = true,
  className = "",
}) {
  if (!supportsModalidadCobro(vertical)) return null;

  const modalidad = resolveModalidadCobro(vertical, details?.modalidad_cobro);
  const needsHoras = modalidadCobroNeedsHoras(modalidad);

  function update(field, val) {
    const next = { ...details, [field]: val };
    if (field === "modalidad_cobro") {
      if (!modalidadCobroNeedsHoras(val)) {
        next.horas_por_unidad = "";
      } else if (
        details?.horas_por_unidad == null ||
        details.horas_por_unidad === ""
      ) {
        next.horas_por_unidad = val === "medio_dia" ? "5" : "8";
      }
    }
    onChange(next);
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <div>
        <p className="mb-1 text-xs font-medium text-[#444]">
          ¿Cómo cobras este servicio?
        </p>
        <p className="mb-2 text-[11px] leading-relaxed text-[#888]">
          Una modalidad por servicio. El precio se interpreta según lo que
          elijas (€/hora, €/día o €/medio día).
        </p>
        <div className="flex flex-wrap gap-2">
          {MODALIDAD_COBRO_OPTIONS.map((opt) => {
            const selected = modalidad === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => update("modalidad_cobro", opt.value)}
                className="rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-opacity hover:opacity-90"
                style={{
                  borderColor: selected ? accentColor : BRAND.border,
                  backgroundColor: selected ? `${accentColor}14` : "#fff",
                  color: selected ? accentColor : "#444",
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#666]">
          {MODALIDAD_COBRO_OPTIONS.find((o) => o.value === modalidad)?.hint}
        </p>
      </div>

      {showPrecio && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            {getPrecioCobroLabel(vertical, modalidad)}
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={details?.precio ?? ""}
            onChange={(e) => update("precio", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
      )}

      {needsHoras && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            {getHorasPorUnidadLabel(modalidad)}
          </label>
          <input
            type="number"
            min="0.5"
            max="24"
            step="0.5"
            value={details?.horas_por_unidad ?? ""}
            onChange={(e) => update("horas_por_unidad", e.target.value)}
            placeholder={modalidad === "medio_dia" ? "ej. 5" : "ej. 8"}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#888]">
            {getHorasPorUnidadHint(modalidad)}
          </p>
        </div>
      )}
    </div>
  );
}
