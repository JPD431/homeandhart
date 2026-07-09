"use client";

import { getVerticalColor } from "@/app/lib/provider-verticals";

/**
 * Barra de progreso segmentada (un segmento por foto).
 * @param {object} props
 * @param {number} props.count
 * @param {number} props.activeIndex
 * @param {string} [props.vertical] — color desde provider-verticals
 * @param {string} [props.color] — override del color activo
 * @param {string} [props.className]
 */
export default function PhotoArchProgressBar({
  count,
  activeIndex,
  vertical = "alojamiento",
  color,
  className = "",
}) {
  if (count <= 1) return null;

  const activeColor = color ?? getVerticalColor(vertical);

  return (
    <div
      className={`flex gap-0.5 ${className}`}
      role="tablist"
      aria-label={`Foto ${activeIndex + 1} de ${count}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Foto ${i + 1} de ${count}`}
          className="h-[3px] flex-1 rounded-sm transition-colors duration-200"
          style={{
            backgroundColor: i === activeIndex ? activeColor : "#e8e4de",
          }}
        />
      ))}
    </div>
  );
}
