"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BRAND } from "@/app/components/brand";
import { loadProviderDocuments } from "@/app/lib/provider-uploads";
import { loadServiceContactsByIds } from "@/app/lib/service-contact";
import { parseFotosFromDb } from "@/app/lib/service-photos";
import {
  getAlojamientoListingCompleteness,
  hasCalendarReviewed,
  listingEditHref,
} from "@/app/lib/listing-completeness";
import { supabase } from "@/app/lib/supabase";

/**
 * Checklist de completitud del anuncio (calidad), separado de "Tu cuenta".
 */
export default function ProviderListingChecklist({ perfil, BRAND: brandProp }) {
  const brand = brandProp || BRAND;
  const [services, setServices] = useState([]);
  const [documentContext, setDocumentContext] = useState(null);
  const [calendarTick, setCalendarTick] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!perfil?.id || perfil.role !== "proveedor") {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("services")
          .select(
            "id, titulo, vertical, precio, fotos, foto_url, nru, nru_estado, details, descripcion",
          )
          .eq("proveedor_id", perfil.id)
          .eq("vertical", "alojamiento");
        if (error) throw error;
        const rows = data || [];
        const contactById = await loadServiceContactsByIds(
          rows.map((r) => r.id),
        );
        let docs = [];
        try {
          docs = await loadProviderDocuments(perfil.id);
        } catch {
          docs = [];
        }
        if (cancelled) return;

        const mapped = rows.map((row) => {
          const contact = contactById.get(row.id);
          const details =
            row.details && typeof row.details === "object" ? row.details : {};
          return {
            ...row,
            details: {
              ...details,
              titulo: details.titulo || row.titulo,
              precio: details.precio ?? row.precio,
              descripcion: details.descripcion || row.descripcion || "",
              fotos: parseFotosFromDb(row),
              nru: details.nru || row.nru,
              direccion_exacta:
                details.direccion_exacta ||
                contact?.direccion_exacta ||
                "",
              oferta_activa: details.oferta_activa,
              descuentos_duracion_activa: details.descuentos_duracion_activa,
              proveedor_emergencia: details.proveedor_emergencia,
            },
            direccion_exacta: contact?.direccion_exacta || "",
          };
        });
        setServices(mapped);
        setDocumentContext({
          profile: {
            doc_dni_url: perfil.doc_dni_url,
          },
          providerDocuments: docs,
          services: mapped.map((s) => ({
            vertical: "alojamiento",
            nru: s.nru || s.details?.nru,
            details: s.details,
          })),
        });
      } catch (err) {
        console.error("[ProviderListingChecklist]", err);
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [perfil?.id, perfil?.role, perfil?.doc_dni_url]);

  useEffect(() => {
    function bump() {
      setCalendarTick((t) => t + 1);
    }
    function onStorage(e) {
      if (e.key && e.key.startsWith("hh_calendar_seen_")) bump();
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("hh-calendar-reviewed", bump);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hh-calendar-reviewed", bump);
    };
  }, []);

  const listings = useMemo(() => {
    void calendarTick;
    return services.map((svc) =>
      getAlojamientoListingCompleteness(svc, {
        documentContext,
        calendarReviewed: hasCalendarReviewed(svc.id),
      }),
    );
  }, [services, documentContext, calendarTick]);

  if (perfil?.role !== "proveedor") return null;
  if (loading) return null;
  if (listings.length === 0) return null;

  const anyWeak = listings.some((l) => l.isWeak);

  return (
    <div
      style={{
        marginTop: 12,
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px solid ${anyWeak ? "#93c5fd" : brand.green || "#0e7a5c"}`,
        background: anyWeak ? "#eff6ff" : "#e6f4f0",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: anyWeak ? "#1e3a5f" : "#085041",
        }}
      >
        Tu anuncio
      </p>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 12,
          color: anyWeak ? "#475569" : "#085041",
          lineHeight: 1.45,
        }}
      >
        Completitud para destacar (recomendado). Distinto de lo obligatorio para
        activar (DNI, cobros, verificación).
      </p>

      {listings.map((listing) => (
        <div
          key={listing.serviceId || listing.titulo}
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: "0.5px solid rgba(148,163,184,0.45)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                fontWeight: 600,
                color: "#1a1a1a",
              }}
            >
              {listing.titulo || "Alojamiento"}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 600,
                color: brand.primary || BRAND.primary,
                whiteSpace: "nowrap",
              }}
            >
              {listing.doneCount}/{listing.totalCount} · {listing.pct}%
            </p>
          </div>
          <div
            style={{
              marginTop: 6,
              height: 6,
              borderRadius: 999,
              background: "#e2e8f0",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${listing.pct}%`,
                height: "100%",
                background: brand.primary || BRAND.primary,
                borderRadius: 999,
              }}
            />
          </div>
          <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
            {listing.items.map((item, index) => (
              <li
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "6px 0",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 700,
                    background: item.done
                      ? brand.green || "#0e7a5c"
                      : item.optional
                        ? "#fff"
                        : "#fff",
                    color: item.done
                      ? "#fff"
                      : item.optional
                        ? "#64748b"
                        : "#1d4f91",
                    border: item.done
                      ? "none"
                      : `1.5px solid ${item.optional ? "#94a3b8" : "#1d4f91"}`,
                  }}
                >
                  {item.done ? "✓" : item.optional ? "·" : index + 1}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 500,
                      color: item.done ? "#085041" : "#2a3a4a",
                      textDecoration: item.done ? "line-through" : "none",
                      opacity: item.done ? 0.75 : 1,
                    }}
                  >
                    {item.label}
                    {item.optional ? (
                      <span style={{ color: "#888", fontWeight: 400 }}>
                        {" "}
                        · opcional
                      </span>
                    ) : null}
                  </p>
                  {!item.done && item.hint ? (
                    <p
                      style={{
                        margin: "2px 0 0",
                        fontSize: 11,
                        color: "#64748b",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.hint}
                    </p>
                  ) : null}
                  {listing.serviceId && !item.done ? (
                    <Link
                      href={
                        item.section === "documentos"
                          ? "/editar-perfil?tab=documentos"
                          : listingEditHref(
                              listing.serviceId,
                              item.section || undefined,
                            )
                      }
                      style={{
                        display: "inline-block",
                        marginTop: 3,
                        fontSize: 11,
                        fontWeight: 600,
                        color: brand.primary || BRAND.primary,
                      }}
                    >
                      Completar →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * Hook helper: carga alojamientos débiles para banners.
 */
export function useWeakAlojamientoListings(perfilId) {
  const [weak, setWeak] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!perfilId) {
        setWeak([]);
        return;
      }
      try {
        const { data, error } = await supabase
          .from("services")
          .select("id, titulo, vertical, fotos, foto_url, details")
          .eq("proveedor_id", perfilId)
          .eq("vertical", "alojamiento");
        if (error) throw error;
        const rows = data || [];
        const contactById = await loadServiceContactsByIds(
          rows.map((r) => r.id),
        );
        if (cancelled) return;
        const weakList = [];
        for (const row of rows) {
          const contact = contactById.get(row.id);
          const details =
            row.details && typeof row.details === "object" ? row.details : {};
          const service = {
            ...row,
            details: {
              ...details,
              fotos: parseFotosFromDb(row),
              direccion_exacta:
                details.direccion_exacta || contact?.direccion_exacta || "",
            },
            direccion_exacta: contact?.direccion_exacta || "",
          };
          const c = getAlojamientoListingCompleteness(service, {
            calendarReviewed: hasCalendarReviewed(row.id),
          });
          if (c.isWeak) {
            weakList.push({
              id: row.id,
              titulo: c.titulo || row.titulo || "Alojamiento",
              href: listingEditHref(row.id),
            });
          }
        }
        setWeak(weakList);
      } catch {
        if (!cancelled) setWeak([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [perfilId]);

  return weak;
}
