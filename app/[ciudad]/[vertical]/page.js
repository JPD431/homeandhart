import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getServiceCoverPhoto } from "@/app/lib/service-card-display";
import { SERIF } from "@/app/components/brand";
import {
  aggregateRatingsByProveedor,
  computeProveedorRating,
  formatProveedorRatingAvg,
} from "@/app/lib/reviews";
import { getPublicSupabase } from "@/app/lib/supabase-public";
import { getVerificadoBadgeTooltip } from "@/app/lib/verification-copy";
import { translations } from "@/app/lib/i18n";

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

/**
 * No pre-renderizar las 15 landings en el build (Vercel corta a 60s/ruta).
 * Se generan bajo demanda y se cachean con ISR (revalidate).
 * SEO: las URLs siguen indexables; el HTML se cachea tras el primer hit.
 */
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { ciudad, vertical } = await params;
  if (!isValidRoute(ciudad, vertical)) return { title: "Home&Heart" };

  // For metadata we use ES as canonical (SEO default)
  const tv = translations.es.ciudadVertical;
  const ciudadCapital = capitalizeCiudad(ciudad);

  const TITULOS = {
    nineras: tv.metaTituloNineras,
    alojamiento: tv.metaTituloAlojamiento,
    mascotas: tv.metaTituloMascotas,
  };
  const DESCRIPCIONES = {
    nineras: tv.metaDescNineras,
    alojamiento: tv.metaDescAlojamiento,
    mascotas: tv.metaDescMascotas,
  };

  const title = TITULOS[vertical](ciudadCapital);
  const description = DESCRIPCIONES[vertical](ciudadCapital);

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

