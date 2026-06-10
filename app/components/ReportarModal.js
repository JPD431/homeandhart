"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/app/components/brand";
import { supabase } from "@/app/lib/supabase";

// -- CREATE TABLE reports (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   reporter_id uuid REFERENCES profiles(id),
// --   reported_id uuid REFERENCES profiles(id),
// --   booking_id uuid REFERENCES bookings(id),
// --   tipo text CHECK (tipo IN ('proveedor', 'cliente', 'servicio')),
// --   motivo text NOT NULL,
// --   descripcion text,
// --   estado text DEFAULT 'pendiente',
// --   created_at timestamp with time zone DEFAULT now()
// -- );

const MOTIVOS = [
  "Información falsa o engañosa",
  "Comportamiento inapropiado",
  "No se presentó al servicio",
  "Perfil suplantado",
  "Contenido ofensivo",
  "Otro",
];

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

export default function ReportarModal({
  open,
  onClose,
  reportedName,
  reportedId,
  bookingId = null,
  tipo,
  fechaInicio = null,
  fechaFin = null,
}) {
  const [motivo, setMotivo] = useState(MOTIVOS[0]);
  const [descripcion, setDescripcion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMotivo(MOTIVOS[0]);
    setDescripcion("");
    setSubmitting(false);
    setError("");
    setSuccess(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!descripcion.trim()) {
      setError("Describe el problema antes de enviar.");
      return;
    }

    setSubmitting(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSubmitting(false);
      setError("Debes iniciar sesión para enviar un reporte.");
      return;
    }

    const { data: reporterProfile } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", user.id)
      .single();

    const reporterNombre =
      [reporterProfile?.nombre, reporterProfile?.apellido]
        .filter(Boolean)
        .join(" ") || "Usuario";

    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      reported_id: reportedId,
      booking_id: bookingId,
      tipo,
      motivo,
      descripcion: descripcion.trim(),
      estado: "pendiente",
    });

    if (insertError) {
      setSubmitting(false);
      setError(insertError.message);
      return;
    }

    await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "incidencia",
        booking_id: bookingId || "—",
        cliente_nombre: reporterNombre,
        fecha_inicio: fechaInicio || "—",
        fecha_fin: fechaFin || fechaInicio || "—",
        descripcion: `Nuevo reporte (${tipo})\nMotivo: ${motivo}\nReportado: ${reportedName}\n\n${descripcion.trim()}`,
      }),
    });

    setSubmitting(false);
    setSuccess(true);
  }

  function handleClose() {
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg"
        style={{ borderColor: BRAND.border }}
        role="dialog"
        aria-labelledby="reportar-title"
      >
        {success ? (
          <div className="text-center">
            <p className="text-lg font-semibold text-green-700">
              Reporte enviado. Nuestro equipo lo revisará en 24h.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: BRAND.primary }}
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2
              id="reportar-title"
              className="text-lg font-semibold text-[#1a1a1a]"
            >
              Reportar {reportedName}
            </h2>

            <div className="mt-4">
              <label
                htmlFor="report-motivo"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Motivo
              </label>
              <select
                id="report-motivo"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              >
                {MOTIVOS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label
                htmlFor="report-descripcion"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Describe el problema
              </label>
              <textarea
                id="report-descripcion"
                rows={4}
                required
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Cuéntanos qué ha ocurrido..."
                className={`${inputClass} resize-y`}
                style={{ borderColor: BRAND.border }}
              />
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={submitting}
                onClick={handleClose}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#666] transition-colors hover:bg-[#f7f5f2] disabled:opacity-60"
                style={{ borderColor: BRAND.border }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting || !descripcion.trim()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Enviando…" : "Enviar reporte"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
