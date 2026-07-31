"use client";

import { useState } from "react";
import { BRAND } from "@/app/components/brand";
import { MOTIVOS_INCIDENCIA_RESERVA } from "@/app/lib/booking-incidencia";

const inputClass =
  "w-full rounded-lg border px-3 py-2 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

export default function ReportarIncidenciaForm({
  bookingId,
  onSuccess,
  buttonLabel = "Reportar incidencia",
  compact = false,
}) {
  const [open, setOpen] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_INCIDENCIA_RESERVA[0]);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div
        className="rounded-lg border px-4 py-3 text-sm"
        style={{ borderColor: BRAND.border, backgroundColor: "#fef3c7", color: "#92400e" }}
      >
        Hemos recibido tu reporte. Nuestro equipo lo revisará y te contactará pronto.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? "rounded-md border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-[#f7f5f2]"
            : "rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-[#f7f5f2]"
        }
        style={{ borderColor: "#c47d1a", color: "#c47d1a", backgroundColor: "#fff" }}
      >
        {buttonLabel}
      </button>
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!comentario.trim()) {
      setError("Describe el problema antes de enviar.");
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/bookings/reportar-incidencia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId, motivo, comentario: comentario.trim() }),
    });

    const data = await res.json().catch(() => ({}));

    setSubmitting(false);

    if (!res.ok) {
      setError(data.error || "No se pudo enviar el reporte.");
      return;
    }

    setSuccess(true);
    onSuccess?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border p-4"
      style={{ borderColor: BRAND.border, backgroundColor: "#f7f5f2" }}
    >
      <p className="text-sm font-semibold text-[#1a1a1a]">Reportar incidencia</p>
      <p className="mt-1 text-xs text-[#666]">
        Cuéntanos qué ha ocurrido con el servicio. El pago quedará retenido hasta
        resolver la incidencia y nuestro equipo lo revisará.
      </p>

      <div className="mt-3">
        <label htmlFor={`incidencia-motivo-${bookingId}`} className="mb-1 block text-xs font-medium text-[#444]">
          Motivo
        </label>
        <select
          id={`incidencia-motivo-${bookingId}`}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className={inputClass}
          style={{ borderColor: BRAND.border }}
        >
          {MOTIVOS_INCIDENCIA_RESERVA.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3">
        <label htmlFor={`incidencia-desc-${bookingId}`} className="mb-1 block text-xs font-medium text-[#444]">
          Descripción
        </label>
        <textarea
          id={`incidencia-desc-${bookingId}`}
          rows={3}
          required
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder="Describe el problema con el mayor detalle posible…"
          className={`${inputClass} resize-y`}
          style={{ borderColor: BRAND.border }}
        />
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting || !comentario.trim()}
          className="rounded-lg bg-[#c47d1a] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Enviando…" : "Enviar reporte"}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#666] transition-colors hover:bg-white disabled:opacity-60"
          style={{ borderColor: BRAND.border }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
