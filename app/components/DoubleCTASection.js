import { BRAND, SERIF } from "./brand";

const DARK_BLUE = "#163a6b";

const TRAVEL_PILLS = [
  "Alojamiento verificado",
  "Niñera certificada",
  "Cuidador mascotas",
  "Un pago",
];

const CITY_PILLS = [
  "Disponible hoy",
  "Verificado",
  "Pago protegido",
  "Sin compromiso",
];

function Pill({ children, variant = "dark" }) {
  const isDark = variant === "dark";
  return (
    <span
      className="text-[11px]"
      style={{
        backgroundColor: isDark
          ? "rgba(255, 255, 255, 0.12)"
          : BRAND.light,
        color: isDark ? "rgba(255, 255, 255, 0.8)" : DARK_BLUE,
        borderRadius: "20px",
        padding: "4px 11px",
      }}
    >
      {children}
    </span>
  );
}

export default function DoubleCTASection() {
  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="double-cta-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            ¿cómo podemos ayudarte?
          </p>
          <h2
            id="double-cta-heading"
            className="mt-4 text-[#1a1a1a]"
            style={{ fontFamily: SERIF, fontSize: "32px" }}
          >
            Cuéntanos qué necesitas
          </h2>
          <p className="mt-3 text-base text-[#5c5c5c] sm:text-lg">
            Tanto si viajas como si lo necesitas en tu ciudad.
          </p>
        </header>

        <div className="mx-auto mt-12" style={{ maxWidth: "960px" }}>
        <div
          className="grid md:grid-cols-2"
          style={{ gap: "18px" }}
        >
          {/* Tarjeta azul — Si viajas */}
          <article
            className="relative overflow-hidden text-white"
            style={{
              backgroundColor: BRAND.primary,
              borderRadius: "22px",
              padding: "36px",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.15em]"
              style={{ color: "rgba(255, 255, 255, 0.5)" }}
            >
              Si viajas
            </p>
            <h3
              className="mt-3 text-2xl text-white"
              style={{ fontFamily: SERIF }}
            >
              Reserva el viaje completo en un solo lugar
            </h3>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: "rgba(255, 255, 255, 0.65)" }}
            >
              Alojamiento, niñera y cuidado de mascota. Todo coordinado, un
              pago.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {TRAVEL_PILLS.map((pill) => (
                <Pill key={pill} variant="dark">
                  {pill}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              className="relative z-10 mt-6 px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "#fff",
                color: BRAND.primary,
                fontWeight: 500,
                borderRadius: "22px",
              }}
            >
              Buscar disponibilidad →
            </button>
            <span
              className="pointer-events-none absolute select-none text-white"
              style={{
                right: "-10px",
                bottom: "-20px",
                fontFamily: SERIF,
                fontSize: "130px",
                opacity: 0.06,
                lineHeight: 1,
              }}
              aria-hidden
            >
              ✈
            </span>
          </article>

          {/* Tarjeta blanca — Si estás en tu ciudad */}
          <article
            className="relative overflow-hidden border bg-white"
            style={{
              borderColor: BRAND.border,
              borderRadius: "22px",
              padding: "36px",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[#aaa]">
              Si estás en tu ciudad
            </p>
            <h3
              className="mt-3 text-2xl text-[#111]"
              style={{ fontFamily: SERIF }}
            >
              Encuentra cuidado de confianza cerca de ti
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#5c5c5c]">
              Niñera o cuidador de mascota verificado, disponible hoy mismo en
              Madrid.
            </p>
            <div className="mt-5 flex flex-wrap gap-1.5">
              {CITY_PILLS.map((pill) => (
                <Pill key={pill} variant="light">
                  {pill}
                </Pill>
              ))}
            </div>
            <button
              type="button"
              className="relative z-10 mt-6 px-5 py-2.5 text-sm text-white transition-opacity hover:opacity-90"
              style={{
                backgroundColor: BRAND.primary,
                borderRadius: "22px",
              }}
            >
              Ver proveedores →
            </button>
            <span
              className="pointer-events-none absolute select-none"
              style={{
                right: "-10px",
                bottom: "-20px",
                fontFamily: SERIF,
                fontSize: "130px",
                color: BRAND.primary,
                opacity: 0.06,
                lineHeight: 1,
              }}
              aria-hidden
            >
              ⌂
            </span>
          </article>
        </div>

        {/* Proveedores */}
        <div
          className="mt-0 text-center text-white"
          style={{
            backgroundColor: DARK_BLUE,
            borderRadius: "16px",
            padding: "48px",
          }}
        >
          <h3
            className="text-2xl text-white"
            style={{ fontFamily: SERIF }}
          >
            ¿Eres niñera, cuidador o anfitrión?
          </h3>
          <p
            className="mx-auto mt-3 text-sm leading-relaxed sm:text-base"
            style={{
              maxWidth: "360px",
              color: "rgba(255, 255, 255, 0.6)",
            }}
          >
            Únete a nuestra comunidad. Clientes que valoran la confianza y pagan
            bien por ella.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              className="rounded-full border px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                borderColor: "rgba(255, 255, 255, 0.25)",
                color: "rgba(255, 255, 255, 0.8)",
              }}
            >
              Saber más
            </button>
            <button
              type="button"
              className="rounded-full px-5 py-2.5 text-sm transition-opacity hover:opacity-90"
              style={{
                backgroundColor: "#fff",
                color: BRAND.primary,
                fontWeight: 500,
              }}
            >
              Crear mi perfil
            </button>
          </div>
        </div>
        </div>
      </div>
    </section>
  );
}
