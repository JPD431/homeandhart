"use client";

import {
  BANO_TIPO_COMPARTIDO,
  BANO_TIPO_PRIVADO,
} from "@/app/lib/capacidad";
import { BRAND } from "@/app/components/brand";

const OPTIONS = [
  { value: null, label: "No especificar" },
  { value: BANO_TIPO_PRIVADO, label: "Baño privado" },
  { value: BANO_TIPO_COMPARTIDO, label: "Baño compartido" },
];

/**
 * Selector de baño privado / compartido (alojamiento).
 *
 * @param {object} props
 * @param {'privado'|'compartido'|null} props.value
 * @param {(value: 'privado'|'compartido'|null) => void} props.onChange
 * @param {string} [props.accentColor]
 * @param {string} [props.className]
 */
export default function BanoTipoSelector({
  value = null,
  onChange,
  accentColor = BRAND.primary,
  className = "",
}) {
  return (
    <div className={className}>
      <p className="mb-2 text-xs font-medium text-[#444]">
        Baño para el huésped
      </p>
      <div
        className="flex flex-wrap gap-2"
        role="radiogroup"
        aria-label="Baño para el huésped"
      >
        {OPTIONS.map((option) => {
          const isSelected = value === option.value;
          return (
            <button
              key={option.label}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(option.value)}
              className="rounded-lg border px-3 py-2 text-xs font-semibold transition-colors"
              style={{
                borderColor: isSelected ? accentColor : BRAND.border,
                backgroundColor: isSelected ? `${accentColor}14` : "#fff",
                color: isSelected ? accentColor : "#444",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
