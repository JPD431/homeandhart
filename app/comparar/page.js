"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { SERIF } from "@/app/components/brand";
import { supabase } from "@/app/lib/supabase";

const VERTICAL_THEME = {
  alojamiento: {
    color: "#1d4f91",
    light: "#e8f0fb",
    priceSuffix: "/ noche",
    gradient: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
  },
  ninos: {
    color: "#0e7a5c",
    light: "#e6f4f0",
    priceSuffix: "/ hora",
    gradient: "linear-gradient(160deg, #a8d5c2, #3d9b86)",
  },
  mascotas: {
    color: "#c47d1a",
    light: "#fdf3e3",
    priceSuffix: "/ día",
    gradient: "linear-gradient(160deg, #e8c99a, #b8843a)",
  },
};

const CANCEL_STYLES = {
  flexible: { label: "Flexible", color: "#0e7a5c", light: "#e6f4f0" },
  moderada: { label: "Moderada", color: "#1d4f91", light: "#e8f0fb" },
  estricta: { label: "Estricta", color: "#c47d1a", light: "#fdf3e3" },
};

const LEGACY_CANCEL = {
  "24h": "flexible",
  "48h": "moderada",
  "7d": "estricta",
};

const ROW_LABELS = [
  "Precio",
  "Valoración",
  "Verificado",
  "Tiempo respuesta",
  "Tipo de reserva",
  "Avales externos",
  "Disponible para viajar",
  "Idiomas",
  "Cancelación",
  "Red de emergencia",
];

function getCancelStyle(policyKey) {
  const key = LEGACY_CANCEL[policyKey] ?? policyKey ?? "moderada";
  return CANCEL_STYLES[key] || CANCEL_STYLES.moderada;
}

function formatShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

function getZone(service, profile) {
  return (
    service.location_zone ||
    profile?.location_zone ||
    service.ciudad ||
    profile?.ciudad ||
    "Zona"
  );
}

