import Link from "next/link";
import { notFound } from "next/navigation";
import { getServiceCoverPhoto } from "@/app/lib/service-card-display";
import { supabase } from "@/app/lib/supabase";
import { SERIF } from "@/app/components/brand";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";
const WARM = "#f7f5f2";

const CIUDADES = ["madrid", "barcelona", "valencia", "sevilla", "bilbao"];
const VERTICALES = ["nineras", "alojamiento", "mascotas"];

const VERTICAL_DB = {
  nineras: "ninos",
  alojamiento: "alojamiento",
  mascotas: "mascotas",
};

const VERTICAL_BUSCAR = {
  nineras: "ninos",
  alojamiento: "alojamiento",
  mascotas: "mascotas",
};

const VERTICAL_THEME = {
  ninos: {
    color: "#0e7a5c",
    light: "#e6f4f0",
    gradient: "linear-gradient(160deg, #a8d5c2, #3d9b86)",
    priceSuffix: "/ hora",
  },
  alojamiento: {
    color: "#1d4f91",
    light: "#e8f0fb",
    gradient: "linear-gradient(160deg, #c5d9ee, #4a85c0)",
    priceSuffix: "/ noche",
  },
  mascotas: {
    color: "#c47d1a",
    light: "#fdf3e3",
    gradient: "linear-gradient(160deg, #e8c99a, #b8843a)",
    priceSuffix: "/ día",
  },
};

const TITULOS = {
  nineras: (ciudad) =>
    `Niñeras en ${ciudad} · Certificadas y verificadas · Home&Heart`,
  alojamiento: (ciudad) =>
    `Alojamiento pet-friendly en ${ciudad} · NRU verificado · Home&Heart`,
  mascotas: (ciudad) =>
    `Cuidadores de mascotas en ${ciudad} · Verificados · Home&Heart`,
};

const DESCRIPCIONES = {
  nineras: (ciudad) =>
    `Encuentra niñeras certificadas en ${ciudad} con antecedentes verificados. Disponibles por horas o días. Reserva online con pago protegido.`,
  alojamiento: (ciudad) =>
    `Apartamentos y casas pet-friendly en ${ciudad} con NRU registrado. Check-in flexible, reserva inmediata y pago protegido.`,
  mascotas: (ciudad) =>
    `Cuidadores de mascotas verificados en ${ciudad}. Paseos incluidos, fotos y actualizaciones. Reserva online con garantía Home&Heart.`,
};

const H1S = {
  nineras: (ciudad) => `Niñeras en ${ciudad}`,
  alojamiento: (ciudad) => `Alojamiento pet-friendly en ${ciudad}`,
  mascotas: (ciudad) => `Cuidadores de mascotas en ${ciudad}`,
};

const SUBTITULOS = {
  nineras:
    "Certificadas, con antecedentes verificados y disponibles cuando las necesitas",
  alojamiento: "Con NRU registrado, pet-friendly y reserva inmediata",
  mascotas: "Verificados, con jardín y paseos incluidos",
};

const PROVEEDOR_CTA = {
  nineras: "¿Eres niñera? Únete",
  alojamiento: "¿Eres anfitrión? Únete",
  mascotas: "¿Eres cuidador de mascotas? Únete",
};

const BUSCAR_LABEL = {
  nineras: "niñeras",
  alojamiento: "alojamiento",
  mascotas: "cuidadores de mascotas",
};

function getFaqs(ciudad) {
  return {
    nineras: [
      {
        q: `¿Cómo se verifican las niñeras en ${ciudad}?`,
        a: "Todas las niñeras pasan por verificación de antecedentes penales, antecedentes de delitos sexuales y comprobación de documentos de identidad.",
      },
      {
        q: `¿Cuánto cuesta una niñera en ${ciudad}?`,
        a: "Las niñeras en Home&Heart cobran entre 15€ y 25€ por hora dependiendo de su experiencia y formación.",
      },
      {
        q: "¿Puedo contratar una niñera para un viaje?",
        a: 'Sí. Muchas niñeras tienen activada la opción "Disponible para viajar" y pueden acompañarte en tus viajes.',
      },
      {
        q: "¿Hay garantía si la niñera cancela?",
        a: "Sí. Si tu niñera cancela con menos de 24h, la Garantía Home&Heart te busca una alternativa verificada en 30 minutos.",
      },
    ],
    alojamiento: [
      {
        q: `¿Qué es el NRU en alojamientos de ${ciudad}?`,
        a: "El Número de Registro Único es obligatorio para alquileres turísticos en España. Todos los alojamientos en Home&Heart tienen NRU verificado.",
      },
      {
        q: "¿Todos los alojamientos son pet-friendly?",
        a: 'No todos, pero puedes filtrar por "Pet-friendly" en el buscador para ver solo los que aceptan mascotas.',
      },
      {
        q: "¿Qué pasa si el anfitrión cancela?",
        a: "La Garantía Home&Heart te busca alojamiento alternativo verificado en 30 minutos si la cancelación es con menos de 24h.",
      },
    ],
    mascotas: [
      {
        q: `¿Cómo se verifican los cuidadores de mascotas en ${ciudad}?`,
        a: "Todos los cuidadores tienen antecedentes penales verificados y documento de identidad comprobado.",
      },
      {
        q: "¿Puedo ver fotos de mi mascota mientras está al cuidado?",
        a: 'Sí. Los cuidadores con el badge "Envía fotos" mandan actualizaciones periódicas a los dueños.',
      },
      {
        q: `¿Hay cuidadores con jardín en ${ciudad}?`,
        a: 'Sí. Puedes filtrar por "Con jardín" en el buscador para ver cuidadores que tienen espacio exterior.',
      },
    ],
  };
}

