import { BRAND, SERIF } from "./brand";

const STAR_COLOR = "#c8922a";

const SUMMARY_STATS = [
  "580 reseñas verificadas",
  "98% recomendarían H&H",
  "1.200+ reservas",
];

const REVIEWS = [
  {
    tag: "niñera",
    text: "Sara habló inglés con nuestros hijos. Por fin cenamos solos.",
    name: "James W.",
    meta: "familia británica",
  },
  {
    tag: "mascota",
    text: "Fotos cada pocas horas. Mi perro volvió feliz.",
    name: "Sofía M.",
    meta: "Madrid",
  },
  {
    tag: "alojamiento",
    text: "Saber que el apartamento tenía todos los papeles fue un alivio enorme.",
    name: "Lena B.",
    meta: "familia alemana",
  },
];

function Stars({ className = "" }) {
  return (
    <span
      className={`tracking-wider ${className}`}
      style={{ color: STAR_COLOR }}
      aria-label="5 de 5 estrellas"
    >
      ★★★★★
    </span>
  );
}

function ServiceTag({ children }) {
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]"
      style={{
        backgroundColor: BRAND.light,
        color: BRAND.primary,
      }}
    >
      {children}
    </span>
  );
}

export default function ReviewsSection() {
  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="reviews-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            lo que dicen las familias
          </p>
          <h2
            id="reviews-heading"
            className="mt-4 text-3xl leading-snug sm:text-4xl lg:text-[2.5rem]"
            style={{ fontFamily: SERIF }}
          >
            580 familias ya lo han resuelto
          </h2>
          <p className="mt-3 text-base text-[#5c5c5c] sm:text-lg">
            Reseñas reales. Sin filtros.
          </p>
        </header>

        {/* Barra resumen */}
        <div
          className="mt-12 flex flex-col gap-6 rounded-2xl border bg-white p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8"
          style={{ borderColor: BRAND.border }}
        >
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-6 lg:items-start">
            <div className="text-center sm:text-left">
              <p
                className="leading-none"
                style={{
                  fontFamily: SERIF,
                  fontSize: "48px",
                  color: BRAND.primary,
                }}
              >
                4.9
              </p>
              <Stars className="mt-2 text-lg sm:text-xl" />
              <p className="mt-1.5 text-sm text-[#5c5c5c]">Valoración media</p>
            </div>
            <div className="hidden h-16 w-px shrink-0 bg-[#e8e4de] sm:block" />
            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {["Google", "Trustpilot", "Plataforma propia"].map((source) => (
                <span
                  key={source}
                  className="rounded-full border px-3 py-1 text-xs text-[#666]"
                  style={{ borderColor: BRAND.border }}
                >
                  {source}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden h-16 w-px shrink-0 bg-[#e8e4de] lg:block" />

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-end lg:gap-0">
            {SUMMARY_STATS.map((stat, index) => (
              <div key={stat} className="flex items-center">
                {index > 0 && (
                  <div
                    className="mx-5 hidden h-10 w-px bg-[#e8e4de] sm:block"
                    aria-hidden
                  />
                )}
                <p className="text-center text-sm font-medium text-[#333] sm:text-left">
                  {stat}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Reseña destacada */}
        <article
          className="relative mt-8 overflow-hidden rounded-2xl border bg-white p-6 sm:p-8 lg:p-10"
          style={{ borderColor: BRAND.border }}
        >
          <span
            className="pointer-events-none absolute left-4 top-2 select-none leading-none sm:left-6"
            style={{
              fontFamily: SERIF,
              fontSize: "100px",
              color: BRAND.primary,
              opacity: 0.06,
            }}
            aria-hidden
          >
            &ldquo;
          </span>

          <div className="relative grid gap-8 lg:grid-cols-2">
            <div>
              <ServiceTag>paquete completo</ServiceTag>
              <Stars className="mt-4 block text-base" />
              <blockquote
                className="mt-4 leading-relaxed text-[#333]"
                style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "20px" }}
              >
                Reservé el apartamento, la niñera y el cuidador del perro en diez
                minutos.{" "}
                <span
                  className="font-bold not-italic"
                  style={{ color: BRAND.primary }}
                >
                  Por fin alguien lo había pensado.
                </span>
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                  style={{
                    backgroundColor: BRAND.light,
                    color: BRAND.primary,
                  }}
                >
                  CH
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">
                    Claire H.
                  </p>
                  <p className="text-xs text-[#888]">
                    Familia francesa · Madrid, agosto 2024
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-start lg:justify-end">
              <ServiceTag>paquete completo</ServiceTag>
            </div>
          </div>
        </article>

        {/* Grid de reseñas */}
        <div className="mt-6 grid gap-5 md:grid-cols-3 md:gap-6">
          {REVIEWS.map((review) => (
            <article
              key={review.name}
              className="flex flex-col rounded-2xl border bg-white p-6 sm:p-7"
              style={{ borderColor: BRAND.border }}
            >
              <ServiceTag>{review.tag}</ServiceTag>
              <Stars className="mt-4 block text-sm" />
              <p
                className="mt-4 flex-1 text-base leading-relaxed text-[#333]"
                style={{ fontFamily: SERIF, fontStyle: "italic" }}
              >
                {review.text}
              </p>
              <div className="mt-5 border-t pt-4" style={{ borderColor: BRAND.border }}>
                <p className="text-sm font-semibold text-[#1a1a1a]">
                  {review.name}
                </p>
                <p className="mt-0.5 text-xs capitalize text-[#888]">
                  {review.meta}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <button
            type="button"
            className="text-sm font-semibold transition-opacity hover:opacity-80 sm:text-base"
            style={{ color: BRAND.primary }}
          >
            Ver todas las reseñas →
          </button>
        </div>
      </div>
    </section>
  );
}
