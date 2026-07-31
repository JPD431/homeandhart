"use client";

import Link from "next/link";
import { BRAND } from "@/app/components/brand";

/**
 * Acceso discreto (o un poco más destacado) a /ayuda.
 */
export default function AyudaLink({
  highlighted = false,
  label = "¿Necesitas ayuda?",
  href = "/ayuda",
  style = {},
}) {
  if (highlighted) {
    return (
      <Link
        href={href}
        style={{
          display: "inline-flex",
          alignItems: "center",
          minHeight: 36,
          marginTop: 10,
          padding: "8px 14px",
          borderRadius: 6,
          border: `1px solid ${BRAND.blue}`,
          background: "#e8f0fb",
          color: "#163a6b",
          fontSize: 12,
          fontWeight: 600,
          textDecoration: "none",
          ...style,
        }}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      style={{
        display: "inline-block",
        marginTop: 8,
        fontSize: 12,
        fontWeight: 500,
        color: BRAND.blue,
        textDecoration: "underline",
        textUnderlineOffset: 2,
        ...style,
      }}
    >
      {label}
    </Link>
  );
}
