"use client";

import { getBookingStatusMeta } from "@/app/lib/booking-display";

/**
 * Badge + descripción opcional de estado de reserva (cliente / proveedor).
 */
export default function BookingStatusBadge({
  status,
  role = "cliente",
  size = "md",
  showDescription = false,
  className = "",
}) {
  const meta = getBookingStatusMeta(status, { role });
  const padding = size === "sm" ? "2px 7px" : "3px 10px";
  const fontSize = size === "sm" ? 10 : 12;

  return (
    <div className={className}>
      <span
        className="inline-flex rounded-full font-semibold"
        style={{
          backgroundColor: meta.bg,
          color: meta.color,
          padding,
          fontSize,
          whiteSpace: "nowrap",
        }}
      >
        {meta.label}
      </span>
      {showDescription && meta.description && (
        <p
          className="mt-1.5 text-[11px] leading-relaxed text-[#666]"
          style={{ maxWidth: 360 }}
        >
          {meta.description}
        </p>
      )}
    </div>
  );
}
