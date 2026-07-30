import Link from "next/link";
import { notFound } from "next/navigation";
import CalendarioDisponibilidad from "@/app/components/CalendarioDisponibilidad";
import FavoritoButton from "@/app/components/FavoritoButton";
import ReportarPerfilButton from "@/app/components/ReportarPerfilButton";
import ServiceAnuncioContentTranslated from "@/app/components/ServiceAnuncioContentTranslated";
import ProveedorPreguntarButton from "@/app/components/ProveedorPreguntarButton";
import { SERIF } from "@/app/components/brand";
import {
  ProveedorBioText,
  ProveedorTranslateButton,
  ProveedorTranslateProvider,
  ServicioTituloText,
} from "./ProveedorTraduccion";
import {
  getPrecioConDescuento,
  isOfertaActiva,
} from "@/app/lib/ofertas";
import { normalizeCancelPolicy } from "@/app/lib/cancelacion-politica";
import { getReferenteInitial } from "@/app/lib/referencias";
import {
  computeProveedorRating,
  formatProveedorRatingAvg,
} from "@/app/lib/reviews";
import { getServiceDescription } from "@/app/lib/service-card-display";
import { supabase } from "@/app/lib/supabase";
import { VERIFICADO_BADGE_TOOLTIP_ES } from "@/app/lib/verification-copy";

const VERTICAL_THEME = {
  alojamiento: {
    label: "Alojamiento",
    color: "#1d4f91",
    light: "#e8f0fb",
    priceSuffix: "/ noche",
  },
  ninos: {
    label: "Cuidado de niños",
    color: "#0e7a5c",
    light: "#e6f4f0",
    priceSuffix: "/ hora",
  },
  mascotas: {
    label: "Cuidado de mascotas",
    color: "#c47d1a",
    light: "#fdf3e3",
    priceSuffix: "/ día",
  },
};

const CANCEL_POLICIES = {
  flexible: { name: "Flexible" },
  moderada: { name: "Moderada" },
  estricta: { name: "Estricta" },
};

const DIAS_SEMANA_PILLS = [
  { id: "lun", label: "Lun" },
  { id: "mar", label: "Mar" },
  { id: "mie", label: "Mié" },
  { id: "jue", label: "Jue" },
  { id: "vie", label: "Vie" },
  { id: "sab", label: "Sáb" },
  { id: "dom", label: "Dom" },
];

const GOLD = "#c8922a";

const PROFILES_PUBLIC_SELECT =
  "id, nombre, apellido, foto_perfil, foto_url, ciudad, location_zone, descripcion, idiomas, verificado, badge_respuesta, tiempo_respuesta_horas, role, anos_experiencia, fecha_registro";

function getCancelPolicy(policyKey) {
  const key = normalizeCancelPolicy(policyKey);
  return CANCEL_POLICIES[key];
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
    return `Mín. ${count} ${count === 1 ? "noche" : "noches"}`;
  }
  if (service.vertical === "ninos") {
    return `Mín. ${count} ${count === 1 ? "hora" : "horas"}`;
  }
  return `Mín. ${count} ${count === 1 ? "día" : "días"}`;
}

function normalizeDiasDisponiblesProveedor(dias) {
  if (!Array.isArray(dias) || dias.length === 0) {
    return DIAS_SEMANA_PILLS.map((d) => d.id);
  }
  return dias;
}

function hasPetFriendly(service) {
  const desc = getServiceDescription(service).toLowerCase();
  return /pet[-_\s]?friendly/i.test(desc);
}

function getPrimaryVertical(services) {
  if (!services?.length) return VERTICAL_THEME.alojamiento;
  const vertical = services[0].vertical;
  return VERTICAL_THEME[vertical] ?? VERTICAL_THEME.alojamiento;
}

function StarRating({ value, size = 12 }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill={star <= value ? GOLD : "none"}
          stroke={star <= value ? GOLD : "#ddd"}
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

function Tag({ children, light, color, title }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: light, color }}
      title={title}
    >
      {children}
    </span>
  );
}

function StatItem({ value, label }) {
  return (
    <div>
      <p className="text-[20px] leading-none" style={{ color: "#1d4f91", fontWeight: 200 }}>
        {value}
      </p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-wide" style={{ color: "#bbb" }}>
        {label}
      </p>
    </div>
  );
}

