"use client";

import { AMENITIES_GROUPS } from "@/app/lib/amenities";
import { BRAND } from "@/app/components/brand";

/**
 * Selector visual de amenities agrupados por categoría.
 *
 * @param {object} props
 * @param {string[]} props.value — ids seleccionados
 * @param {(ids: string[]) => void} props.onChange
 * @param {string} [props.accentColor]
 * @param {string} [props.className]
 */
export default function AmenitiesPicker({
  value = [],
  onChange,
  accentColor = BRAND.primary,
  className = "",
}) {
  const selected = new Set(value);

  function toggle(id) {
    const next = selected.has(id)
      ? value.filter((item) => item !== id)
      : [...value, id];
    onChange(next);
  }

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {AMENITIES_GROUPS.map((group) => (
        <section key={group.title} aria-labelledby={`amenities-${group.title}`}>
          <h3
            id={`amenities-${group.title}`}
            className="mb-3 text-xs font-semibold text-[#444]"
          >
            {group.title}
          </h3>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4"
            role="group"
            aria-label={group.title}
          >
            {group.items.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  aria-label={item.label}
                  onClick={() => toggle(item.id)}
                  className="relative flex flex-col items-center rounded-xl border px-2 py-3 text-center transition-colors"
                  style={{
                    borderColor: isSelected ? accentColor : BRAND.border,
                    backgroundColor: isSelected ? `${accentColor}14` : "#fff",
                  }}
                >
                  {isSelected && (
                    <span
                      className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: accentColor }}
                      aria-hidden
                    >
                      ✓
                    </span>
                  )}
                  <span className="text-xl leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="mt-2 text-[10px] leading-snug text-[#555]">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