function formatShortName(nombre, apellido) {
  const n = nombre?.trim();
  const a = apellido?.trim();
  if (n && a) return `${n} ${a.charAt(0)}.`;
  return n || a || "";
}

function capitalizeCiudad(slug) {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function isValidRoute(ciudad, vertical) {
  return CIUDADES.includes(ciudad) && VERTICALES.includes(vertical);
}

export async function generateStaticParams() {
  return CIUDADES.flatMap((ciudad) =>
    VERTICALES.map((vertical) => ({ ciudad, vertical })),
  );
}

export async function generateMetadata({ params }) {
  const { ciudad, vertical } = await params;
  if (!isValidRoute(ciudad, vertical)) return { title: "Home&Heart" };

  const ciudadCapital = capitalizeCiudad(ciudad);
  const title = TITULOS[vertical](ciudadCapital);
  const description = DESCRIPCIONES[vertical](ciudadCapital);

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

function ProviderCard({ service, theme, rating }) {
  const profile = service.profiles_public ?? {};
  const nombre = formatShortName(profile.nombre, profile.apellido) || "Proveedor";
  const zone = service.location_zone || service.ciudad || profile.ciudad || "";
  const foto =
    getServiceCoverPhoto(service) ||
    profile.foto_perfil ||
    profile.avatar_url;
  const valoracionMedia =
    rating?.count > 0 ? (rating.sum / rating.count).toFixed(1) : null;

  return (
    <li>
      <Link
        href={`/reservar/${service.id}`}
        className="block overflow-hidden rounded-xl border bg-white no-underline transition-shadow hover:shadow-md"
        style={{ borderColor: BORDER }}
      >
        <div className="relative h-[140px] w-full overflow-hidden">
          {foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full" style={{ background: theme.gradient }} />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,.5) 100%)",
            }}
            aria-hidden
          />
          {service.precio != null && (
            <span
              className="absolute right-2.5 top-2.5 px-2.5 py-1 text-[10px] font-semibold"
              style={{
                backgroundColor: "rgba(255,255,255,.92)",
                borderRadius: 14,
                color: "#2a3a4a",
              }}
            >
              {Number(service.precio)}€{theme.priceSuffix}
            </span>
          )}
        </div>
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="min-w-0 truncate text-[12px] font-semibold text-[#1a1a1a]">
              {nombre}
              {zone && <span className="font-normal text-[#888]"> · {zone}</span>}
            </p>
            {valoracionMedia ? (
              <span className="shrink-0 text-[10px] text-[#c47d1a]">
                ★ {valoracionMedia}
              </span>
            ) : null}
          </div>
          {service.titulo && (
            <p className="mt-0.5 truncate text-[10px] text-[#aaa]">{service.titulo}</p>
          )}
          {profile.verificado && (
            <span className="mt-1.5 inline-block text-[9px] font-semibold text-[#0e7a5c]">
              ✓ Verificado
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}

function FaqAccordion({ items }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <details
          key={item.q}
          className="group rounded-xl border bg-white"
          style={{ borderColor: BORDER }}
        >
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#1a1a1a] marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-3">
              {item.q}
              <span
                className="shrink-0 text-[#888] transition-transform group-open:rotate-180"
                aria-hidden
              >
                ▾
              </span>
            </span>
          </summary>
          <p className="border-t px-4 py-3 text-sm leading-relaxed text-[#666]" style={{ borderColor: BORDER }}>
            {item.a}
          </p>
        </details>
      ))}
    </div>
  );
}

