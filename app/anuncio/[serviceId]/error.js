"use client";

import { useEffect } from "react";

/**
 * Error boundary temporal de /anuncio/[serviceId] para diagnosticar el 500.
 * Muestra message + digest en pantalla y loguea el error completo.
 */
export default function Error({ error, reset }) {
  useEffect(() => {
    console.error("[anuncio] error boundary:", error);
    console.error("[anuncio] error boundary detail:", {
      message: error?.message,
      stack: error?.stack,
      digest: error?.digest,
      name: error?.name,
      cause: error?.cause,
    });
  }, [error]);

  return (
    <div
      style={{
        minHeight: "50vh",
        padding: "2rem 1.25rem",
        fontFamily: "system-ui, sans-serif",
        backgroundColor: "#f7f5f2",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: "0 auto",
          border: "1px solid #e8e4de",
          borderRadius: 12,
          background: "#fff",
          padding: "1.25rem 1.5rem",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "#888",
          }}
        >
          Diagnóstico temporal · /anuncio
        </p>
        <h1
          style={{
            margin: "0.5rem 0 1rem",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          Error al cargar el anuncio
        </h1>
        <p style={{ margin: "0 0 0.75rem", fontSize: 14, color: "#444" }}>
          <strong>message:</strong>{" "}
          <code style={{ wordBreak: "break-word" }}>
            {error?.message || "(sin message)"}
          </code>
        </p>
        <p style={{ margin: "0 0 1.25rem", fontSize: 13, color: "#666" }}>
          <strong>digest:</strong>{" "}
          <code>{error?.digest || "(sin digest)"}</code>
        </p>
        {error?.stack ? (
          <pre
            style={{
              margin: "0 0 1.25rem",
              padding: "0.75rem",
              fontSize: 11,
              lineHeight: 1.4,
              overflow: "auto",
              maxHeight: 240,
              background: "#fafaf9",
              border: "1px solid #eee",
              borderRadius: 8,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {error.stack}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          style={{
            border: "none",
            borderRadius: 8,
            padding: "0.65rem 1.1rem",
            background: "#1d4f91",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
