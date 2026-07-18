"use client";

import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import {
  getUnidadesPrecioCopy,
  supportsUnidadesPrecio,
} from "@/app/lib/huespedes-precio";
import { resolveModalidadCobro } from "@/app/lib/modalidad-cobro";

const inputClass = PROVIDER_INPUT_CLASS;

/**
 * Capacidad máxima + unidades incluidas + precio por unidad extra.
 * Misma UI para alojamiento (huésped), niñera (niño) y mascotas (mascota).
 * Persistencia: capacidad_maxima / huespedes_incluidos / precio_huesped_extra.
 * No cambia el cálculo de reserva de ninos/mascotas (Paso 1).
 */
export default function HuespedesPrecioFields({
  details,
  onChange,
  vertical = "alojamiento",
  className = "",
}) {
  if (!supportsUnidadesPrecio(vertical)) return null;

  const modalidadCobro =
    vertical === "ninos" || vertical === "mascotas"
      ? resolveModalidadCobro(vertical, details?.modalidad_cobro)
      : null;
  const copy = getUnidadesPrecioCopy(vertical, modalidadCobro);

  function update(field, val) {
    const next = { ...details, [field]: val };
    // Solo alojamiento: alinear capacidad.personas con capacidad_maxima
    if (vertical === "alojamiento" && field === "capacidad_maxima") {
      const n = Number(val);
      const personas =
        Number.isFinite(n) && n > 0
          ? Math.floor(n)
          : details.capacidad?.personas ?? 2;
      next.capacidad = {
        ...(details.capacidad || {}),
        personas,
      };
    }
    onChange(next);
  }

  const precioBase = details.precio ? `${details.precio}€` : "tu precio base";
  const unit = copy.priceUnit;
  const unitWord = copy.unitPlural;

  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: BRAND.border, backgroundColor: BRAND.warm }}
    >
      <p className="text-xs font-semibold text-[#1a1a1a]">{copy.title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
        Opcional. Tu precio base de {precioBase}/{unit} puede incluir un número de{" "}
        {unitWord}; cobra un extra por cada {copy.unitSingular} adicional. Si
        dejas el extra vacío, el precio sigue siendo plano (como ahora).
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            {copy.maxLabel}
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
            {copy.incluidosLabel}
          </label>
          <input
            type="number"
            min={1}
            step={1}
            value={details.huespedes_incluidos ?? ""}
            onChange={(e) => update("huespedes_incluidos", e.target.value)}
            placeholder="ej. 1"
            className={inputClass}
            style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[#444]">
            {copy.extraLabel}
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
        Ejemplo: precio base {precioBase}/{unit} incluye 1 {copy.unitSingular}; +5€
        por cada {copy.unitSingular} adicional (por {unit}). El máximo debe ser ≥{" "}
        {unitWord} incluidos.
      </p>
    </div>
  );
}
