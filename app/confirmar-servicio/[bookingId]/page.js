"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function ConfirmarServicioPage() {
  const { bookingId } = useParams();
  const searchParams = useSearchParams();
  const resultado = searchParams.get("resultado");
  const router = useRouter();
  const [estado, setEstado] = useState("cargando");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    if (resultado === "ok") {
      confirmarOk();
    } else {
      setEstado("formulario_problema");
    }
  }, [resultado]);

  async function confirmarOk() {
    await supabase
      .from("bookings")
      .update({
        confirmacion_cliente: "ok",
        confirmado_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    try {
      await fetch("/api/stripe/capture-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
    } catch (err) {
      console.error("Error liberando pago:", err);
    }

    setEstado("confirmado");
  }

  async function reportarProblema() {
    await supabase
      .from("bookings")
      .update({
        confirmacion_cliente: "problema",
        comentario_problema: comentario,
        confirmado_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    setEstado("reportado");
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
              ¡Gracias!
            </h1>
            <p style={{ fontSize: 14, color: "#888" }}>
              Hemos liberado el pago al proveedor. ¿Quieres dejar una reseña?
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
              Dejar reseña →
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
              Cuéntanos qué pasó
            </h1>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 16 }}>
              Nuestro equipo revisará tu caso y te contactará en menos de 24h.
            </p>
            <textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Describe el problema..."
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
              Enviar reporte →
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
              Reporte enviado
            </h1>
            <p style={{ fontSize: 14, color: "#888" }}>
              El pago queda retenido hasta resolver la incidencia. Te contactaremos
              pronto.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
