"use client";

import { useState } from "react";
import TagPill from "@/app/components/provider/TagPill";
import ToggleRow from "@/app/components/provider/ToggleRow";
import { BRAND } from "@/app/components/brand";
import { PROVIDER_INPUT_CLASS } from "@/app/lib/provider-form-labels";
import {
  ACTIVIDADES_TAGS,
  EDADES_TAGS,
  FORMACION_TAGS,
} from "@/app/lib/service-form-tags";

const inputClass = PROVIDER_INPUT_CLASS;

function toggleTagInDetails(details, field, tag, onChange) {
  const current = Array.isArray(details[field]) ? details[field] : [];
  const next = current.includes(tag)
    ? current.filter((t) => t !== tag)
    : [...current, tag];
  onChange({ ...details, [field]: next });
}

export default function NinosServiceFields({
  details,
  onChange,
  accentColor,
  className = "",
  showAnosExperiencia = true,
}) {
  const [customFormacion, setCustomFormacion] = useState([]);
  const [customActividades, setCustomActividades] = useState([]);

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

  const allFormacion = [...FORMACION_TAGS, ...customFormacion];
  const allActividades = [...ACTIVIDADES_TAGS, ...customActividades];

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
        <p className="mb-2 text-xs font-medium text-[#444]">Rango de edad</p>
        <div className="flex flex-wrap gap-2">
          {EDADES_TAGS.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={(details.edadesTags || []).includes(tag)}
              onClick={() => toggleTagInDetails(details, "edadesTags", tag, onChange)}
              color={accentColor}
            />
          ))}
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[#444]">Formación</p>
        <div className="flex flex-wrap gap-2">
          {allFormacion.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={(details.formacionTags || []).includes(tag)}
              onClick={() => toggleTagInDetails(details, "formacionTags", tag, onChange)}
              color={accentColor}
            />
          ))}
          <TagPill
            label="+ Otro"
            selected={false}
            onClick={() => addCustomTag("formacionTags", setCustomFormacion)}
            color="#666"
          />
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-[#444]">Actividades</p>
        <div className="flex flex-wrap gap-2">
          {allActividades.map((tag) => (
            <TagPill
              key={tag}
              label={tag}
              selected={(details.actividadesTags || []).includes(tag)}
              onClick={() => toggleTagInDetails(details, "actividadesTags", tag, onChange)}
              color={accentColor}
            />
          ))}
          <TagPill
            label="+ Otro"
            selected={false}
            onClick={() => addCustomTag("actividadesTags", setCustomActividades)}
            color="#666"
          />
        </div>
      </div>
      <div className="mt-4 rounded-xl border p-4" style={{ borderColor: BRAND.border }}>
        <ToggleRow
          label="Disponible para viajar"
          checked={details.disponible_para_viajar === true}
          onChange={(v) => update("disponible_para_viajar", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Noches y fines de semana"
          checked={details.nochesFinde === true}
          onChange={(v) => update("nochesFinde", v)}
          accentColor={accentColor}
        />
        <ToggleRow
          label="Carnet de conducir"
          checked={details.carnetConducir === true}
          onChange={(v) => update("carnetConducir", v)}
          accentColor={accentColor}
        />
      </div>
    </div>
  );
}
