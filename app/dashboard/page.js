"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const VERTICALS = {
  alojamiento: { label: "Alojamiento", priceSuffix: "/ noche" },
  ninos: { label: "Cuidado de niños", priceSuffix: "/ hora" },
  mascotas: { label: "Cuidado de mascotas", priceSuffix: "/ día" },
};

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
  confirmada: { bg: BRAND.light, color: BRAND.primary, label: "Confirmada" },
  completada: { bg: "#dcfce7", color: "#166534", label: "Completada" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
};

function Section({ title, children }) {
  return (
    <section
      className="rounded-2xl border bg-white p-6 sm:p-8"
      style={{ borderColor: BRAND.border }}
    >
      <h2
        className="text-xl font-semibold text-[#1a1a1a]"
        style={{ fontFamily: SERIF }}
      >
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }) {
  const key = status?.toLowerCase?.() ?? "pendiente";
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function formatPrice(precio, vertical) {
  const config = VERTICALS[vertical] ?? VERTICALS.alojamiento;
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${config.priceSuffix}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData ?? null);

      if (profileData?.role === "proveedor") {
        const { data: servicesData } = await supabase
          .from("services")
          .select("*")
          .eq("proveedor_id", user.id);

        const providerServices = servicesData ?? [];
        setServices(providerServices);

        const serviceIds = providerServices.map((s) => s.id);
        if (serviceIds.length > 0) {
          const { data: bookingsData } = await supabase
            .from("bookings")
            .select("*")
            .in("service_id", serviceIds)
            .order("created_at", { ascending: false });

          setBookings(bookingsData ?? []);
        } else {
          setBookings([]);
        }
      } else {
        const { data: bookingsData } = await supabase
          .from("bookings")
          .select("*")
          .eq("cliente_id", user.id)
          .order("created_at", { ascending: false });

        const clientBookings = bookingsData ?? [];
        setBookings(clientBookings);

        if (clientBookings.length > 0) {
          const bookingIds = clientBookings.map((b) => b.id);
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("booking_id")
            .in("booking_id", bookingIds);

          setReviewedBookingIds(
            new Set((reviewsData ?? []).map((r) => r.booking_id)),
          );
        } else {
          setReviewedBookingIds(new Set());
        }
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  const isProvider = profile?.role === "proveedor";
  const greetingName = profile?.nombre?.trim();

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando tu panel…
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

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <header>
          <h1
            className="text-3xl font-bold text-[#1a1a1a] sm:text-4xl"
            style={{ fontFamily: SERIF }}
          >
            {greetingName ? `Hola, ${greetingName}` : "Hola"}
          </h1>
          <p className="mt-2 text-lg text-[#5c5c5c]">
            {isProvider ? "Tu panel de proveedor" : "Tu panel de cliente"}
          </p>
        </header>

        {isProvider ? (
          <>
            <Section title="Mis servicios">
              {services.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-[#666]">
                    Aún no has publicado ningún servicio.
                  </p>
                  <Link
                    href="/ser-proveedor"
                    className="mt-4 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Publicar mi primer servicio
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {services.map((service) => {
                      const vertical =
                        VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
                      return (
                        <li
                          key={service.id}
                          className="flex flex-col gap-2 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          style={{ borderColor: BRAND.border }}
                        >
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-[#888]">
                              {vertical.label}
                            </p>
                            <p className="font-semibold text-[#1a1a1a]">
                              {service.titulo || vertical.label}
                            </p>
                          </div>
                          <p
                            className="text-lg font-bold"
                            style={{ color: BRAND.primary }}
                          >
                            {formatPrice(service.precio, service.vertical)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href="/ser-proveedor"
                    className="mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Añadir servicio
                  </Link>
                </>
              )}
            </Section>

            <Section title="Reservas recibidas">
              {bookings.length === 0 ? (
                <p className="text-sm text-[#666]">
                  Aún no has recibido reservas.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-col gap-2 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div>
                        <p className="font-medium text-[#1a1a1a]">
                          Reserva #{booking.id?.slice?.(0, 8) ?? "—"}
                        </p>
                        {booking.fecha_inicio && (
                          <p className="mt-0.5 text-xs text-[#888]">
                            {booking.fecha_inicio}
                            {booking.fecha_fin ? ` — ${booking.fecha_fin}` : ""}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={booking.estado ?? booking.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Mi perfil">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {[profile?.nombre, profile?.apellido]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Ciudad
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.ciudad || profile?.location_zone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Descripción
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-[#5c5c5c]">
                    {profile?.descripcion || "—"}
                  </dd>
                </div>
              </dl>
              <Link
                href="/completar-perfil"
                className="mt-5 inline-block rounded-xl border px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                Editar perfil
              </Link>
            </Section>
          </>
        ) : (
          <>
            <Section title="Mis reservas">
              {bookings.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-[#666]">
                    Aún no tienes reservas. Empieza a explorar proveedores.
                  </p>
                  <Link
                    href="/buscar"
                    className="mt-4 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Buscar proveedores
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {bookings.map((booking) => {
                    const estado = booking.estado ?? booking.status;
                    const canReview =
                      estado === "completada" &&
                      !reviewedBookingIds.has(booking.id);

                    return (
                      <li
                        key={booking.id}
                        className="flex flex-col gap-2 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        style={{ borderColor: BRAND.border }}
                      >
                        <div>
                          <p className="font-medium text-[#1a1a1a]">
                            Reserva #{booking.id?.slice?.(0, 8) ?? "—"}
                          </p>
                          {booking.fecha_inicio && (
                            <p className="mt-0.5 text-xs text-[#888]">
                              {booking.fecha_inicio}
                              {booking.fecha_fin ? ` — ${booking.fecha_fin}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={estado} />
                          {canReview && (
                            <Link
                              href={`/resena/${booking.id}`}
                              className="rounded-xl border px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                              style={{
                                borderColor: BRAND.primary,
                                color: BRAND.primary,
                              }}
                            >
                              Valorar
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Mis favoritos">
              <p className="text-sm text-[#666]">
                Próximamente podrás guardar tus proveedores favoritos.
              </p>
            </Section>

            <Section title="Mi perfil">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.nombre || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Apellido
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.apellido || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Ciudad
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.ciudad || profile?.location_zone || "—"}
                  </dd>
                </div>
              </dl>
              <Link
                href="/completar-perfil"
                className="mt-5 inline-block rounded-xl border px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                Editar perfil
              </Link>
            </Section>
          </>
        )}
      </main>
    </div>
  );
}
