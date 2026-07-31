"use client";

import Link from "next/link";
import { BRAND } from "@/app/components/brand";

/**
 * Aviso suave (no bloqueante): anuncio débil vs blockers duros de activación.
 */
export default function ListingWeakBanner({
  href = "/editar-perfil?tab=servicios",
  compact = false,
  titles = [],
}) {
  const name =
    titles.length === 1
      ? `«${titles[0]}»`
      : titles.length > 1
        ? "algunos de tus anuncios"
        : "tu anuncio";

  return (
    <div
      role="status"
      style={{
        marginTop: compact ? 0 : 12,
        marginBottom: compact ? 12 : 0,
        padding: compact ? "10px 12px" : "12px 14px",
        borderRadius: 8,
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: compact ? 12 : 13,
          fontWeight: 600,
          color: "#1e3a5f",
        }}
      >
        Recomendado para destacar
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          color: "#334155",
          lineHeight: 1.5,
        }}
      >
        {name.charAt(0).toUpperCase() + name.slice(1)} aún no está listo para
        destacar — complétalo (fotos, dirección, calendario) para recibir más
        reservas. Esto no bloquea la activación; es distinto de cobros o DNI.
      </p>
      <Link
        href={href}
        style={{
          display: "inline-block",
          marginTop: 8,
          fontSize: 12,
          fontWeight: 600,
          color: BRAND.primary,
        }}
      >
        Completar anuncio →
      </Link>
    </div>
  );
}
