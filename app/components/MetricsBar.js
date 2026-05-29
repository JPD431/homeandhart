import { BRAND } from "./brand";

const METRICS = [
  { value: "340+", label: "proveedores" },
  { value: "1200+", label: "reservas" },
  { value: "4.9", label: "valoración" },
  { value: "98%", label: "satisfacción" },
];

export default function MetricsBar() {
  return (
    <section
      className="border-t border-b"
      style={{
        borderColor: BRAND.border,
        backgroundColor: "#fff",
      }}
      aria-label="Estadísticas de la plataforma"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 md:grid-cols-4 lg:px-8">
        {METRICS.map((metric) => (
          <div key={metric.label} className="text-center">
            <p
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: BRAND.primary }}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-sm capitalize text-[#5c5c5c]">
              {metric.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