function ProviderCard({ service, theme, rating, verificadoTooltip, verificadoLabel }) {
  const profile = service.profiles_public ?? {};
  const nombre = formatShortName(profile.nombre, profile.apellido) || "Proveedor";
  const zone = service.location_zone || service.ciudad || profile.ciudad || "";
  const foto =
    getServiceCoverPhoto(service) ||
    profile.foto_perfil ||
    profile.avatar_url;
  const valoracionMedia =
    rating?.count > 0 && rating.avg != null
      ? Number(rating.avg).toFixed(1)
      : null;

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
            <span
              className="mt-1.5 inline-block text-[9px] font-semibold text-[#0e7a5c]"
              title={verificadoTooltip}
            >
              {verificadoLabel}
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
  const supabase = getPublicSupabase();
  const ciudadFilter = `ciudad.ilike.%${ciudadCapital}%,location_zone.ilike.%${ciudadCapital}%`;

  const servicesQuery = supabase
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
    .or(ciudadFilter)
    .limit(6);

  const countQuery = supabase
    .from("services")
    .select("id, profiles_public!inner(verificado)", {
      count: "exact",
      head: true,
    })
    .eq("vertical", verticalDB)
    .eq("disponible", true)
    .eq("profiles_public.verificado", true)
    .or(ciudadFilter);

  const [{ data: servicios }, { count: totalProveedores }] = await Promise.all([
    servicesQuery,
    countQuery,
  ]);

  const lista = servicios ?? [];
  const proveedorIds = [
    ...new Set(lista.map((s) => s.proveedor_id).filter(Boolean)),
  ];

  let ratingsByProveedor = {};
  let avgRating = null;
  if (proveedorIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("proveedor_id, valoracion, cliente_id")
      .in("proveedor_id", proveedorIds);

    ratingsByProveedor = aggregateRatingsByProveedor(reviews);
    avgRating = formatProveedorRatingAvg(computeProveedorRating(reviews));
  }

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

  // Lang detection from cookie (set by LangContext on the client)
  const cookieStore = await cookies();
  const lang = cookieStore.get("lang")?.value ?? "es";
  const tv = (translations[lang] ?? translations.es).ciudadVertical;

  const ciudadCapital = capitalizeCiudad(ciudad);
  const verticalDB = VERTICAL_DB[vertical];
  const theme = VERTICAL_THEME[verticalDB];
  const buscarHref = `/buscar?vertical=${VERTICAL_BUSCAR[vertical]}&ciudad=${encodeURIComponent(ciudadCapital)}`;
  const verificadoBadgeTooltip = getVerificadoBadgeTooltip(lang);

  // Localized string maps (moved inside component from module level)
  const H1S = {
    nineras: tv.h1Nineras,
    alojamiento: tv.h1Alojamiento,
    mascotas: tv.h1Mascotas,
  };

  const SUBTITULOS = {
    nineras: tv.subtituloNineras,
    alojamiento: tv.subtituloAlojamiento,
    mascotas: tv.subtituloMascotas,
  };

  const PROVEEDOR_CTA = {
    nineras: tv.ctaJoinNineras,
    alojamiento: tv.ctaJoinAlojamiento,
    mascotas: tv.ctaJoinMascotas,
  };

  const BUSCAR_LABEL = {
    nineras: tv.buscarLabelNineras,
    alojamiento: tv.buscarLabelAlojamiento,
    mascotas: tv.buscarLabelMascotas,
  };

  // Localized FAQs
  const faqs = {
    nineras: [
      { q: tv.faqNinerasVerifQ(ciudadCapital), a: tv.faqNinerasVerifA },
      { q: tv.faqNinerasCostoQ(ciudadCapital), a: tv.faqNinerasCostoA },
      { q: tv.faqNinerasViajeQ, a: tv.faqNinerasViajeA },
      { q: tv.faqNinerasGarantiaQ, a: tv.faqNinerasGarantiaA },
    ],
    alojamiento: [
      { q: tv.faqAlojNruQ(ciudadCapital), a: tv.faqAlojNruA },
      { q: tv.faqAlojPetQ, a: tv.faqAlojPetA },
      { q: tv.faqAlojCancelQ, a: tv.faqAlojCancelA },
      { q: tv.faqAlojVerifQ(ciudadCapital), a: tv.faqAlojVerifA },
    ],
    mascotas: [
      { q: tv.faqMascVerifQ(ciudadCapital), a: tv.faqMascVerifA },
      { q: tv.faqMascFotosQ, a: tv.faqMascFotosA },
      { q: tv.faqMascJardinQ(ciudadCapital), a: tv.faqMascJardinA },
    ],
  }[vertical];

  const { servicios, totalProveedores, avgRating, ratingsByProveedor } =
    await fetchLandingData(ciudadCapital, verticalDB);

  // Schema uses ES canonical strings for SEO
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

  // Localized benefits
  const beneficioVerifTitle =
    vertical === "alojamiento" ? tv.beneficioAlojTitle : tv.beneficioVerifTitle;
  const beneficioVerifText = SUBTITULOS[vertical];

  const beneficios = [
    {
      icon: "✓",
      title: beneficioVerifTitle,
      text: beneficioVerifText,
      color: "#0e7a5c",
      light: "#e6f4f0",
    },
    {
      icon: "🔒",
      title: tv.beneficioPagoTitle,
      text: tv.beneficioPagoText,
      color: PRIMARY,
      light: "#e8f0fb",
    },
    {
      icon: "⚡",
      title: tv.beneficioGarantiaTitle,
      text: tv.beneficioGarantiaText,
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
              {tv.buscarBtn}
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
              {tv.proveedoresVerificadosLabel} · {ciudadCapital}
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
                placeholder={tv.buscarEnPlaceholder(ciudadCapital)}
                className="min-w-[180px] flex-1 border px-3 py-2.5 text-[13px] outline-none"
                style={{ backgroundColor: "#fff", borderColor: BORDER, borderRadius: 8 }}
              />
              <button
                type="submit"
                className="rounded-lg px-5 py-2.5 text-[13px] font-semibold text-white"
                style={{ backgroundColor: PRIMARY }}
              >
                {tv.buscarBtn}
              </button>
            </form>

            <div className="mt-8 flex flex-wrap gap-6">
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  {totalProveedores}
                </p>
                <p className="text-[12px] text-[#888]">{tv.proveedoresDisponibles}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  {avgRating ?? "—"}
                </p>
                <p className="text-[12px] text-[#888]">{tv.valoracionMedia}</p>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: PRIMARY }}>
                  {tv.garantiaMin}
                </p>
                <p className="text-[12px] text-[#888]">{tv.garantiaRespuesta}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Grid proveedores */}
        <section className="px-6 py-12">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold text-[#1a1a1a]">
              {tv.proveedoresEn(ciudadCapital)}
            </h2>
            {servicios.length === 0 ? (
              <div
                className="mt-6 rounded-xl border bg-white p-8 text-center"
                style={{ borderColor: BORDER }}
              >
                <p className="text-base font-medium text-[#1a1a1a]">
                  {tv.proximamente(ciudadCapital)}
                </p>
                <p className="mt-2 text-sm text-[#888]">
                  {tv.sinProveedores}
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
                    verificadoTooltip={verificadoBadgeTooltip}
                    verificadoLabel={tv.verificado}
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
                  {tv.verTodos(ciudadCapital)}
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
              {tv.porQueHH}
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
            <h2 className="text-xl font-semibold text-[#1a1a1a]">{tv.preguntasFrecuentes}</h2>
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
              {tv.ctaTitulo(BUSCAR_LABEL[vertical], ciudadCapital)}
            </h2>
            <p className="mt-3 text-sm text-[#666]">
              {tv.ctaDesc}
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={buscarHref}
                className="rounded-lg px-6 py-3 text-sm font-semibold text-white no-underline"
                style={{ backgroundColor: PRIMARY }}
              >
                {tv.ctaBuscar(BUSCAR_LABEL[vertical], ciudadCapital)}
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
