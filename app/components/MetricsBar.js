"use client";

import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND } from "./brand";

const METRIC_KEYS = [
  { value: "340+", key: "proveedores" },
  { value: "1200+", key: "reservas" },
  { value: "4.9", key: "valoracion" },
  { value: "98%", key: "satisfaccion" },
];

export default function MetricsBar() {
  const { lang } = useLang();
  const t = useTranslation(lang);

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
        {METRIC_KEYS.map((metric) => (
          <div key={metric.key} className="text-center">
            <p
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: BRAND.primary }}
            >
              {metric.value}
            </p>
            <p className="mt-1 text-sm capitalize text-[#5c5c5c]">
              {t.metricsBar[metric.key]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
