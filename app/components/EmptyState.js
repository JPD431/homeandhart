"use client";

import Link from "next/link";

/**
 * Estado vacío guiado: explicación + CTA opcional.
 */
export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  compact = false,
  className = "",
}) {
  const padding = compact ? "16px 12px" : "28px 20px";

  return (
    <div
      className={className}
      style={{
        textAlign: "center",
        padding,
        borderRadius: 10,
      }}
    >
      {title && (
        <p
          style={{
            margin: 0,
            fontSize: compact ? 13 : 14,
            fontWeight: 600,
            color: "#2a3a4a",
            lineHeight: 1.4,
          }}
        >
          {title}
        </p>
      )}
      {description && (
        <p
          style={{
            margin: title ? "6px 0 0" : 0,
            fontSize: compact ? 11 : 13,
            color: "#888",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {(actionHref || onAction) && actionLabel && (
        <div style={{ marginTop: compact ? 12 : 16 }}>
          {actionHref ? (
            <Link
              href={actionHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 44,
                padding: "10px 18px",
                borderRadius: 6,
                background: "#1d4f91",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              {actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={onAction}
              style={{
                minHeight: 44,
                padding: "10px 18px",
                borderRadius: 6,
                background: "#1d4f91",
                color: "#fff",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {actionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
