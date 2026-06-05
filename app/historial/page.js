"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
  confirmada: { bg: BRAND.light, color: BRAND.primary, label: "Confirmada" },
  en_curso: { bg: "#e0e7ff", color: "#3730a3", label: "En curso" },
  completada: { bg: "#dcfce7", color: "#166534", label: "Completada" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencia" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
};

const FILTER_TABS = [
  { id: "todas", label: "Todas" },
  { id: "pendiente", label: "Pendientes" },
  { id: "confirmada", label: "Confirmadas" },
  { id: "completada", label: "Completadas" },
  { id: "cancelada", label: "Canceladas" },
];

function getBookingEstado(booking) {
  return booking.estado ?? booking.status;
}

function StatusBadge({ status }) {
  const key = status ?? "pendiente";
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function formatPrice(precio) {
  if (precio == null || precio === "") return "—";
  return `${Number(precio).toFixed(2)}€`;
}

export default function HistorialPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [activeFilter, setActiveFilter] = useState("todas");

  useEffect(() => {
    async function loadHistorial() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          `
          *,
          services:service_id (
            titulo,
            vertical,
            precio,
            profiles:proveedor_id (nombre, apellido)
          )
        `,
        )
        .eq("cliente_id", user.id)
        .order("created_at", { ascending: false });

      setBookings(bookingsData ?? []);
      setLoading(false);
    }

    loadHistorial();
  }, [router]);

  const filteredBookings = useMemo(() => {
    if (activeFilter === "todas") return bookings;
    return bookings.filter(
      (booking) => getBookingEstado(booking) === activeFilter,
    );
  }, [bookings, activeFilter]);

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando historial…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <header
        className="px-4 py-6 text-white sm:px-6"
        style={{ backgroundColor: BRAND.primary }}
      >
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard"
            className="text-sm text-white/80 no-underline transition-opacity hover:opacity-100"
          >
            ← Volver al dashboard
          </Link>
          <h1
            className="mt-2 text-xl font-semibold sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Historial de reservas
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: isActive ? BRAND.primary : BRAND.border,
                  backgroundColor: isActive ? BRAND.light : "#fff",
                  color: isActive ? BRAND.primary : "#444",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {filteredBookings.length === 0 ? (
          <p
            className="mt-6 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
            style={{ borderColor: BRAND.border }}
          >
            No hay reservas en esta categoría.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-4">
            {filteredBookings.map((booking) => {
              const estado = getBookingEstado(booking);
              const service = booking.services ?? {};
              const proveedor = service.profiles ?? {};
              const proveedorNombre =
                [proveedor.nombre, proveedor.apellido]
                  .filter(Boolean)
                  .join(" ") || "Proveedor";

              return (
                <li
                  key={booking.id}
                  className="rounded-2xl border bg-white p-5 sm:p-6"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#1a1a1a]">
                        {service.titulo || "Servicio Home&Heart"}
                      </p>
                      <p className="mt-1 text-sm text-[#666]">
                        {proveedorNombre}
                      </p>
                      {booking.fecha_inicio && (
                        <p className="mt-1 text-xs text-[#888]">
                          {booking.fecha_inicio}
                          {booking.fecha_fin ? ` — ${booking.fecha_fin}` : ""}
                        </p>
                      )}
                      <p
                        className="mt-2 text-lg font-bold"
                        style={{ color: BRAND.primary }}
                      >
                        {formatPrice(booking.precio_total)}
                      </p>
                    </div>
                    <StatusBadge status={estado} />
                  </div>

                  {estado === "completada" && (
                    <a
                      href={`/api/facturas/${booking.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-sm text-[#1d4f91] underline"
                    >
                      Descargar factura 📄
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