function formatPrice(precio, suffix) {
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${suffix}`;
}

function CompararContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids") || "";
  const ids = useMemo(
    () => [...new Set(idsParam.split(",").map((id) => id.trim()).filter(Boolean))].slice(0, 3),
    [idsParam],
  );

  const [services, setServices] = useState([]);
  const [ratingsByProveedor, setRatingsByProveedor] = useState({});
  const [avalesByProveedor, setAvalesByProveedor] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ids.length === 0) {
      setServices([]);
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError("");

      const { data, error: fetchError } = await supabase
        .from("services")
        .select(
          `
          id,
          titulo,
          vertical,
          precio,
          foto_url,
          reserva_inmediata,
          cancellation_policy,
          disponible_para_viajar,
          proveedor_emergencia,
          proveedor_id,
          location_zone,
          ciudad,
          profiles!inner (
            nombre,
            apellido,
            verificado,
            badge_respuesta,
            tiempo_respuesta_horas,
            idiomas,
            ciudad,
            location_zone
          )
        `,
        )
        .in("id", ids);

      if (fetchError) {
        setError(fetchError.message);
        setServices([]);
        setLoading(false);
        return;
      }

      const ordered = ids
        .map((id) => (data ?? []).find((s) => s.id === id))
        .filter(Boolean);

      const proveedorIds = [...new Set(ordered.map((s) => s.proveedor_id).filter(Boolean))];

      const ratingsMap = {};
      if (proveedorIds.length > 0) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("proveedor_id, valoracion")
          .in("proveedor_id", proveedorIds);

        for (const rev of reviews ?? []) {
          if (!ratingsMap[rev.proveedor_id]) {
            ratingsMap[rev.proveedor_id] = { sum: 0, count: 0 };
          }
          ratingsMap[rev.proveedor_id].sum += Number(rev.valoracion) || 0;
          ratingsMap[rev.proveedor_id].count += 1;
        }
        for (const pid of Object.keys(ratingsMap)) {
          const { sum, count } = ratingsMap[pid];
          ratingsMap[pid].avg = count > 0 ? sum / count : 0;
        }
      }

      const avalesMap = {};
      if (proveedorIds.length > 0) {
        const { data: referencias } = await supabase
          .from("referencias")
          .select("proveedor_id")
          .in("proveedor_id", proveedorIds)
          .eq("estado", "completada");

        for (const ref of referencias ?? []) {
          avalesMap[ref.proveedor_id] = (avalesMap[ref.proveedor_id] ?? 0) + 1;
        }
      }

      setRatingsByProveedor(ratingsMap);
      setAvalesByProveedor(avalesMap);
      setServices(ordered);
      setLoading(false);
    }

    load();
  }, [ids]);

  const bestPriceId = useMemo(() => {
    const withPrice = services.filter((s) => s.precio != null && s.precio !== "");
    if (!withPrice.length) return null;
    return withPrice.reduce((best, s) =>
      Number(s.precio) < Number(best.precio) ? s : best,
    ).id;
  }, [services]);

  const bestRatingId = useMemo(() => {
    let best = null;
    let bestAvg = -1;
    for (const service of services) {
      const rating = ratingsByProveedor[service.proveedor_id];
      const avg = rating?.avg ?? 0;
      if (rating?.count > 0 && avg > bestAvg) {
        bestAvg = avg;
        best = service.id;
      }
    }
    return best;
  }, [services, ratingsByProveedor]);

  const bestAvalesId = useMemo(() => {
    let best = null;
    let bestCount = -1;
    for (const service of services) {
      const count = avalesByProveedor[service.proveedor_id] ?? 0;
      if (count > bestCount) {
        bestCount = count;
        best = service.id;
      }
    }
    return bestCount > 0 ? best : null;
  }, [services, avalesByProveedor]);

  const gridCols = `180px repeat(${Math.max(services.length, 1)}, minmax(0, 1fr))`;

  function renderCell(service, rowIndex) {
    const profile = service.profiles ?? {};
    const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
    const rating = ratingsByProveedor[service.proveedor_id];
    const avg =
      rating?.count > 0 ? (rating.sum / rating.count).toFixed(1) : null;
    const reviewCount = rating?.count || 0;
    const avales = avalesByProveedor[service.proveedor_id] ?? 0;
    const cancel = getCancelStyle(service.cancellation_policy);
    const idiomas = Array.isArray(profile.idiomas) ? profile.idiomas : [];

    switch (rowIndex) {
      case 0:
        return (
          <div>
            <p style={{ fontSize: 22, fontWeight: 600, color: "#1d4f91", margin: 0 }}>
              {formatPrice(service.precio, theme.priceSuffix)}
            </p>
            {service.id === bestPriceId && (
              <span
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  background: "#fdf3e3",
                  color: "#c47d1a",
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 12,
                }}
              >
                Mejor precio
              </span>
            )}
          </div>
        );
      case 1:
        return avg ? (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: service.id === bestRatingId ? "#0e7a5c" : "#444",
              fontWeight: service.id === bestRatingId ? 600 : 400,
            }}
          >
            {avg} ★ ({reviewCount} reseñas)
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: "#bbb" }}>Sin valoraciones</p>
        );
      case 2:
        return profile.verificado === true ? (
          <span style={{ color: "#0e7a5c", fontSize: 14, fontWeight: 600 }}>✓ Verificado</span>
        ) : (
          <span style={{ color: "#bbb", fontSize: 14 }}>✗ No verificado</span>
        );
      case 3:
        if (profile.badge_respuesta === "rapido") {
          return (
            <span
              style={{
                display: "inline-block",
                background: "#e6f4f0",
                color: "#085041",
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 12,
              }}
            >
              ⚡ Responde rápido
            </span>
          );
        }
        if (profile.badge_respuesta === "pocas_horas") {
          return (
            <span
              style={{
                display: "inline-block",
                background: "#fdf3e3",
                color: "#92400e",
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 12,
              }}
            >
              🕐 Responde en pocas horas
            </span>
          );
        }
        return <span style={{ color: "#bbb", fontSize: 14 }}>—</span>;
      case 4:
        return service.reserva_inmediata === true ? (
          <span style={{ color: "#0e7a5c", fontSize: 13, fontWeight: 600 }}>Inmediata ⚡</span>
        ) : (
          <span style={{ color: "#c47d1a", fontSize: 13, fontWeight: 600 }}>
            Con confirmación
          </span>
        );
      case 5:
        return (
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: service.id === bestAvalesId ? "#0e7a5c" : "#444",
              fontWeight: service.id === bestAvalesId ? 600 : 400,
            }}
          >
            {avales}
          </p>
        );
      case 6:
        return service.disponible_para_viajar === true ? (
          <span style={{ color: "#0e7a5c", fontSize: 14 }}>✓ Sí</span>
        ) : (
          <span style={{ color: "#bbb", fontSize: 14 }}>✗ No</span>
        );
      case 7:
        return idiomas.length > 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "#444", lineHeight: 1.6 }}>
            {idiomas.join(", ")}
          </p>
        ) : (
          <span style={{ color: "#bbb", fontSize: 14 }}>—</span>
        );
      case 8:
        return (
          <span
            style={{
              display: "inline-block",
              background: cancel.light,
              color: cancel.color,
              fontSize: 11,
              fontWeight: 600,
              padding: "4px 10px",
              borderRadius: 12,
            }}
          >
            {cancel.label}
          </span>
        );
      case 9:
        return service.proveedor_emergencia === true ? (
          <span style={{ color: "#0e7a5c", fontSize: 14 }}>✓ Sí</span>
        ) : (
          <span style={{ color: "#bbb", fontSize: 14 }}>✗ No</span>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: "#f7f5f2" }}>
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <h1
          className="text-[#1a1a1a]"
          style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 400, margin: 0 }}
        >
          {loading
            ? "Comparando proveedores…"
            : `Comparando ${services.length} proveedor${services.length !== 1 ? "es" : ""}`}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#888]">
          Compara precio, valoración, disponibilidad y garantías antes de reservar.
        </p>

        {loading && (
          <p className="mt-10 text-center text-[13px] text-[#888]">Cargando comparación…</p>
        )}

        {!loading && error && (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}

        {!loading && !error && services.length < 2 && (
          <div className="mt-10 text-center">
            <p className="text-[14px] text-[#888]">
              Selecciona al menos 2 servicios en la búsqueda para comparar.
            </p>
            <Link
              href="/buscar"
              className="mt-4 inline-block rounded-md px-5 py-2.5 text-[13px] font-semibold text-white no-underline"
              style={{ background: "#1d4f91" }}
            >
              Ir a buscar
            </Link>
          </div>
        )}

        {!loading && !error && services.length >= 2 && (
          <div
            className="mt-8 overflow-x-auto rounded-xl border bg-white"
            style={{ borderColor: "#e8e4de" }}
          >
            <div style={{ display: "grid", gridTemplateColumns: gridCols, minWidth: 640 }}>
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #e8e4de",
                  background: "#fff",
                }}
              />
              {services.map((service) => {
                const profile = service.profiles ?? {};
                const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
                const rating = ratingsByProveedor[service.proveedor_id];
                const avg =
                  rating?.count > 0 ? (rating.sum / rating.count).toFixed(1) : null;
                const reviewCount = rating?.count || 0;

                return (
                  <div
                    key={service.id}
                    style={{
                      padding: "16px 20px",
                      borderBottom: "1px solid #e8e4de",
                      borderLeft: "1px solid #e8e4de",
                    }}
                  >
                    <div
                      style={{
                        height: 60,
                        borderRadius: 8,
                        overflow: "hidden",
                        marginBottom: 10,
                        background: theme.gradient,
                      }}
                    >
                      {service.foto_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={service.foto_url}
                          alt=""
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : null}
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 14,
                        fontWeight: 600,
                        color: "#1a1a1a",
                        fontFamily: SERIF,
                      }}
                    >
                      {formatShortName(profile.nombre, profile.apellido) || "Proveedor"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#888" }}>
                      {getZone(service, profile)}
                    </p>
                    {avg ? (
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#c47d1a" }}>
                        ★ {avg} ({reviewCount})
                      </p>
                    ) : (
                      <p style={{ margin: "6px 0 0", fontSize: 11, color: "#bbb" }}>
                        Sin valoraciones
                      </p>
                    )}
                    <Link
                      href={`/reservar/${service.id}`}
                      className="mt-3 inline-block w-full rounded-md py-2 text-center text-[12px] font-semibold text-white no-underline"
                      style={{ background: theme.color }}
                    >
                      Reservar →
                    </Link>
                  </div>
                );
              })}

              {ROW_LABELS.map((label, rowIndex) => (
                <div key={label} style={{ display: "contents" }}>
                  <div
                    style={{
                      padding: "14px 20px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#666",
                      background: rowIndex % 2 === 0 ? "#fafaf9" : "#fff",
                      borderBottom: "1px solid #e8e4de",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {label}
                  </div>
                  {services.map((service) => (
                    <div
                      key={`${service.id}-${label}`}
                      style={{
                        padding: "14px 20px",
                        background: rowIndex % 2 === 0 ? "#fafaf9" : "#fff",
                        borderBottom: "1px solid #e8e4de",
                        borderLeft: "1px solid #e8e4de",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {renderCell(service, rowIndex)}
                    </div>
                  ))}
                </div>
              ))}

              <div
                style={{
                  padding: "16px 20px",
                  background: "#fff",
                }}
              />
              {services.map((service) => {
                const theme = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
                return (
                  <div
                    key={`cta-${service.id}`}
                    style={{
                      padding: "16px 20px",
                      borderLeft: "1px solid #e8e4de",
                    }}
                  >
                    <Link
                      href={`/reservar/${service.id}`}
                      className="block w-full rounded-md py-2.5 text-center text-[13px] font-semibold text-white no-underline"
                      style={{ background: theme.color }}
                    >
                      Reservar →
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!loading && services.length >= 2 && (
          <button
            type="button"
            onClick={() => router.push("/buscar")}
            className="mt-6 border bg-white px-4 py-2 text-[12px] font-medium transition-colors hover:bg-[#f7f5f2]"
            style={{ borderColor: "#e8e4de", borderRadius: 6, color: "#666" }}
          >
            ← Volver a buscar
          </button>
        )}
      </main>
    </div>
  );
}

export default function CompararPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24, color: "#888" }}>Cargando…</div>}>
      <CompararContent />
    </Suspense>
  );
}
