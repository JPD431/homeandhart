"use client";

import { BRAND } from "@/app/components/brand";

/**
 * Galería de miniaturas para subir fotos de servicio.
 * La primera miniatura es la portada (foto principal).
 */
export default function ServicePhotoUploadGrid({
  previews = [],
  onAdd,
  onRemove,
  onMakeCover,
  onMoveUp,
  onMoveDown,
  multiple = true,
  maxCount = 8,
  label,
  uploading = false,
  disabled = false,
}) {
  const atLimit = previews.length >= maxCount;
  const canAdd = multiple ? !atLimit : previews.length === 0;

  return (
    <div>
      {label ? (
        <p className="mb-2 text-xs font-medium text-[#444]">{label}</p>
      ) : null}
      <p className="mb-2 text-[11px] text-[#888]">
        La primera foto es la portada del anuncio. Máximo {maxCount} fotos.
      </p>
      <div className="flex flex-wrap gap-2">
        {previews.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="relative h-28 w-28 overflow-hidden rounded-xl border"
            style={{ borderColor: i === 0 ? BRAND.primary : BRAND.border }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover" />
            {i === 0 ? (
              <span
                className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[9px] font-semibold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                Portada
              </span>
            ) : null}
            <div className="absolute bottom-0 left-0 right-0 flex flex-wrap gap-0.5 bg-black/55 p-1">
              {i > 0 && onMakeCover ? (
                <button
                  type="button"
                  onClick={() => onMakeCover(i)}
                  disabled={disabled || uploading}
                  className="rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium text-[#333] disabled:opacity-50"
                  title="Usar como portada"
                >
                  ★
                </button>
              ) : null}
              {onMoveUp && i > 0 ? (
                <button
                  type="button"
                  onClick={() => onMoveUp(i)}
                  disabled={disabled || uploading}
                  className="rounded bg-white/90 px-1 py-0.5 text-[9px] text-[#333] disabled:opacity-50"
                  title="Mover antes"
                >
                  ↑
                </button>
              ) : null}
              {onMoveDown && i < previews.length - 1 ? (
                <button
                  type="button"
                  onClick={() => onMoveDown(i)}
                  disabled={disabled || uploading}
                  className="rounded bg-white/90 px-1 py-0.5 text-[9px] text-[#333] disabled:opacity-50"
                  title="Mover después"
                >
                  ↓
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => onRemove(i)}
                  disabled={disabled || uploading}
                  className="ml-auto rounded bg-red-600/90 px-1 py-0.5 text-[9px] font-medium text-white disabled:opacity-50"
                  title="Eliminar"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {canAdd && onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={disabled || uploading}
            className="flex h-28 w-28 flex-col items-center justify-center rounded-xl border border-dashed text-xs text-[#888] disabled:opacity-60"
            style={{ borderColor: BRAND.border }}
          >
            <span className="text-2xl">+</span>
            {uploading ? "Subiendo…" : "Foto"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
