"use client";

import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";

const inputClass = PROVIDER_INPUT_CLASS;

/**
 * Campos de capacidad máxima + precio por huésped extra (solo alojamiento).
 * No cambia el cálculo de reserva (Paso 2).
 */
export default function HuespedesPrecioFields({ details, onChange, className = "" }) {
  function update(field, val) {
    const next = { ...details, [field]: val };
    // Mantener capacidad.personas alineada con capacidad_maxima (filtro buscar / ficha)
    if (field === "capacidad_maxima") {
      const n = Number(val);
      const personas =
        Number.isFinite(n) && n > 0 ? Math.floor(n) : details.capacidad?.personas ?? 2;
      next.capacidad = {
        ...(details.capacidad || {}),
        personas,
      };
    }
    onChange(next);
  }

  const precioBase = details.precio ? `${details.precio}€` : "tu precio base";

  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: BRAND.border, backgroundColor: BRAND.warm }}
    >
      <p className="text-xs font-semibold text-[#1a1a1a]">
        Capacidad y precio por huésped
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
        Opcional. Tu precio base de {precioBase}/noche puede incluir un número de
        huéspedes; cobra un extra por cada huésped adicional. Si dejas el extra
        vacío, el precio sigue siendo plano (como ahora).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Capacidad máxima de huéspedes
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={details.capacidad_maxima ?? ""}
            onChange={(e) => update("capacidad_maxima", e.target.value)}
            placeholder="ej. 4"
            className={inputClass}
            style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Incluidos en el precio base
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={details.huespedes_incluidos ?? ""}
            onChange={(e) => update("huespedes_incluidos", e.target.value)}
            placeholder="ej. 2"
            className={inputClass}
            style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            Precio por huésped adicional (€)
          </label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={details.precio_huesped_extra ?? ""}
            onChange={(e) => update("precio_huesped_extra", e.target.value)}
            placeholder="ej. 5 (opcional)"
            className={inputClass}
            style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
          />
        </div>
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-[#888]">
        Ejemplo: precio base 20€/noche incluye 2 huéspedes; +5€ por cada huésped
        adicional (por noche). La capacidad máxima debe ser ≥ huéspedes incluidos.
      </p>
    </div>
  );
}
