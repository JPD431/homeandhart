"use client";

import { BRAND } from "@/app/components/brand";
import ToggleRow from "@/app/components/provider/ToggleRow";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import { DEFAULT_NORMAS } from "@/app/lib/service-payload";

const inputClass = PROVIDER_INPUT_CLASS;

export default function AlojamientoServiceFields({
  details,
  onChange,
  accentColor,
  className = "",
  showNru = false,
}) {
  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  function updNorma(key, val) {
    const normas = details.normas ?? { ...DEFAULT_NORMAS };
    onChange({ ...details, normas: { ...normas, [key]: val } });
  }

  const normas = details.normas ?? { ...DEFAULT_NORMAS };

  return (
    <div className={className}>
      {showNru && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">NRU</label>
          <input
            value={details.nru || ""}
            onChange={(e) => update("nru", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
      )}
      <div>
        <p className="mb-3 text-xs font-semibold text-[#444]">Horario de entrada y salida</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#444]">Hora de entrada</label>
            <input
              type="time"
              value={details.check_in || "15:00"}
              onChange={(e) => update("check_in", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
            <p className="mt-1 text-[10px] text-[#888]">Check-in</p>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#444]">Hora de salida</label>
            <input
              type="time"
              value={details.check_out || "11:00"}
              onChange={(e) => update("check_out", e.target.value)}
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
            <p className="mt-1 text-[10px] text-[#888]">Check-out</p>
          </div>
        </div>
      </div>
      <div className="mt-6 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <p className="mb-3 text-xs font-semibold text-[#444]">Normas</p>
        <ToggleRow
          label="Pet-friendly"
          checked={normas.petFriendly === true}
          onChange={(v) => updNorma("petFriendly", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Bebés"
          checked={normas.bebes === true}
          onChange={(v) => updNorma("bebes", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Fumar"
          checked={normas.fumar === true}
          onChange={(v) => updNorma("fumar", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Fiestas"
          checked={normas.fiestas === true}
          onChange={(v) => updNorma("fiestas", v)}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}