async function fetchLandingData(ciudadCapital, verticalDB) {
  const { data: servicios } = await supabase
    .from("services")
    .select(
      `
      id,
      titulo,
      vertical,
      precio,
      foto_url,
      fotos,
      ciudad,
      location_zone,
      proveedor_id,
      profiles_public!inner (
        nombre,
        apellido,
        verificado,
        foto_perfil,
        ciudad
      )
    `,
    )
    .eq("vertical", verticalDB)
    .eq("disponible", true)
    .eq("profiles_public.verificado", true)
    .or(`ciudad.ilike.%${ciudadCapital}%,location_zone.ilike.%${ciudadCapital}%`)
    .limit(6);

  const lista = servicios ?? [];
  const proveedorIds = [
    ...new Set(lista.map((s) => s.proveedor_id).filter(Boolean)),
  ];

  const ratingsByProveedor = {};
  let avgRating = null;
  if (proveedorIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("proveedor_id, valoracion")
      .in("proveedor_id", proveedorIds);

    if (reviews?.length) {
      const sum = reviews.reduce((acc, r) => acc + (Number(r.valoracion) || 0), 0);
      avgRating = (sum / reviews.length).toFixed(1);
    }

    for (const rev of reviews ?? []) {
      if (!ratingsByProveedor[rev.proveedor_id]) {
        ratingsByProveedor[rev.proveedor_id] = { sum: 0, count: 0 };
      }
      ratingsByProveedor[rev.proveedor_id].sum += Number(rev.valoracion) || 0;
      ratingsByProveedor[rev.proveedor_id].count += 1;
    }
  }

  const { count: totalProveedores } = await supabase
    .from("services")
    .select("id, profiles_public!inner(verificado)", { count: "exact", head: true })
    .eq("vertical", verticalDB)
    .eq("disponible", true)
    .eq("profiles_public.verificado", true)
    .or(`ciudad.ilike.%${ciudadCapital}%,location_zone.ilike.%${ciudadCapital}%`);

  return {
    servicios: lista,
    totalProveedores: totalProveedores ?? lista.length,
    avgRating,
    ratingsByProveedor,
  };
}

