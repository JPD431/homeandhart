"use client";

import { useEffect } from "react";

const PRIMARY = "#1d4f91";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const SERIF = 'Georgia, "Times New Roman", Times, serif';

/**
 * Error boundary del layout raíz.
 * Debe incluir html/body porque sustituye el root layout.
 */
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    try {
      console.error("[app/global-error]", error);
    } catch {
      // no-op
    }
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          fontFamily:
            'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
          backgroundColor: WARM,
          color: "#1a1a1a",
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "48px 24px",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            Home
            <span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
            Heart
          </p>
          <h1
            style={{
              margin: "32px 0 0",
              maxWidth: 420,
              fontFamily: SERIF,
              fontSize: 22,
              fontWeight: 400,
              lineHeight: 1.35,
            }}
          >
            Algo no ha ido bien
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              maxWidth: 360,
              fontSize: 14,
              lineHeight: 1.6,
              color: "#666",
            }}
          >
            No te preocupes, no es culpa tuya. Puedes reintentar o volver al
            inicio.
          </p>
          <div
            style={{
              marginTop: 32,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => {
                try {
                  reset();
                } catch (err) {
                  console.error("[app/global-error] reset failed", err);
                }
              }}
              style={{
                minHeight: 44,
                border: "none",
                borderRadius: 12,
                padding: "0 20px",
                backgroundColor: PRIMARY,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <a
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "0 20px",
                color: PRIMARY,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                backgroundColor: "#fff",
              }}
            >
              Ir al inicio
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
