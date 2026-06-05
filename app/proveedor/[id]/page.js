import Link from "next/link";
import { notFound } from "next/navigation";
import CalendarioDisponibilidad from "@/app/components/CalendarioDisponibilidad";
import Navbar from "@/app/components/Navbar";
import PreguntarButton from "@/app/components/PreguntarButton";
import ReportarPerfilButton from "@/app/components/ReportarPerfilButton";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  ProveedorBioText,
  ProveedorTranslateButton,
  ProveedorTranslateProvider,
  ServicioDescripcionText,
  ServicioOfertaTituloText,
  ServicioTituloText,
} from "./ProveedorTraduccion";
import {
  formatOfertaValidaHasta,
  getPrecioConDescuento,
  isOfertaActiva,
} from "@/app/lib/ofertas";
import { formatDescuentosDuracionList } from "@/app/lib/descuentosDuracion";
import { supabase } from "@/lib/supabase";

const DARK_BLUE = "#163a6b";

const CANCEL_POLICIES = {
  flexible: {
    name: "Flexible",
    description:
      "Cancelación gratuita hasta 24h antes · 50% de reembolso dentro de las 24h previas",
  },
  moderada: {
    name: "Moderada",
    description:
      "Cancelación gratuita hasta 3 días antes · 50% entre 3 días y 24h antes",
  },
  estricta: {
    name: "Estricta",
    description:
      "Cancelación gratuita hasta 7 días antes · 50% entre 7 y 3 días antes",
  },
};

const LEGACY_CANCEL_POLICIES = {
  "24h": "flexible",
  "48h": "moderada",
  "7d": "estricta",
};

function getCancelPolicy(policyKey) {
  const key = LEGACY_CANCEL_POLICIES[policyKey] ?? policyKey;
  return CANCEL_POLICIES[key];
}

const VERTICALS = {
  alojamiento: {
    label: "Alojamiento",
    priceSuffix: "/ noche",
    Icon: HomeIcon,
  },
  ninos: {
    label: "Cuidado de niños",
    priceSuffix: "/ hora",
    Icon: PersonIcon,
  },
  mascotas: {
    label: "Cuidado de mascotas",
    priceSuffix: "/ día",
    Icon: PetIcon,
  },
};

function HomeIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function PersonIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function PetIcon({ className }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="7" cy="4" r="1.5" />
      <circle cx="12" cy="3" r="1.5" />
      <circle cx="17" cy="4" r="1.5" />
      <circle cx="4.5" cy="8.5" r="1.5" />
      <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
    </svg>
  );
}

function CheckBadgeIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

function getInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function formatPrice(precio, suffix) {
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${suffix}`;
}

function formatEstanciaMinima(service) {
  const n = service.estancia_minima;
  if (n == null || n === "" || Number(n) <= 0) return null;
  const count = Number(n);
  if (service.vertical === "alojamiento") {
    return `Mínimo ${count} ${count === 1 ? "noche" : "noches"}`;
  }
  if (service.vertical === "ninos") {
    return `Mínimo ${count} ${count === 1 ? "hora" : "horas"}`;
  }
  return `Mínimo ${count} ${count === 1 ? "día" : "días"}`;
}

function formatAntelacionLabel(hours) {
  const h = Number(hours);
  if (h >= 24 && h % 24 === 0) {
    const days = h / 24;
    return days === 1 ? "1 día" : `${days} días`;
  }
  return h === 1 ? "1 hora" : `${h} horas`;
}

function formatAntelacionReserva(service) {
  const h =
    service.antelacion_minima != null && service.antelacion_minima !== ""
      ? Number(service.antelacion_minima)
      : null;
  if (h == null || h <= 0) return null;
  return `Reservar con ${formatAntelacionLabel(h)} de antelación`;
}

const DIAS_SEMANA_PILLS = [
  { id: "lun", label: "Lun" },
  { id: "mar", label: "Mar" },
  { id: "mie", label: "Mié" },
  { id: "jue", label: "Jue" },
  { id: "vie", label: "Vie" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

function normalizeDiasDisponiblesProveedor(dias) {
  if (!Array.isArray(dias) || dias.length === 0) {
    return DIAS_SEMANA_PILLS.map((d) => d.id);
  }
  return dias;
}

const GOLD = "#c8922a";

function StarRating({ value, size = 16 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= value ? GOLD : "none"}
          stroke={star <= value ? GOLD : "#ccc"}
          strokeWidth={1.5}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
          />
        </svg>
      ))}
    </div>
  );
}

function formatReviewDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ProveedorPage({ params }) {
  const { id } = await params;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (profileError || !profile) {
    notFound();
  }

  const { data: services } = await supabase
    .from("services")
    .select("*")
    .eq("proveedor_id", id)
    .eq("disponible", true);

  const serviceIds = (services ?? []).map((s) => s.id);
  const hoy = new Date();
  const en7d = new Date(hoy);
  en7d.setDate(en7d.getDate() + 7);
  const hoyStr = hoy.toISOString().split("T")[0];
  const en7dStr = en7d.toISOString().split("T")[0];

  const ocupadosProximos7Dias = new Set();
  let bloqueosCalendario = [];
  if (serviceIds.length > 0) {
    const { data: bloqueos } = await supabase
      .from("disponibilidad")
      .select("fecha_inicio, fecha_fin, service_id")
      .in("service_id", serviceIds);

    bloqueosCalendario = bloqueos ?? [];
    bloqueosCalendario.forEach((b) => {
      if (b.fecha_inicio <= en7dStr && b.fecha_fin >= hoyStr) {
        ocupadosProximos7Dias.add(b.service_id);
      }
    });
  }

  const servicesParaCalendario = (services ?? []).map((service) => {
    const vertical = VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
    return {
      id: service.id,
      titulo: service.titulo || vertical.label,
      label: vertical.label,
      dias_disponibles: normalizeDiasDisponiblesProveedor(service.dias_disponibles),
    };
  });

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, valoracion, comentario, created_at, cliente_id")
    .eq("proveedor_id", id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: allRatings } = await supabase
    .from("reviews")
    .select("valoracion")
    .eq("proveedor_id", id);

  const reviewCount = allRatings?.length ?? 0;
  const averageRating =
    reviewCount > 0
      ? (
          allRatings.reduce((sum, r) => sum + Number(r.valoracion), 0) /
          reviewCount
        ).toFixed(1)
      : null;

  let reviewsWithNames = [];
  if (reviews?.length) {
    const clienteIds = reviews.map((r) => r.cliente_id);
    const { data: clientes } = await supabase
      .from("profiles")
      .select("id, nombre")
      .in("id", clienteIds);

    const namesMap = Object.fromEntries(
      (clientes ?? []).map((c) => [c.id, c.nombre]),
    );

    reviewsWithNames = reviews.map((review) => ({
      ...review,
      cliente_nombre: namesMap[review.cliente_id] || "Cliente",
    }));
  }

  const fullName = [profile.nombre, profile.apellido].filter(Boolean).join(" ");
  const zone = profile.location_zone || profile.ciudad || "España";
  const bio = profile.descripcion || profile.sobre_ti || "";
  const languages = Array.isArray(profile.idiomas) ? profile.idiomas : [];
  const avatarUrl = profile.foto_perfil || profile.avatar_url || null;
  const initials = getInitials(profile.nombre, profile.apellido);
  const isVerified = profile.verificado === true;

  const servicesParaTraduccion = (services ?? []).map((service) => {
    const vertical = VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
    return {
      id: service.id,
      titulo: service.titulo || vertical.label,
      descripcion: service.descripcion || "",
      oferta_descripcion: service.oferta_descripcion || "",
      oferta_titulo: service.oferta_titulo || "",
    };
  });

  return (
    <div
      className="min-h-screen pb-24 font-sans md:pb-12"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <ProveedorTranslateProvider
          bio={bio}
          services={servicesParaTraduccion}
        >
        {/* Header del proveedor */}
        <header
          className="rounded-2xl border bg-white p-6 sm:p-8"
          style={{ borderColor: BRAND.border }}
        >
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-24 w-24 shrink-0 rounded-full object-cover ring-4 ring-[#e8f0fb]"
              />
            ) : (
              <span
                className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-2xl font-semibold"
                style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
              >
                {initials}
              </span>
            )}

            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <h1
                  className="text-2xl font-bold text-[#1a1a1a] sm:text-3xl"
                  style={{ fontFamily: SERIF }}
                >
                  {fullName || "Proveedor"}
                </h1>
                {isVerified && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: BRAND.light,
                      color: BRAND.primary,
                    }}
                  >
                    <CheckBadgeIcon className="h-3.5 w-3.5" />
                    Verificado
                  </span>
                )}
              </div>
              <ProveedorTranslateButton />
              <p className="mt-1 text-sm text-[#666]">{zone}</p>

              {languages.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded-full border px-3 py-1 text-xs font-medium"
                      style={{
                        borderColor: BRAND.border,
                        backgroundColor: BRAND.warm,
                        color: DARK_BLUE,
                      }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <ProveedorBioText bio={bio} />
        </header>

        {/* Servicios disponibles */}
        <section className="mt-8">
          <h2
            className="text-xl font-bold text-[#1a1a1a] sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Servicios disponibles
          </h2>

          {(!services || services.length === 0) && (
            <p
              className="mt-4 rounded-2xl border bg-white px-5 py-6 text-sm text-[#666]"
              style={{ borderColor: BRAND.border }}
            >
              Este proveedor no tiene servicios activos en este momento.
            </p>
          )}

          <ul className="mt-5 flex flex-col gap-4">
            {(services ?? []).map((service) => {
              const vertical =
                VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
              const { Icon } = vertical;
              const cancelPolicy = getCancelPolicy(service.cancellation_policy);
              const estanciaMinLabel = formatEstanciaMinima(service);
              const antelacionLabel = formatAntelacionReserva(service);
              const diasDisponibles = normalizeDiasDisponiblesProveedor(
                service.dias_disponibles,
              );
              const ocupadoProximos7Dias = ocupadosProximos7Dias.has(service.id);
              const ofertaActiva = isOfertaActiva(service);
              const precioConDescuento = ofertaActiva
                ? getPrecioConDescuento(service.precio, service.oferta_descuento)
                : null;
              const descuentosDuracionLabel =
                formatDescuentosDuracionList(service);

              return (
                <li
                  key={service.id}
                  className="rounded-2xl border bg-white p-5 sm:p-6"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{
                        backgroundColor: BRAND.light,
                        color: BRAND.primary,
                      }}
                    >
                      <Icon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold uppercase tracking-wide text-[#888]">
                          {vertical.label}
                        </p>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: ocupadoProximos7Dias ? "#f3f4f6" : "#dcfce7",
                            color: ocupadoProximos7Dias ? "#6b7280" : "#166534",
                          }}
                        >
                          {ocupadoProximos7Dias ? "Ocupado" : "Disponible"}
                        </span>
                      </div>
                      <ServicioTituloText
                        serviceId={service.id}
                        titulo={service.titulo || vertical.label}
                      />
                      <ServicioDescripcionText
                        serviceId={service.id}
                        descripcion={service.descripcion || ""}
                      />
                      {service.oferta_descripcion && (
                        <ServicioDescripcionText
                          serviceId={service.id}
                          descripcion={service.oferta_descripcion}
                          field="oferta_descripcion"
                        />
                      )}
                      {ofertaActiva && (
                        <ServicioOfertaTituloText
                          serviceId={service.id}
                          ofertaTitulo={service.oferta_titulo || "Oferta especial"}
                          descuento={service.oferta_descuento}
                          validaHastaLabel={formatOfertaValidaHasta(
                            service.oferta_valida_hasta,
                          )}
                        />
                      )}
                      {descuentosDuracionLabel && (
                        <p className="mt-2 text-xs font-medium text-green-700">
                          {descuentosDuracionLabel}
                        </p>
                      )}
                      {ofertaActiva ? (
                        <div className="mt-2 flex flex-wrap items-baseline gap-2">
                          <p className="text-lg text-[#888] line-through">
                            {formatPrice(service.precio, vertical.priceSuffix)}
                          </p>
                          <p className="text-2xl font-bold text-green-700">
                            {formatPrice(precioConDescuento, vertical.priceSuffix)}
                          </p>
                        </div>
                      ) : (
                        <p
                          className="mt-2 text-2xl font-bold"
                          style={{ color: BRAND.primary }}
                        >
                          {formatPrice(service.precio, vertical.priceSuffix)}
                        </p>
                      )}
                      {estanciaMinLabel && (
                        <p className="mt-1 text-xs text-[#888]">{estanciaMinLabel}</p>
                      )}
                      {antelacionLabel && (
                        <p className="mt-1 text-xs text-[#888]">{antelacionLabel}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {DIAS_SEMANA_PILLS.map((dia) => {
                          const activo = diasDisponibles.includes(dia.id);
                          return (
                            <span
                              key={dia.id}
                              className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: activo ? BRAND.light : "#f3f3f3",
                                color: activo ? BRAND.primary : "#aaa",
                                border: `1px solid ${activo ? BRAND.primary : "#e0e0e0"}`,
                              }}
                            >
                              {dia.label}
                            </span>
                          );
                        })}
                      </div>
                      {cancelPolicy ? (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-[#444]">
                            {cancelPolicy.name}
                          </p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#888]">
                            {cancelPolicy.description}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-[#888]">
                          {service.cancellation_policy}
                        </p>
                      )}
                      {service.reserva_inmediata ? (
                        <span className="mt-2 inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-800">
                          Reserva inmediata ⚡
                        </span>
                      ) : (
                        <span className="mt-2 inline-flex rounded-full bg-yellow-100 px-2.5 py-0.5 text-[11px] font-semibold text-yellow-800">
                          Requiere confirmación 🕐
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/reservar/${service.id}`}
                      className="flex-1 rounded-xl py-3 text-center text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      Reservar
                    </Link>
                    <PreguntarButton
                      proveedorId={id}
                      className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors hover:bg-[#e8f0fb] disabled:opacity-60"
                      style={{
                        borderColor: BRAND.primary,
                        color: BRAND.primary,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <CalendarioDisponibilidad
          services={servicesParaCalendario}
          bloqueos={bloqueosCalendario}
        />

        <section
          className="mt-8 rounded-2xl border bg-white p-6 sm:p-8"
          style={{ borderColor: BRAND.border }}
        >
          <h2
            className="text-xl font-bold text-[#1a1a1a] sm:text-2xl"
            style={{ fontFamily: SERIF }}
          >
            Lo que dicen los clientes
          </h2>

          {reviewCount === 0 ? (
            <p className="mt-4 text-sm text-[#666]">Aún no tiene valoraciones</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <p className="text-4xl font-bold" style={{ color: GOLD }}>
                  {averageRating}
                </p>
                <div>
                  <StarRating value={Math.round(Number(averageRating))} size={18} />
                  <p className="mt-1 text-sm text-[#666]">
                    {reviewCount} reseña{reviewCount > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <ul className="mt-6 flex flex-col gap-4 border-t pt-6" style={{ borderColor: BRAND.border }}>
                {reviewsWithNames.map((review) => (
                  <li key={review.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1a1a1a]">
                        {review.cliente_nombre}
                      </p>
                      <p className="text-xs text-[#888]">
                        {formatReviewDate(review.created_at)}
                      </p>
                    </div>
                    <div className="mt-1">
                      <StarRating value={review.valoracion} />
                    </div>
                    {review.comentario && (
                      <p className="mt-2 text-sm leading-relaxed text-[#444]">
                        {review.comentario}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <ReportarPerfilButton
          proveedorId={id}
          proveedorNombre={fullName || "Proveedor"}
        />
        </ProveedorTranslateProvider>
      </main>

      {/* Botón flotante móvil */}
      <div
        className="fixed inset-x-0 bottom-0 border-t bg-white p-4 md:hidden"
        style={{ borderColor: BRAND.border }}
      >
        <PreguntarButton
          proveedorId={id}
          className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: DARK_BLUE }}
        >
          Contactar al proveedor
        </PreguntarButton>
      </div>
    </div>
  );
}