export default async function LandingPage({ params }) {
  const { ciudad, vertical } = await params;
  if (!isValidRoute(ciudad, vertical)) notFound();

  const ciudadCapital = capitalizeCiudad(ciudad);
  const verticalDB = VERTICAL_DB[vertical];
  const theme = VERTICAL_THEME[verticalDB];
  const faqs = getFaqs(ciudadCapital)[vertical];
  const buscarHref = `/buscar?vertical=${VERTICAL_BUSCAR[vertical]}&ciudad=${encodeURIComponent(ciudadCapital)}`;

  const { servicios, totalProveedores, avgRating, ratingsByProveedor } =
    await fetchLandingData(ciudadCapital, verticalDB);

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Home&Heart",
    description: SUBTITULOS[vertical],
    url: `https://homeandheart.es/${ciudad}/${vertical}`,
    areaServed: ciudadCapital,
    priceRange:
      vertical === "nineras"
        ? "15€-25€/hora"
        : vertical === "alojamiento"
          ? "50€-150€/noche"
          : "20€-40€/día",
  };

  const beneficios = [
    {
      icon: "✓",
      title: "Verificados",
      text: "Antecedentes penales, identidad y documentos comprobados antes de publicar.",
      color: "#0e7a5c",
      light: "#e6f4f0",
    },
    {
      icon: "🔒",
      title: "Pago protegido",
      text: "Un solo pago en la plataforma. No pagas hasta que la reserva queda confirmada.",
      color: PRIMARY,
      light: "#e8f0fb",
    },
    {
      icon: "⚡",
      title: "Garantía 30 min",
      text: "Si cancelan con menos de 24h, te buscamos alternativa verificada en 30 minutos.",
      color: "#c47d1a",
      light: "#fdf3e3",
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />

      <div className="min-h-screen font-sans" style={{ backgroundColor: WARM, color: "#1a1a1a" }}>
        <header
          className="border-b bg-white px-6 py-4"
          style={{ borderColor: BORDER }}
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <Link
              href="/"
              className="no-underline"
              style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600 }}
            >
              Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
            </Link>
            <Link
              href="/buscar"
              className="text-[12px] font-medium no-underline"
              style={{ color: PRIMARY }}
            >
              Buscar →
            </Link>
          </div>
        </header>

        {/* Hero */}
        <section className="border-b px-6 py-12" style={{ backgroundColor: WARM, borderColor: BORDER }}>
          <div className="mx-auto max-w-5xl">
            <span
              className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold"
              style={{ backgroundColor: theme.light, color: theme.color }}
            >
              Proveedores verificados · {ciudadCapital}
            </span>
            <h1
              className="mt-4 text-4xl text-[#1a1a1a] sm:text-5xl"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              {H1S[vertical](ciudadCapital)}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#666]">
              {SUBTITULOS[vertical]}
            </p>

            <form action="/buscar" method="get" className="mt-8 flex max-w-lg flex-wrap gap-2">
              <input type="hidden" name="vertical" value={VERTICAL_BUSCAR[vertical]} />
              <input
                type="text"
                name="ciudad"
                defaultValue={ciudadCapital}
                placeholder={`Buscar en ${ciudadCapital}…`}
                className="min-w-[180px] flex-1 border px-3 py-2.5 text-[13px] outline-none"
                style={{ backgroundColor: "#fff", borderColor: BORDER, borderRadius: 8 }}
              />
              <button
                type="submit"
                className="rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                Buscar →
              </button>
            </form>

            <div className="mt-8 flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  {totalProveedores}
                </p>
                <p className="text-[12px] text-[#888]">proveedores disponibles</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  {avgRating ?? "—"}
                </p>
                <p className="text-[12px] text-[#888]">valoración media</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  30 min
                </p>
                <p className="text-[12px] text-[#888]">garantía de respuesta</p>
              </div>
            </div>
          </div>
        </section>

        {/* Grid proveedores */}
        <section className="px-6 py-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold text-[#1a1a1a]">
              Proveedores verificados en {ciudadCapital}
            </h2>
            {servicios.length === 0 ? (
              <div
                className="mt-6 rounded-xl border bg-white p-8 text-center"
                style={{ borderColor: BORDER }}
              >
                <p className="text-base font-medium text-[#1a1a1a]">
                  Próximamente en {ciudadCapital}
                </p>
                <p className="mt-2 text-sm text-[#888]">
                  Aún no hay proveedores publicados en esta ciudad. Sé el primero en unirte.
                </p>
                <Link
                  href="/ser-proveedor"
                  className="mt-5 inline-block rounded-lg px-5 py-3 text-sm font-semibold text-white no-underline"
                  style={{ backgroundColor: theme.color }}
                >
                  {PROVEEDOR_CTA[vertical]} →
                </Link>
              </div>
            ) : (
              <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {servicios.map((service) => (
                  <ProviderCard
                    key={service.id}
                    service={service}
                    theme={theme}
                    rating={ratingsByProveedor[service.proveedor_id]}
                  />
                ))}
              </ul>
            )}
            {servicios.length > 0 && (
              <div className="mt-6 text-center">
                <Link
                  href={buscarHref}
                  className="text-sm font-semibold no-underline"
                  style={{ color: PRIMARY }}
                >
                  Ver todos en {ciudadCapital} →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Beneficios */}
        <section
          className="border-y px-6 py-12"
          style={{ backgroundColor: "#fff", borderColor: BORDER }}
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-xl font-semibold text-[#1a1a1a]">
              Por qué Home&Heart
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {beneficios.map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border p-5"
                  style={{ borderColor: BORDER, backgroundColor: WARM }}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                    style={{ backgroundColor: b.light, color: b.color }}
                  >
                    {b.icon}
                  </span>
                  <h3 className="mt-3 text-[15px] font-semibold text-[#1a1a1a]">{b.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#666]">{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-6 py-12">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-semibold text-[#1a1a1a]">Preguntas frecuentes</h2>
            <div className="mt-6">
              <FaqAccordion items={faqs} />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section
          className="border-t px-6 py-14 text-center"
          style={{ backgroundColor: theme.light, borderColor: BORDER }}
        >
          <div className="mx-auto max-w-2xl">
            <h2
              className="text-2xl text-[#1a1a1a] sm:text-3xl"
              style={{ fontFamily: SERIF, fontWeight: 300 }}
            >
              Encuentra {BUSCAR_LABEL[vertical]} en {ciudadCapital}
            </h2>
            <p className="mt-3 text-sm text-[#666]">
              Reserva online con pago protegido y la Garantía Home&Heart.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={buscarHref}
                className="rounded-lg px-6 py-3 text-sm font-semibold text-white no-underline"
                style={{ backgroundColor: PRIMARY }}
              >
                Buscar {BUSCAR_LABEL[vertical]} en {ciudadCapital} →
              </Link>
              <Link
                href="/ser-proveedor"
                className="rounded-lg border bg-white px-6 py-3 text-sm font-semibold no-underline"
                style={{ borderColor: PRIMARY, color: PRIMARY }}
              >
                {PROVEEDOR_CTA[vertical]}
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
