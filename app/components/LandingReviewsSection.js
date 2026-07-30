"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { computeProveedorRating } from "@/app/lib/reviews";
import { getVerticalEmoji } from "@/app/lib/vertical-emojis";
import { supabase } from "@/app/lib/supabase";
import { BRAND, SERIF } from "./brand";

const VERTICAL_LABEL_KEYS = {
  alojamiento: "alojamiento",
  ninos: "ninos",
  mascotas: "mascotas",
};

const VERTICAL_COLORS = {
  alojamiento: "#1d4f91",
  ninos: "#0e7a5c",
  mascotas: "#c47d1a",
};

function getClienteInitial(nombre) {
  if (!nombre?.trim()) return "?";
  return nombre.trim().charAt(0).toUpperCase();
}

function formatReviewDate(dateStr, lang) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "es-ES", {
    month: "long",
    year: "numeric",
  });
}

function Stars({ value }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span
      className="text-sm tracking-wider"
      style={{ color: "#c8922a" }}
      aria-label={`${rounded} de 5 estrellas`}
    >
      {"★".repeat(rounded)}
      {"☆".repeat(Math.max(0, 5 - rounded))}
    </span>
  );
}

function VerticalTag({ vertical, label }) {
  const color = VERTICAL_COLORS[vertical] || BRAND.primary;
  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${color}14`, color }}
    >
      {getVerticalEmoji(vertical)} {label}
    </span>
  );
}

export default function LandingReviewsSection() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const r = t.landingReviews;
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function loadReviews() {
      const [{ data: allRatings }, { data: recentReviews }] = await Promise.all([
        supabase.from("reviews").select("valoracion, cliente_id"),
        supabase
          .from("reviews")
          .select(
            "id, valoracion, comentario, created_at, cliente_id, service_id, services(vertical)",
          )
          .order("created_at", { ascending: false })
          .limit(12),
      ]);

      const rating = computeProveedorRating(allRatings);
      setTotalCount(rating.count);
      setAverageRating(
        rating.count > 0 && rating.avg != null ? rating.avg.toFixed(1) : null,
      );

      if (!recentReviews?.length) {
        setReviews([]);
        setLoaded(true);
        return;
      }

      const clienteIds = [
        ...new Set(recentReviews.map((review) => review.cliente_id).filter(Boolean)),
      ];
      const { data: clientes } = await supabase
        .from("profiles_public")
        .select("id, nombre")
        .in("id", clienteIds);

      const namesMap = Object.fromEntries(
        (clientes ?? []).map((cliente) => [cliente.id, cliente.nombre]),
      );

      const enriched = recentReviews
        .map((review) => ({
          ...review,
          vertical: review.services?.vertical ?? null,
          clienteInitial: getClienteInitial(namesMap[review.cliente_id]),
          fechaLabel: formatReviewDate(review.created_at, lang),
        }))
        .filter((review) => review.comentario?.trim() || review.valoracion)
        .slice(0, 3);

      setReviews(enriched);
      setLoaded(true);
    }

    loadReviews();
  }, [lang]);

  if (!loaded || totalCount === 0) {
    return null;
  }

  function getVerticalLabel(vertical) {
    const key = VERTICAL_LABEL_KEYS[vertical];
    if (!key) return t.hero.alojamiento;
    if (key === "alojamiento") return t.hero.alojamiento;
    if (key === "ninos") return t.hero.ninos;
    return t.hero.mascotas;
  }

  return (
    <section
      className="text-[#1a1a1a]"
      style={{ backgroundColor: BRAND.warm, padding: "80px 40px" }}
      aria-labelledby="landing-reviews-heading"
    >
      <div className="mx-auto max-w-6xl">
        <header className="text-center">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.2em] sm:text-xs"
            style={{ color: BRAND.primary }}
          >
            {r.label}
          </p>
          <h2
            id="landing-reviews-heading"
            className="mt-4 text-3xl leading-snug sm:text-4xl lg:text-[2.5rem]"
            style={{ fontFamily: SERIF }}
          >
            {r.titulo}
          </h2>
        </header>

        {averageRating && (
          <div
            className="mx-auto mt-10 flex max-w-md flex-col items-center gap-2 rounded-2xl border bg-white px-8 py-6 text-center"
            style={{ borderColor: BRAND.border }}
          >
            <p
              className="leading-none"
              style={{ fontFamily: SERIF, fontSize: "48px", color: BRAND.primary }}
            >
              {averageRating}
            </p>
            <Stars value={averageRating} />
            <p className="text-sm text-[#5c5c5c]">{r.valoracionMedia}</p>
            <p className="text-xs text-[#888]">{r.resenas(totalCount)}</p>
          </div>
        )}

        {reviews.length > 0 && (
          <div className="mt-8 grid gap-5 md:grid-cols-3 md:gap-6">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="flex flex-col rounded-2xl border bg-white p-6 sm:p-7"
                style={{ borderColor: BRAND.border }}
              >
                {review.vertical && (
                  <VerticalTag
                    vertical={review.vertical}
                    label={getVerticalLabel(review.vertical)}
                  />
                )}
                <div className="mt-4">
                  <Stars value={review.valoracion} />
                </div>
                {review.comentario && (
                  <p
                    className="mt-4 flex-1 text-base leading-relaxed text-[#333]"
                    style={{ fontFamily: SERIF, fontStyle: "italic" }}
                  >
                    {review.comentario}
                  </p>
                )}
                <div
                  className="mt-5 flex items-center gap-3 border-t pt-4"
                  style={{ borderColor: BRAND.border }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ backgroundColor: BRAND.light, color: BRAND.primary }}
                  >
                    {review.clienteInitial}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">
                      {review.clienteInitial}.
                    </p>
                    {review.fechaLabel && (
                      <p className="text-xs capitalize text-[#888]">
                        {review.fechaLabel}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
