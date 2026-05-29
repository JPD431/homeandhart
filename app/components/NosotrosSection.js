import { BRAND, SERIF } from "./brand";

const VALUES = [
  { letter: "F", title: "Faith", description: "Confianza real." },
  { letter: "A", title: "Attention", description: "Cada detalle." },
  { letter: "M", title: "Magic", description: "Viajes tranquilos." },
  { letter: "I", title: "Integrity", description: "Sin sorpresas." },
  { letter: "L", title: "Links", description: "Vínculos reales." },
  { letter: "Y", title: "You First", description: "Personas primero." },
];

export default function NosotrosSection() {
  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="nosotros-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div
          className="grid items-center lg:grid-cols-2"
          style={{ gap: "64px" }}
        >
          {/* Columna izquierda */}
          <div>
            <p
              className="text-[11px] uppercase"
              style={{
                color: BRAND.primary,
                fontWeight: 600,
                letterSpacing: "0.1em",
              }}
            >
              nosotros
            </p>
            <h2
              id="nosotros-heading"
              className="mt-4 leading-snug text-[#1a1a1a]"
              style={{ fontFamily: SERIF, fontSize: "30px" }}
            >
              Nació de saber que faltaba algo
            </h2>
            <p
              className="mt-5 text-[14px] text-[#5c5c5c]"
              style={{ lineHeight: 1.8 }}
            >
              Home&Heart surge porque viajar o vivir con familia y mascota
              debería ser simple y tranquilo — no un rompecabezas de webs,
              grupos de WhatsApp y llamadas sin respuesta. Somos una plataforma
              de confianza que une alojamiento, cuidado de niños y cuidado de
              mascotas en un solo lugar, con proveedores verificados y un
              proceso diseñado para que lo importante sea disfrutar, no
              gestionar.
            </p>
            <a
              href="#"
              className="mt-6 inline-block text-sm transition-opacity hover:opacity-80"
              style={{ color: BRAND.primary, fontWeight: 500 }}
            >
              Conoce nuestra historia →
            </a>
          </div>

          {/* Columna derecha — FAMILY */}
          <div className="grid grid-cols-3 grid-rows-2 gap-3 sm:gap-4">
            {VALUES.map((value) => (
              <article
                key={value.letter}
                className="border bg-white"
                style={{
                  borderColor: BRAND.border,
                  borderRadius: "13px",
                  padding: "14px",
                }}
              >
                <p
                  className="mb-1 leading-none"
                  style={{
                    fontFamily: SERIF,
                    fontSize: "26px",
                    color: BRAND.primary,
                    opacity: 0.22,
                    lineHeight: 1,
                    marginBottom: "4px",
                  }}
                >
                  {value.letter}
                </p>
                <p
                  className="text-[#111]"
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    marginBottom: "3px",
                  }}
                >
                  {value.title}
                </p>
                <p
                  className="text-[#aaa]"
                  style={{ fontSize: "11px", lineHeight: 1.4 }}
                >
                  {value.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
