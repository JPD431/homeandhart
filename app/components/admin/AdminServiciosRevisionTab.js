"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";

const VERTICALS = {
  alojamiento: { label: "Alojamiento", priceSuffix: "/ noche" },
  ninos: { label: "Cuidado de niños", priceSuffix: "/ hora" },
  mascotas: { label: "Cuidado de mascotas", priceSuffix: "/ día" },
};

function formatPrice(precio, vertical) {
  const config = VERTICALS[vertical] ?? VERTICALS.alojamiento;
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${config.priceSuffix}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * @param {{
 *   onSuccess?: (msg: string) => void,
 *   onError?: (msg: string) => void,
 *   onCountChange?: (n: number) => void,
 * }} props
 */
export default function AdminServiciosRevisionTab({
  onSuccess,
  onError,
  onCountChange,
}) {
  const [loading, setLoading] = useState(true);
  const [servicios, setServicios] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const onCountChangeRef = useRef(onCountChange);
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  onCountChangeRef.current = onCountChange;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/servicios/revision");
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onErrorRef.current?.(
          payload.error || "Error al cargar servicios pendientes",
        );
        setServicios([]);
        onCountChangeRef.current?.(0);
        return;
      }
      const list = payload.servicios ?? [];
      setServicios(list);
      onCountChangeRef.current?.(
        payload.meta?.pendientes ?? list.length,
      );
    } catch (err) {
      onErrorRef.current?.(
        err.message || "Error al cargar servicios pendientes",
      );
      setServicios([]);
      onCountChangeRef.current?.(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAction(serviceId, accion, motivo = "") {
    setActionLoading(serviceId);
    onErrorRef.current?.("");
    try {
      const res = await fetch("/api/admin/servicios/revision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_id: serviceId,
          accion,
          motivo: motivo || undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        onErrorRef.current?.(payload.error || `Error al ${accion}`);
        return;
      }
      setRejectingId(null);
      setRejectReason("");
      onSuccessRef.current?.(
        accion === "aprobar"
          ? "Servicio aprobado y publicado ✓"
          : "Servicio rechazado. El proveedor ha sido avisado.",
      );
      await load();
    } catch (err) {
      onErrorRef.current?.(err.message || `Error al ${accion}`);
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <p className="mt-8 text-center text-sm text-[#666]">
        Cargando servicios pendientes…
      </p>
    );
  }

  if (servicios.length === 0) {
    return (
      <div
        className="mt-8 rounded-2xl border bg-white px-6 py-12 text-center"
        style={{ borderColor: BRAND.border }}
      >
        <p className="text-sm text-[#666]">
          No hay servicios pendientes de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col gap-4">
      <p className="text-sm text-[#666]">
        Servicios con estado <strong>en revisión</strong> de cualquier proveedor
        (incluidos los ya verificados). Aprueba o rechaza uno a uno.
      </p>

      {servicios.map((svc) => {
        const verticalLabel =
          VERTICALS[svc.vertical]?.label || svc.vertical || "—";
        const isBusy = actionLoading === svc.id;
        const isRejecting = rejectingId === svc.id;

        return (
          <article
            key={svc.id}
            className="rounded-2xl border bg-white p-5 shadow-sm"
            style={{ borderColor: BRAND.border }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3
                  className="text-lg font-semibold text-[#1a1a1a]"
                  style={{ fontFamily: SERIF }}
                >
                  {svc.titulo || "Sin título"}
                </h3>
                <p className="mt-1 text-sm text-[#666]">
                  {verticalLabel} · {formatPrice(svc.precio, svc.vertical)}
                  {svc.ciudad ? ` · ${svc.ciudad}` : ""}
                </p>
                <p className="mt-2 text-sm text-[#444]">
                  Proveedor:{" "}
                  <strong>{svc.proveedor_nombre}</strong>
                  {svc.proveedor_verificado ? (
                    <span className="ml-2 text-xs font-medium text-[#0e7a5c]">
                      · Ya verificado
                    </span>
                  ) : (
                    <span className="ml-2 text-xs font-medium text-[#c47d1a]">
                      · Perfil pendiente
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-[#888]">
                  Creado: {formatDate(svc.created_at)}
                </p>
              </div>
              <a
                href={`/anuncio/${svc.id}?preview=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ borderColor: BRAND.border, color: BRAND.primary }}
              >
                Ver anuncio →
              </a>
            </div>

            <div
              className="mt-4 border-t pt-4"
              style={{ borderColor: BRAND.border }}
            >
              {isRejecting ? (
                <div className="flex flex-col gap-3">
                  <label className="text-xs font-medium text-[#444]">
                    Motivo del rechazo (opcional, se comunica al proveedor)
                  </label>
                  <textarea
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Explica qué debe corregir…"
                    className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                    style={{ borderColor: BRAND.border }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        handleAction(svc.id, "rechazar", rejectReason)
                      }
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {isBusy ? "Guardando…" : "Confirmar rechazo ✗"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                      style={{ borderColor: BRAND.border }}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAction(svc.id, "aprobar")}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {isBusy ? "Guardando…" : "Aprobar ✓"}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => {
                      setRejectingId(svc.id);
                      setRejectReason("");
                    }}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-red-700 transition-opacity hover:opacity-80 disabled:opacity-60"
                    style={{
                      borderColor: "#fecaca",
                      backgroundColor: "#fef2f2",
                    }}
                  >
                    Rechazar
                  </button>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
