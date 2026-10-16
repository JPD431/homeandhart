"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

export default function ConfirmarServicioPage() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const tc = t.confirmarServicio;
  const { bookingId } = useParams();
  const searchParams = useSearchParams();
  const resultado = searchParams.get("resultado");
  const token = searchParams.get("token");
  const router = useRouter();
  const [estado, setEstado] = useState("cargando");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (!token) {
      setEstado("no_autorizado");
      return;
    }

    if (resultado === "ok") {
      confirmarOk();
    } else {
      setEstado("formulario_problema");
    }
  }, [resultado, token]);

  async function confirmarOk() {
    try {
      const res = await fetch("/api/bookings/completar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, token }),
      });

      if (!res.ok) {
        setEstado("no_autorizado");
        return;
      }

      setEstado("confirmado");
    } catch (err) {
      console.error("Error completando reserva / liberando pago:", err);
      setEstado("no_autorizado");
    }
  }

  async function reportarProblema() {
    try {
      const res = await fetch("/api/bookings/reportar-problema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          token,
          comentario,
        }),
      });

      if (!res.ok) {
        setEstado("no_autorizado");
        return;
      }

      setEstado("reportado");
    } catch (err) {
      console.error("Error reportando problema:", err);
      setEstado("no_autorizado");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "40px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          border: "0.5px solid #e8e4de",
        }}
      >
        {estado === "no_autorizado" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
            <h1
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 24,
                color: "#2a3a4a",
                marginBottom: 8,
              }}
            >
              {tc.enlaceNoValido}
            </h1>
            <p style={{ fontSize: 14, color: "#888" }}>
              {tc.enlaceExpirado}
            </p>
          </>
        )}

        {estado === "confirmado" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h1
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 24,
                color: "#2a3a4a",
                marginBottom: 8,
              }}
            >
              {tc.gracias}
            </h1>
            <p style={{ fontSize: 14, color: "#888" }}>
              {tc.servicioRealizado}
            </p>
            <button
              onClick={() => router.push(`/resena/${bookingId}`)}
              style={{
                marginTop: 20,
                background: "#1d4f91",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: 6,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tc.dejarResena}
            </button>
          </>
        )}

        {estado === "formulario_problema" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 24,
                color: "#2a3a4a",
                marginBottom: 8,
              }}
            >
              {tc.cuentanosQuePaso}
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              {tc.equipoContactara}
            </p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={tc.describePlaceholder}
              style={{
                width: "100%",
                minHeight: 100,
                padding: 12,
                borderRadius: 8,
                border: "1px solid #e8e4de",
                fontSize: 13,
                marginBottom: 16,
              }}
            />
            <button
              onClick={reportarProblema}
              style={{
                width: "100%",
                background: "#c47d1a",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: 6,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tc.enviarReporte}
            </button>
          </>
        )}

        {estado === "reportado" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📩</div>
            <h1
              style={{
                fontFamily: "Georgia,serif",
                fontSize: 24,
                color: "#2a3a4a",
                marginBottom: 8,
              }}
            >
              {tc.reporteEnviado}
            </h1>
            <p style={{ fontSize: 14, color: "#888" }}>
              {tc.pagoRetenido}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
