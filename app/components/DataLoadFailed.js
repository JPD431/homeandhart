"use client";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

/**
 * Salida amable cuando falla una carga (evita spinner eterno).
 */
export default function DataLoadFailed({
  message = "No se pudieron cargar los datos. Reintentar",
  onRetry,
  className = "",
  style,
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 px-6 py-16 text-center ${className}`}
      style={style}
    >
      <p className="max-w-sm text-sm leading-relaxed text-[#666]">{message}</p>
      {typeof onRetry === "function" && (
        <button
          type="button"
          onClick={onRetry}
          className="min-h-[44px] rounded-xl px-5 text-sm font-semibold text-white"
          style={{ backgroundColor: PRIMARY, border: `1px solid ${BORDER}` }}
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