function getServiceTags(service) {
  const tags = [];
  const cancelPolicy = getCancelPolicy(service.cancellation_policy);
  const estanciaMinLabel = formatEstanciaMinima(service);

  if (service.vertical === "alojamiento") {
    tags.push({ text: "NRU ✓", light: "#e8f0fb", color: "#163a6b" });
  }

  if (
    service.vertical === "alojamiento" &&
    (service.disponible_para_viajar || hasPetFriendly(service))
  ) {
    tags.push({ text: "Pet-friendly 🐾", light: "#e6f4f0", color: "#085041" });
  }

  if (service.reserva_inmediata) {
    tags.push({ text: "Reserva inmediata ⚡", light: "#fdf3e3", color: "#92400e" });
  }

  if (cancelPolicy) {
    tags.push({ text: cancelPolicy.name, light: "#f7f5f2", color: "#888" });
  }

  if (estanciaMinLabel) {
    tags.push({ text: estanciaMinLabel, light: "#f7f5f2", color: "#888" });
  }

  return tags;
}

export async function generateMetadata({ params }) {
  const { id } = await params;

  const { data: perfil } = await supabase
    .from("profiles_public")
    .select("nombre, apellido, descripcion, ciudad, verificado")
    .eq("id", id)
    .single();

  if (!perfil || perfil.verificado !== true) {
    return {
      title: "Perfil no disponible",
      description: "Este perfil no está disponible en Home&Heart.",
    };
  }

  const { data: servicios } = await supabase
    .from("services")
    .select("vertical, precio")
    .eq("proveedor_id", id)
    .eq("disponible", true);

  const verticales = servicios
    ?.map((s) =>
      s.vertical === "alojamiento"
        ? "Alojamiento"
        : s.vertical === "ninos"
          ? "Niñera"
          : "Mascotas",
    )
    .join(", ");

  const title = perfil
    ? `${perfil.nombre} ${perfil.apellido} · ${verticales || "Servicios"} en ${perfil.ciudad || "España"}`
    : "Proveedor verificado";

  const description =
    perfil?.descripcion?.slice(0, 150) ||
    `Proveedor verificado en ${perfil?.ciudad || "España"}`;

  return {
    title,
    description,
    openGraph: {
      title: `${perfil?.nombre || "Proveedor"} · ${verticales || "Servicios"} verificado`,
      description: perfil?.descripcion?.slice(0, 150) || description,
    },
  };
}

