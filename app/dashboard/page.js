import Navbar from "@/app/components/Navbar";
import { BRAND } from "@/app/components/brand";

const CARDS = [
  {
    title: "Mis reservas",
    description: "Consulta y gestiona tus reservas activas y pasadas.",
  },
  {
    title: "Mis favoritos",
    description: "Accede rápido a tus proveedores guardados.",
  },
  {
    title: "Mi perfil",
    description: "Actualiza tus datos personales y preferencias.",
  },
];

export default function DashboardPage() {
  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <header className="max-w-2xl">
          <h1 className="text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl">
            Bienvenida a Home&Heart
          </h1>
          <p className="mt-2 text-lg text-[#5c5c5c]">Tu panel de control</p>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <article
              key={card.title}
              className="rounded-2xl border bg-white p-6 transition-shadow hover:shadow-md"
              style={{ borderColor: BRAND.border }}
            >
              <h2
                className="text-lg font-semibold"
                style={{ color: BRAND.primary }}
              >
                {card.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5c5c5c]">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
