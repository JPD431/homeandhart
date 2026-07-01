import { needsDireccionFields } from "@/app/lib/service-payload";
import { DIRECCION_LABELS } from "@/app/lib/provider-form-labels";

export default function DireccionContactoFields({ d, upd, vertical }) {
  if (!needsDireccionFields(vertical, d.modalidad)) return null;
  return (
    <>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          {DIRECCION_LABELS.direccion}
        </label>
        <input
          type="text"
          value={d.direccion_exacta || ""}
          onChange={(e) => upd("direccion_exacta", e.target.value)}
          placeholder={DIRECCION_LABELS.direccionPlaceholder}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e8e4de",
            fontSize: 13,
          }}
        />
        <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
          {DIRECCION_LABELS.direccionHint}
        </p>
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-xs font-medium text-[#444]">
          {DIRECCION_LABELS.telefono}
        </label>
        <input
          type="tel"
          value={d.telefono_contacto || ""}
          onChange={(e) => upd("telefono_contacto", e.target.value)}
          placeholder={DIRECCION_LABELS.telefonoPlaceholder}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 8,
            border: "1px solid #e8e4de",
            fontSize: 13,
          }}
        />
      </div>
    </>
  );
}
