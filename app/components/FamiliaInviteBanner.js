"use client";

import { useCallback, useEffect, useState } from "react";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";
const BORDER = "#e8e4de";

function isDismissed(id) {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(`familia_invite_dismiss_${id}`) === "1";
}

function dismissInvite(id) {
  sessionStorage.setItem(`familia_invite_dismiss_${id}`, "1");
}

export default function FamiliaInviteBanner({ onAccepted, compact = false }) {
  const [invitaciones, setInvitaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState(null);
  const [error, setError] = useState("");

  const loadInvitaciones = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/familia/invitaciones-pendientes");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setInvitaciones([]);
        return;
      }
      const visibles = (data.invitaciones ?? []).filter(
        (inv) => !isDismissed(inv.id),
      );
      setInvitaciones(visibles);
    } catch {
      setInvitaciones([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvitaciones();
  }, [loadInvitaciones]);

  async function handleAccept(invitacionId) {
    setAcceptingId(invitacionId);
    setError("");

    try {
      const res = await fetch("/api/familia/aceptar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitacion_id: invitacionId }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "No se pudo aceptar la invitación.");
        setAcceptingId(null);
        return;
      }

      setInvitaciones((prev) => prev.filter((inv) => inv.id !== invitacionId));
      setAcceptingId(null);
      onAccepted?.(data);
    } catch {
      setError("Error de conexión al aceptar la invitación.");
      setAcceptingId(null);
    }
  }

  function handleDismiss(invitacionId) {
    dismissInvite(invitacionId);
    setInvitaciones((prev) => prev.filter((inv) => inv.id !== invitacionId));
  }

  if (loading || invitaciones.length === 0) return null;

  const invitacion = invitaciones[0];
  const familiaNombre = invitacion.familia_nombre || "Home&Heart";

  return (
    <div
      className={compact ? "rounded-lg border px-4 py-3" : "rounded-xl border px-5 py-4"}
      style={{
        borderColor: BORDER,
        backgroundColor: "#fff",
        borderLeft: `4px solid ${GREEN}`,
      }}
    >
      <p
        className={compact ? "text-sm leading-relaxed text-[#444]" : "text-[15px] leading-relaxed text-[#444]"}
      >
        Te han invitado a unirte a la familia{" "}
        <strong style={{ color: PRIMARY }}>{familiaNombre}</strong>.
      </p>
      {error && (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={acceptingId === invitacion.id}
          onClick={() => handleAccept(invitacion.id)}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ backgroundColor: GREEN }}
        >
          {acceptingId === invitacion.id ? "Uniéndote…" : "Unirme"}
        </button>
        <button
          type="button"
          disabled={acceptingId === invitacion.id}
          onClick={() => handleDismiss(invitacion.id)}
          className="rounded-lg border px-4 py-2 text-sm font-medium text-[#666]"
          style={{ borderColor: BORDER, backgroundColor: "#fafafa" }}
        >
          Ahora no
        </button>
      </div>
      {invitaciones.length > 1 && (
        <p className="mt-2 text-xs text-[#888]">
          Tienes {invitaciones.length} invitaciones pendientes. Responde a una cada vez.
        </p>
      )}
    </div>
  );
}

export { dismissInvite, isDismissed };
