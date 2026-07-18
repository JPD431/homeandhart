"use client";

import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import {
  MODALIDAD_COBRO_OPTIONS,
  emptyModalidadesCobroForm,
  getHorasPorUnidadLabel,
  getPrecioCobroLabel,
  getSuplementoLabel,
  getSyncedServicesPrecio,
  legacyModalidadForVertical,
  modalidadCobroNeedsHoras,
  supportsModalidadCobro,
} from "@/app/lib/modalidad-cobro";

const inputClass = PROVIDER_INPUT_CLASS;

/**
 * Activa 1–3 modalidades de cobro, cada una con precio / horas / suplemento.
 * Solo niñera / mascotas. No afecta el cálculo de reserva (paso 1).
 */
export default function ModalidadCobroFields({
  vertical,
  details,
  onChange,
  accentColor = BRAND.primary,
  className = "",
}) {
  if (!supportsModalidadCobro(vertical)) return null;

  const form = details?.modalidades_cobro || emptyModalidadesCobroForm();
  const legacy = legacyModalidadForVertical(vertical);
  const unitWord = vertical === "mascotas" ? "mascota" : "niño";

  function commit(nextForm) {
    const next = { ...details, modalidades_cobro: nextForm };
    const synced = getSyncedServicesPrecio(next, vertical);
    if (synced != null) next.precio = String(synced);
    onChange(next);
  }

  function patchSlot(modalidad, patch) {
    commit({
      ...form,
      [modalidad]: { ...form[modalidad], ...patch },
    });
  }

  function toggle(modalidad) {
    const slot = form[modalidad] || {};
    const activa = !slot.activa;
    patchSlot(modalidad, {
      activa,
      ...(activa &&
      modalidadCobroNeedsHoras(modalidad) &&
      !slot.horas_unidad
        ? { horas_unidad: modalidad === "medio_dia" ? "5" : "8" }
        : {}),
    });
  }

  return (
    <div
      className={`rounded-xl border p-4 ${className}`}
      style={{ borderColor: BRAND.border, backgroundColor: BRAND.warm }}
    >
      <p className="text-xs font-semibold text-[#1a1a1a]">
        ¿Cómo puedes cobrar este servicio?
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#666]">
        Activa una o varias modalidades. El cliente elegirá al reservar. Mientras
        tanto, la reserva sigue cobrando como ahora (
        {legacy === "hora" ? "por hora" : "por día"}): usa el precio de «
        {legacy === "hora" ? "Por hora" : "Por día completo"}» si está activa.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        {MODALIDAD_COBRO_OPTIONS.map((opt) => {
          const slot = form[opt.value] || {};
          const activa = slot.activa === true;
          const needsHoras = modalidadCobroNeedsHoras(opt.value);

          return (
            <div
              key={opt.value}
              className="rounded-xl border bg-white p-3"
              style={{
                borderColor: activa ? accentColor : BRAND.border,
              }}
            >
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={activa}
                  onChange={() => toggle(opt.value)}
                  className="mt-1 h-4 w-4"
                  style={{ accentColor }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[#1a1a1a]">
                    {opt.label}
                    {opt.value === legacy ? (
                      <span className="ml-2 text-[10px] font-medium text-[#888]">
                        (precio de reserva actual)
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[#666]">
                    {opt.hint}
                  </span>
                </span>
              </label>

              {activa && (
                <div
                  className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2"
                  style={{ borderColor: "#f0ede8" }}
                >
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[#444]">
                      {getPrecioCobroLabel(opt.value)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.precio ?? ""}
                      onChange={(e) =>
                        patchSlot(opt.value, { precio: e.target.value })
                      }
                      className={inputClass}
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>

                  {needsHoras && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-[#444]">
                        {getHorasPorUnidadLabel(opt.value)}
                      </label>
                      <input
                        type="number"
                        min="0.5"
                        max="24"
                        step="0.5"
                        value={slot.horas_unidad ?? ""}
                        onChange={(e) =>
                          patchSlot(opt.value, {
                            horas_unidad: e.target.value,
                          })
                        }
                        placeholder={
                          opt.value === "medio_dia" ? "ej. 5" : "ej. 8"
                        }
                        className={inputClass}
                        style={{ borderColor: BRAND.border }}
                      />
                      <p className="mt-1 text-[10px] text-[#888]">
                        Solo informativo para el cliente.
                      </p>
                    </div>
                  )}

                  <div className={needsHoras ? "sm:col-span-2" : ""}>
                    <label className="mb-1.5 block text-xs font-medium text-[#444]">
                      {getSuplementoLabel(vertical, opt.value)}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slot.suplemento_extra ?? ""}
                      onChange={(e) =>
                        patchSlot(opt.value, {
                          suplemento_extra: e.target.value,
                        })
                      }
                      placeholder="Opcional"
                      className={inputClass}
                      style={{ borderColor: BRAND.border }}
                    />
                    <p className="mt-1 text-[10px] text-[#888]">
                      Vacío = sin suplemento por {unitWord} extra en esta
                      modalidad.
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
