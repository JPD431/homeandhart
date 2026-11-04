"use client";

import { useState } from "react";
import { BRAND } from "@/app/components/brand";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

/**
 * Formulario ligero de ayuda general → POST /api/soporte.
 */
export default function AyudaSoporteForm({
  highlighted = false,
  defaultAsunto = "",
  compact = false,
}) {
  const { lang } = useLang();
  const f = useTranslation(lang).ayuda.form;
  const [asunto, setAsunto] = useState(defaultAsunto);
  const [mensaje, setMensaje] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/soporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asunto: asunto.trim(),
          mensaje: mensaje.trim(),
          page_url:
            typeof window !== "undefined" ? window.location.href : "",
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || f.errorEnvio);
      }
      setSuccess(true);
      setMensaje("");
    } catch (err) {
      setError(err.message || f.errorGenerico);
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div
        role="status"
        style={{
          padding: compact ? "12px 14px" : "16px",
          borderRadius: 10,
          border: `1px solid ${BRAND.green}`,
          background: "#e6f4f0",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#085041" }}>
          {f.enviado}
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#085041", lineHeight: 1.5 }}>
          {f.respuesta}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        padding: compact ? "12px 14px" : "16px",
        borderRadius: 10,
        border: highlighted
          ? `1px solid ${BRAND.blue}`
          : `1px solid ${BRAND.border}`,
        background: highlighted ? "#e8f0fb" : "#fff",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 600,
          color: "#2a3a4a",
        }}
      >
        {f.titulo}
      </p>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 12,
          color: "#666",
          lineHeight: 1.45,
        }}
      >
        {f.intro}
      </p>

      <label
        htmlFor="ayuda-asunto"
        style={{
          display: "block",
          marginTop: 12,
          fontSize: 11,
          fontWeight: 600,
          color: "#444",
        }}
      >
        {f.asunto}
      </label>
      <input
        id="ayuda-asunto"
        type="text"
        value={asunto}
        onChange={(e) => setAsunto(e.target.value)}
        maxLength={160}
        required
        placeholder={f.asuntoPh}
        aria-required="true"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "ayuda-error" : undefined}
        style={{
          width: "100%",
          marginTop: 4,
          minHeight: 40,
          borderRadius: 8,
          border: `1px solid ${BRAND.border}`,
          padding: "8px 12px",
          fontSize: 13,
          outline: "none",
        }}
      />

      <label
        htmlFor="ayuda-mensaje"
        style={{
          display: "block",
          marginTop: 10,
          fontSize: 11,
          fontWeight: 600,
          color: "#444",
        }}
      >
        {f.mensaje}
      </label>
      <textarea
        id="ayuda-mensaje"
        value={mensaje}
        onChange={(e) => setMensaje(e.target.value)}
        rows={compact ? 3 : 5}
        maxLength={4000}
        required
        placeholder={f.mensajePh}
        aria-required="true"
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "ayuda-error" : undefined}
        style={{
          width: "100%",
          marginTop: 4,
          borderRadius: 8,
          border: `1px solid ${BRAND.border}`,
          padding: "8px 12px",
          fontSize: 13,
          outline: "none",
          resize: "vertical",
        }}
      />

      {error && (
        <p
          id="ayuda-error"
          role="alert"
          style={{ margin: "8px 0 0", fontSize: 12, color: "#b91c1c" }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          marginTop: 12,
          minHeight: 44,
          padding: "10px 18px",
          borderRadius: 6,
          border: "none",
          background: BRAND.blue,
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? "Enviando…" : "Enviar a soporte"}
      </button>
    </form>
  );
}
