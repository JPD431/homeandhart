"use client";

import { useState } from "react";
import ReportarModal from "@/app/components/ReportarModal";

export default function ReportarPerfilButton({ proveedorId, proveedorNombre }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <p className="mt-10 text-center text-xs text-[#6b6b6b]">
        ¿Algo va mal?{" "}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[#6b6b6b] underline transition-colors hover:text-[#1d4f91]"
        >
          Reportar este perfil
        </button>
      </p>

      <ReportarModal
        open={open}
        onClose={() => setOpen(false)}
        reportedName={proveedorNombre}
        reportedId={proveedorId}
        tipo="proveedor"
      />
    </>
  );
}
