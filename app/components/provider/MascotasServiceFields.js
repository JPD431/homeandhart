"use client";

import { useState } from "react";
import TagPill from "@/app/components/provider/TagPill";
import ToggleRow from "@/app/components/provider/ToggleRow";
import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import {
  ANIMALES_TAGS,
  CERT_MASCOTAS_TAGS,
  TAMANO_PERRO_TAGS,
} from "@/app/lib/service-form-tags";

const inputClass = PROVIDER_INPUT_CLASS;

function toggleTagInDetails(details, field, tag, onChange) {
  const current = Array.isArray(details[field]) ? details[field] : [];
  const next = current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
  onChange({ ...details, [field]: next });
}

export default function MascotasServiceFields({
  details,
  onChange,
  accentColor,
  className = "",
  showAnosExperiencia = true,
}) {
  const [customAnimales, setCustomAnimales] = useState([]);
  const [customCert, setCustomCert] = useState([]);

  function update(field, val) {
    onChange({ ...details, [field]: val });
  }

  function addCustomTag(field, setCustomList) {
    const val = window.prompt("Añadir:");
    if (!val?.trim()) return;
    const tag = val.trim();
    setCustomList((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
    const current = Array.isArray(details[field]) ? details[field] : [];
    if (!current.includes(tag)) {
      onChange({ ...details, [field]: [...current, tag] });
    }
  }

  const allAnimales = [...ANIMALES_TAGS, ...customAnimales];
  const allCert = [...CERT_MASCOTAS_TAGS, ...customCert];

  return (
    <div className={className}>
      {showAnosExperiencia && (
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-[#444]">Años de experiencia</label>
          <input
            type="number"
            min="0"
            value={details.anos_experiencia ?? ""}
            onChange={(e) => update("anos_experiencia", e.target.value)}
            className={inputClass}
            style={{ borderColor: BRAND.border }}
          />
        </div>
      )}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[#444]">Animales</p>
        <div className="flex flex-wrap gap-2">
          {allAnimales.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={(details.animalesTags || []).includes(tag)}
              onClick={() => toggleTagInDetails(details, "animalesTags", tag, onChange)}
              color={accentColor}
            />
          ))}
          <TagPill
            label="+ Otro"
            selected={false}
            onClick={() => addCustomTag("animalesTags", setCustomAnimales)}
            color="#666"
          />
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[#444]">Tamaño perro</p>
        <div className="flex flex-wrap gap-2">
          {TAMANO_PERRO_TAGS.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={details.tamanoPerro === tag}
              onClick={() => update("tamanoPerro", tag)}
              color={accentColor}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <ToggleRow
          label="Tiene jardín"
          checked={details.jardin === true}
          onChange={(v) => update("jardin", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Paseos incluidos"
          checked={details.paseosIncluidos === true}
          onChange={(v) => update("paseosIncluidos", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Cerca de veterinario"
          checked={details.cercaVeterinario === true}
          onChange={(v) => update("cercaVeterinario", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Envía fotos y actualizaciones"
          checked={details.fotosActualizaciones === true}
          onChange={(v) => update("fotosActualizaciones", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Disponible para viajar"
          checked={details.disponible_para_viajar === true}
          onChange={(v) => update("disponible_para_viajar", v)}
          accentColor={accentColor}
        />
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[#444]">Certificaciones</p>
        <div className="flex flex-wrap gap-2">
          {allCert.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={(details.certificacionesTags || []).includes(tag)}
              onClick={() => toggleTagInDetails(details, "certificacionesTags", tag, onChange)}
              color={accentColor}
            />
          ))}
          <TagPill
            label="+ Otro"
            selected={false}
            onClick={() => addCustomTag("certificacionesTags", setCustomCert)}
            color="#666"
          />
        </div>
      </div>
    </div>
  );
}
