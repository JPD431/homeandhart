"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { getUserFamiliaActiva } from "@/app/lib/familia";
import { formatDateRange, getBookingEstado } from "@/app/lib/viajes";
import { supabase } from "@/app/lib/supabase";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

const STATUS_LABELS = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

export default function NuevoViajePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [familiaId, setFamiliaId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [bookings, setBookings] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);

      const familiaActiva = await getUserFamiliaActiva(supabase, user.id);
      if (familiaActiva) {
        setFamiliaId(familiaActiva.familia.id);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("ciudad")
        .eq("id", user.id)
        .single();

      if (profile?.ciudad) setCiudad(profile.ciudad);

      const { data: bookingsData } = await supabase
        .from("bookings")
        .select(
          `
          id,
          fecha_inicio,
          fecha_fin,
          precio_total,
          estado,
          services:service_id (titulo, vertical)
        `,
        )
        .eq("cliente_id", user.id)
        .order("fecha_inicio", { ascending: false });

      const activas = (bookingsData ?? []).filter((b) => {
        const estado = b.estado ?? b.status;
        return estado !== "cancelada" && estado !== "cancelada_garantia";
      });

      setBookings(activas);
      setLoading(false);
    }

    load();
  }, [router]);

  function toggleBooking(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!nombre.trim()) {
      setError("Indica un nombre para el viaje.");
      return;
    }
    if (!fechaInicio || !fechaFin) {
      setError("Indica las fechas del viaje.");
      return;
    }

    setCreating(true);
    setError("");

    const { data: viaje, error: viajeError } = await supabase
      .from("viajes")
      .insert({
        nombre: nombre.trim(),
        familia_id: familiaId,
        creador_id: userId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        ciudad: ciudad.trim() || null,
      })
      .select("id")
      .single();

    if (viajeError) {
      setCreating(false);
      setError(viajeError.message);
      return;
    }

    if (selectedIds.length > 0) {
      const { error: linkError } = await supabase.from("viaje_reservas").insert(
        selectedIds.map((bookingId) => ({
          viaje_id: viaje.id,
          booking_id: bookingId,
        })),
      );

      if (linkError) {
        setCreating(false);
        setError(linkError.message);
        return;
      }
    }

    router.push(`/viaje/${viaje.id}`);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando…
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
        <div className="mx-auto max-w-2xl">
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
            Nuevo viaje
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border bg-white p-6 sm:p-8"
          style={{ borderColor: BRAND.border }}
        >
          {error && (
            <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div>
            <label
              htmlFor="viaje-nombre"
              className="mb-1.5 block text-xs font-medium text-[#444]"
            >
              Nombre del viaje
            </label>
            <input
              id="viaje-nombre"
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Verano en Madrid"
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="viaje-inicio"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Fecha inicio
              </label>
              <input
                id="viaje-inicio"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
            <div>
              <label
                htmlFor="viaje-fin"
                className="mb-1.5 block text-xs font-medium text-[#444]"
              >
                Fecha fin
              </label>
              <input
                id="viaje-fin"
                type="date"
                value={fechaFin}
                min={fechaInicio || undefined}
                onChange={(e) => setFechaFin(e.target.value)}
                className={inputClass}
                style={{ borderColor: BRAND.border }}
              />
            </div>
          </div>

          <div className="mt-4">
            <label
              htmlFor="viaje-ciudad"
              className="mb-1.5 block text-xs font-medium text-[#444]"
            >
              Ciudad
            </label>
            <input
              id="viaje-ciudad"
              type="text"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              placeholder="Madrid, Barcelona…"
              className={inputClass}
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-[#1a1a1a]">
              Añadir reservas existentes
            </p>
            <p className="mt-1 text-xs text-[#888]">
              Selecciona las reservas que forman parte de este viaje.
            </p>

            {bookings.length === 0 ? (
              <p className="mt-3 text-sm text-[#666]">
                No tienes reservas activas para añadir.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {bookings.map((booking) => {
                  const service = booking.services ?? {};
                  const estado = getBookingEstado(booking);
                  const selected = selectedIds.includes(booking.id);

                  return (
                    <li key={booking.id}>
                      <label
                        className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors"
                        style={{
                          borderColor: selected ? BRAND.primary : BRAND.border,
                          backgroundColor: selected ? BRAND.light : "#fff",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleBooking(booking.id)}
                          className="mt-1"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-[#1a1a1a]">
                            {service.titulo || "Servicio"}
                          </p>
                          <p className="mt-0.5 text-xs text-[#888]">
                            {formatDateRange(
                              booking.fecha_inicio,
                              booking.fecha_fin,
                            )}{" "}
                            · {STATUS_LABELS[estado] ?? estado}
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="submit"
            disabled={creating}
            className="mt-6 w-full rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
            style={{ backgroundColor: BRAND.primary }}
          >
            {creating ? "Creando…" : "Crear viaje"}
          </button>
        </form>
      </main>
    </div>
  );
}