export default async function ProveedorPage({ params }) {
  const { id } = await params;

  const { data: profile, error: profileError } = await supabase
    .from("profiles_public")
    .select(PROFILES_PUBLIC_SELECT)
    .eq("id", id)
    .single();

  if (profileError || !profile || profile.verificado !== true) {
    notFound();
  }

  // Perfil público: sin dirección exacta, teléfono ni coordenadas precisas.
  const { data: servicesRaw } = await supabase
    .from("services")
    .select(
      `
      id,
      titulo,
      vertical,
      precio,
      disponible,
      cancellation_policy,
      reserva_inmediata,
      descripcion,
      descripcion_anuncio,
      foto_url,
      fotos,
      tipo_alojamiento,
      modalidad,
      location_zone,
      ciudad,
      proveedor_id,
      oferta_descuento,
      oferta_valida_hasta,
      oferta_titulo,
      oferta_descripcion,
      disponible_para_viajar,
      capacidad,
      capacidad_maxima,
      huespedes_incluidos,
      precio_huesped_extra,
      amenities,
      jardin,
      paseos_incluidos,
      fotos_actualizaciones,
      mascotas_detalle,
      ninos_detalle,
      normas,
      check_in,
      check_out,
      estancia_minima,
      estancia_maxima,
      antelacion_minima,
      dias_disponibles,
      proveedor_emergencia,
      anos_experiencia,
      revision_estado
    `,
    )
    .eq("proveedor_id", id)
    .eq("disponible", true);

  const services = servicesRaw ?? [];
  const serviceIds = services.map((s) => s.id);

  let bloqueosCalendario = [];
  if (serviceIds.length > 0) {
    const { data: bloqueos } = await supabase
      .from("disponibilidad")
      .select("fecha_inicio, fecha_fin, service_id")
      .in("service_id", serviceIds);

    bloqueosCalendario = bloqueos ?? [];
  }

  const servicesParaCalendario = (services ?? []).map((service) => {
    const vertical = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
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
    .select("valoracion, cliente_id")
    .eq("proveedor_id", id);

  const { data: referenciasCompletadas } = await supabase
    .from("referencias_public")
    .select(
      "nombre_referente, relacion, conoce_desde, recomendaria, comentario",
    )
    .eq("proveedor_id", id)
    .order("nombre_referente", { ascending: true });

  let reservasCount = 0;
  if (serviceIds.length > 0) {
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .in("service_id", serviceIds);
    reservasCount = count ?? 0;
  }

  const avalesCount = referenciasCompletadas?.length ?? 0;
  const ratingAgg = computeProveedorRating(allRatings);
  const reviewCount = ratingAgg.count;
  const averageRating = formatProveedorRatingAvg(ratingAgg);

  let reviewsWithNames = [];
  if (reviews?.length) {
    const clienteIds = reviews.map((r) => r.cliente_id);
    const { data: clientes } = await supabase
      .from("profiles_public")
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
  const bio = profile.descripcion || "";
  const languages = Array.isArray(profile.idiomas) ? profile.idiomas : [];
  const avatarUrl = profile.foto_perfil || profile.foto_url || null;
  const initials = getInitials(profile.nombre, profile.apellido);
  const isVerified = profile.verificado === true;
  const primaryTheme = getPrimaryVertical(services);
  const hasAlojamiento = (services ?? []).some((s) => s.vertical === "alojamiento");
  const respondeHoras = (services ?? []).length
    ? Math.min(...(services ?? []).map((s) => Number(s.antelacion_minima) || 24))
    : 24;
  const firstServiceId = services?.[0]?.id;

  const servicesParaTraduccion = (services ?? []).map((service) => {
    const vertical = VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
    return {
      id: service.id,
      titulo: service.titulo || vertical.label,
      descripcion: getServiceDescription(service),
      oferta_descripcion: service.oferta_descripcion || "",
      oferta_titulo: service.oferta_titulo || "",
    };
  });

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: "#f7f5f2", color: "#1a1a1a" }}>
      {/* Navbar */}
      <header
        className="border-b"
        style={{ backgroundColor: "#f7f5f2", borderColor: "#e8e4de" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="shrink-0 no-underline">
            <p className="text-[18px] leading-none text-[#111]" style={{ fontFamily: SERIF }}>
              Home<span className="italic" style={{ color: "#1d4f91" }}>&</span>
              Heart
            </p>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/buscar"
              className="text-[12px] no-underline transition-opacity hover:opacity-80"
              style={{ color: "#888" }}
            >
              ← Buscar
            </Link>
            <Link
              href="/dashboard"
              className="px-3.5 py-1.5 text-[12px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1d4f91", borderRadius: 4 }}
            >
              Mi cuenta
            </Link>
          </div>
        </div>
      </header>

      <ProveedorTranslateProvider bio={bio} services={servicesParaTraduccion}>
        {/* Header proveedor */}
        <header
          className="relative border-b bg-white"
          style={{ borderColor: "#e8e4de", padding: 28 }}
        >
          <FavoritoButton proveedorId={id} className="absolute right-7 top-7 z-10" />

          <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[72px_1fr_auto] lg:items-start">
            {/* Avatar */}
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName}
                className="mx-auto h-[72px] w-[72px] shrink-0 rounded-full object-cover lg:mx-0"
              />
            ) : (
              <span
                className="mx-auto flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white lg:mx-0"
                style={{ backgroundColor: primaryTheme.color }}
              >
                {initials}
              </span>
            )}

            {/* Info */}
            <div className="min-w-0 text-center lg:text-left">
              <h1
                className="text-[#111]"
                style={{ fontFamily: SERIF, fontWeight: 300, fontSize: 22 }}
              >
                {fullName || "Proveedor"}
              </h1>
              <p className="mt-1 text-[12px] text-[#888]">{zone}</p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {isVerified && (
                  <Tag
                    light="#e8f0fb"
                    color="#163a6b"
                    title={VERIFICADO_BADGE_TOOLTIP_ES}
                  >
                    Verificado ✓
                  </Tag>
                )}
                {avalesCount > 0 && (
                  <Tag light="#e6f4f0" color="#085041">
                    {avalesCount} aval{avalesCount !== 1 ? "es" : ""}
                  </Tag>
                )}
                {profile.badge_respuesta === "rapido" && (
                  <Tag light="#e6f4f0" color="#085041">
                    ⚡ Responde rápido
                  </Tag>
                )}
                {profile.badge_respuesta === "pocas_horas" && (
                  <Tag light="#fdf3e3" color="#92400e">
                    🕐 Responde en pocas horas
                  </Tag>
                )}
                {hasAlojamiento && (
                  <Tag light="#e8f0fb" color="#163a6b">
                    NRU ✓
                  </Tag>
                )}
              </div>

              <ProveedorTranslateButton />

              {languages.length > 0 && (
                <div className="mt-3 flex flex-wrap justify-center gap-1.5 lg:justify-start">
                  {languages.map((lang) => (
                    <span
                      key={lang}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                      style={{ backgroundColor: "#f7f5f2", color: "#666" }}
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              )}

              <div className="proveedor-header-bio">
                <ProveedorBioText bio={bio} />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex flex-col items-center gap-2 lg:items-end">
              {firstServiceId && (
                <Link
                  href={`/reservar/${firstServiceId}`}
                  className="w-full min-w-[140px] rounded px-5 py-2.5 text-center text-[12px] font-semibold text-white no-underline transition-opacity hover:opacity-90 lg:w-auto"
                  style={{ backgroundColor: "#1d4f91", borderRadius: 4 }}
                >
                  Reservar
                </Link>
              )}
              <ProveedorPreguntarButton
                proveedorId={id}
                className="w-full min-w-[140px] rounded border px-5 py-2.5 text-[12px] font-semibold transition-colors hover:bg-[#e8f0fb] disabled:opacity-60 lg:w-auto"
                style={{ borderColor: "#1d4f91", color: "#1d4f91", borderRadius: 4 }}
              >
                Preguntar 💬
              </ProveedorPreguntarButton>
              <div className="proveedor-reportar-wrap">
                <ReportarPerfilButton
                  proveedorId={id}
                  proveedorNombre={fullName || "Proveedor"}
                />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div
            className="mx-auto mt-5 flex max-w-6xl flex-wrap gap-6 border-t pt-4"
            style={{ borderColor: "#f0ede8" }}
          >
            <StatItem
              value={averageRating ?? "—"}
              label="Valoración media"
            />
            <StatItem value={reservasCount} label="Nº reservas" />
            <StatItem value={avalesCount} label="Nº avales externos" />
            <StatItem value={`${respondeHoras}h`} label="Responde en" />
          </div>
        </header>

        {/* Body 2 columnas */}
        <div className="mx-auto grid max-w-6xl lg:grid-cols-2">
          {/* Columna izquierda */}
          <div
            className="border-b lg:border-b-0 lg:border-r"
            style={{ borderColor: "#e8e4de", padding: "20px 24px" }}
          >
            {/* Servicios */}
            <section>
              <h2
                className="text-[13px] font-semibold uppercase tracking-wide text-[#888]"
                style={{ fontFamily: SERIF }}
              >
                Servicios disponibles
              </h2>

              {(!services || services.length === 0) && (
                <p className="mt-3 text-[12px] text-[#888]">
                  Este proveedor no tiene servicios activos en este momento.
                </p>
              )}

              <ul className="mt-4 flex flex-col gap-3">
                {(services ?? []).map((service) => {
                  const vertical =
                    VERTICAL_THEME[service.vertical] ?? VERTICAL_THEME.alojamiento;
                  const ofertaActiva = isOfertaActiva(service);
                  const precioConDescuento = ofertaActiva
                    ? getPrecioConDescuento(service.precio, service.oferta_descuento)
                    : null;
                  const displayPrice = ofertaActiva
                    ? formatPrice(precioConDescuento, vertical.priceSuffix)
                    : formatPrice(service.precio, vertical.priceSuffix);
                  const tags = getServiceTags(service);

                  return (
                    <li
                      key={service.id}
                      className="rounded-lg border bg-white p-4"
                      style={{ borderColor: "#e8e4de" }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: vertical.color }}
                            aria-hidden
                          />
                          <div className="proveedor-servicio-titulo min-w-0 truncate">
                            <ServicioTituloText
                              serviceId={service.id}
                              titulo={service.titulo || vertical.label}
                            />
                          </div>
                        </div>
                        <p
                          className="shrink-0 text-[15px] font-semibold"
                          style={{ color: "#1d4f91" }}
                        >
                          {displayPrice}
                        </p>
                      </div>

                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {tags.map((tag) => (
                            <Tag key={tag.text} light={tag.light} color={tag.color}>
                              {tag.text}
                            </Tag>
                          ))}
                        </div>
                      )}

                      <ServiceAnuncioContentTranslated service={service} />
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Reseñas */}
            <section className="mt-8">
              <h2
                className="text-[13px] font-semibold uppercase tracking-wide text-[#888]"
                style={{ fontFamily: SERIF }}
              >
                Reseñas
              </h2>

              {reviewCount === 0 ? (
                <p className="mt-3 text-[12px] text-[#888]">Aún no tiene valoraciones</p>
              ) : (
                <>
                  <div
                    className="mt-4 rounded-lg border bg-white p-4"
                    style={{ borderColor: "#e8e4de" }}
                  >
                    <div className="flex items-center gap-3">
                      <p
                        className="text-[32px] leading-none"
                        style={{ color: "#1d4f91", fontWeight: 200 }}
                      >
                        {averageRating}
                      </p>
                      <div>
                        <StarRating
                          value={Math.round(Number(averageRating))}
                          size={14}
                        />
                        <p className="mt-1 text-[10px] text-[#aaa]">
                          {reviewCount} reseña{reviewCount > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  <ul className="mt-3 flex flex-col gap-3">
                    {reviewsWithNames.map((review) => (
                      <li
                        key={review.id}
                        className="rounded-lg border bg-white p-4"
                        style={{ borderColor: "#e8e4de" }}
                      >
                        <StarRating value={review.valoracion} size={10} />
                        {review.comentario && (
                          <p className="mt-2 text-[11px] italic leading-relaxed text-[#666]">
                            {review.comentario}
                          </p>
                        )}
                        <p className="mt-2 text-[9px] text-[#aaa]">
                          — {review.cliente_nombre}
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* Avales */}
            {avalesCount > 0 && (
              <section className="mt-8">
                <h2
                  className="text-[13px] font-semibold uppercase tracking-wide text-[#888]"
                  style={{ fontFamily: SERIF }}
                >
                  Avales externos
                </h2>
                <ul className="mt-4 flex flex-col gap-3">
                  {referenciasCompletadas.map((ref, index) => (
                    <li
                      key={`${ref.nombre_referente}-${index}`}
                      className="rounded-lg border bg-white p-4"
                      style={{ borderColor: "#e8e4de" }}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                          style={{ backgroundColor: "#e8f0fb", color: "#1d4f91" }}
                        >
                          {getReferenteInitial(ref.nombre_referente)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-[#1a1a1a]">
                            {ref.nombre_referente}
                          </p>
                          <p className="text-[10px] text-[#888]">{ref.relacion}</p>
                          {ref.comentario && (
                            <p className="mt-2 text-[11px] italic leading-relaxed text-[#666]">
                              {ref.comentario}
                            </p>
                          )}
                          {ref.recomendaria === true && (
                            <p className="mt-2 text-[10px] font-semibold text-[#0e7a5c]">
                              ✓ Recomendaría
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Columna derecha — Disponibilidad */}
          <div style={{ padding: "20px 24px" }}>
            <div className="proveedor-calendario-panel">
              <CalendarioDisponibilidad
                services={servicesParaCalendario}
                bloqueos={bloqueosCalendario}
              />
            </div>
          </div>
        </div>
      </ProveedorTranslateProvider>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .proveedor-calendario-panel > section {
              margin: 0 !important;
              border: none !important;
              padding: 0 !important;
              background: transparent !important;
              border-radius: 0 !important;
            }
            .proveedor-calendario-panel h2 {
              font-size: 13px !important;
              font-weight: 600 !important;
              text-transform: uppercase !important;
              letter-spacing: 0.05em !important;
              color: #888 !important;
              font-family: Georgia, serif !important;
            }
            .proveedor-calendario-panel > section > p {
              display: none;
            }
            .proveedor-calendario-panel .lg\\:block {
              display: none !important;
            }
            .proveedor-calendario-panel .lg\\:flex-row > div:last-child {
              display: none !important;
            }
            .proveedor-calendario-panel button[aria-label="Mes anterior"],
            .proveedor-calendario-panel button[aria-label="Mes siguiente"] {
              border-radius: 4px !important;
              border-color: #e8e4de !important;
              height: 32px !important;
              width: 32px !important;
            }
            .proveedor-calendario-panel .grid.grid-cols-7.gap-1.text-center {
              color: #bbb !important;
              font-size: 9px !important;
            }
            .proveedor-calendario-panel a[href*="/reservar/"] {
              border-radius: 4px !important;
              font-size: 12px !important;
            }
            .proveedor-header-bio p {
              margin-top: 12px !important;
              padding-top: 0 !important;
              border-top: none !important;
              font-size: 12px !important;
              line-height: 1.7 !important;
              color: #888 !important;
            }
            .proveedor-servicio-titulo p {
              margin: 0 !important;
              font-size: 13px !important;
              font-weight: 600 !important;
            }
            .proveedor-servicio-desc p {
              margin-top: 4px !important;
              font-size: 11px !important;
              color: #aaa !important;
              line-height: 1.4 !important;
            }
            .proveedor-reportar-wrap p {
              margin-top: 4px !important;
              text-align: right !important;
              font-size: 10px !important;
              color: #bbb !important;
            }
            .proveedor-reportar-wrap button {
              color: #bbb !important;
              font-size: 10px !important;
            }
          `,
        }}
      />
    </div>
  );
}
