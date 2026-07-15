"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import {
  canLeaveReview,
  reviewEligibilityMessage,
} from "@/app/lib/reviews";
import { supabase } from "@/app/lib/supabase";

const INACTIVE = "#e0e0e0";
const ICON_SIZE = 36;

const VERTICAL_CONFIG = {
  alojamiento: {
    color: "#1d4f91",
    submitLabel: "Valorar alojamiento",
    unit: "casita",
  },
  mascotas: {
    color: "#c47d1a",
    submitLabel: "Valorar cuidador",
    unit: "huella",
  },
  ninos: {
    color: "#0e7a5c",
    submitLabel: "Valorar niñera",
    unit: "corazón",
  },
};

function getVerticalConfig(vertical) {
  return VERTICAL_CONFIG[vertical] ?? VERTICAL_CONFIG.alojamiento;
}

function Logo() {
  return (
    <p className="text-center text-2xl font-semibold tracking-tight">
      <span style={{ color: "#111111" }}>Home</span>
      <span style={{ color: BRAND.primary, fontStyle: "italic" }}>&</span>
      <span style={{ color: "#111111" }}>Heart</span>
    </p>
  );
}

function VerticalRatingIcon({ vertical, filled, size = ICON_SIZE }) {
  const { color } = getVerticalConfig(vertical);
  const activeColor = filled ? color : INACTIVE;

  if (vertical === "mascotas") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={activeColor}
        aria-hidden
      >
        <circle cx="7" cy="4" r="1.5" />
        <circle cx="12" cy="3" r="1.5" />
        <circle cx="17" cy="4" r="1.5" />
        <circle cx="4.5" cy="8.5" r="1.5" />
        <path d="M12 22c-3.5 0-7-2-7-6 0-2 1.5-3.5 3-4.5 1-.7 2.5-1 4-1s3 .3 4 1c1.5 1 3 2.5 3 4.5 0 4-3.5 6-7 6z" />
      </svg>
    );
  }

  if (vertical === "ninos") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={activeColor}
        aria-hidden
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? activeColor : "none"}
      stroke={activeColor}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function VerticalRatingDisplay({ vertical, value }) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((level) => (
        <VerticalRatingIcon
          key={level}
          vertical={vertical}
          filled={level <= value}
        />
      ))}
    </div>
  );
}

function VerticalRatingSelector({
  vertical,
  value,
  hover,
  onSelect,
  onHover,
  onLeave,
}) {
  const { unit } = getVerticalConfig(vertical);

  return (
    <div className="flex justify-center gap-2" onMouseLeave={onLeave}>
      {[1, 2, 3, 4, 5].map((level) => {
        const active = (hover || value) >= level;
        return (
          <button
            key={level}
            type="button"
            onMouseEnter={() => onHover(level)}
            onClick={() => onSelect(level)}
            className="transition-transform duration-200 ease-out hover:scale-110"
            aria-label={`${level} ${unit}${level > 1 ? "s" : ""}`}
          >
            <VerticalRatingIcon vertical={vertical} filled={active} />
          </button>
        );
      })}
    </div>
  );
}

function formatShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

export default function ResenaPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.bookingId;

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [servicioTitulo, setServicioTitulo] = useState("");
  const [vertical, setVertical] = useState("alojamiento");
  const [bookingMeta, setBookingMeta] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [valoracion, setValoracion] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const verticalConfig = getVerticalConfig(vertical);

  useEffect(() => {
    async function load() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();

      if (bookingError || !booking) {
        setErrorMessage(reviewEligibilityMessage("not_found"));
        setLoading(false);
        return;
      }

      const { data: review } = await supabase
        .from("reviews")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      const eligibility = canLeaveReview(booking, {
        hasReview: Boolean(review),
        userId: user.id,
      });

      // Sin permiso / no completada / fuera de plazo: mensaje y salir (salvo ya reseñada).
      if (!eligibility.ok && eligibility.reason !== "already_reviewed") {
        setErrorMessage(reviewEligibilityMessage(eligibility.reason));
        setLoading(false);
        return;
      }

      const { data: service } = await supabase
        .from("services")
        .select("id, titulo, proveedor_id, vertical")
        .eq("id", booking.service_id)
        .single();

      const { data: proveedor } = await supabase
        .from("profiles_public")
        .select("nombre, apellido")
        .eq("id", service?.proveedor_id)
        .single();

      setBookingMeta({
        clienteId: user.id,
        proveedorId: service?.proveedor_id,
        serviceId: service?.id,
        canSubmit: eligibility.ok,
      });
      setProveedorNombre(
        formatShortName(proveedor?.nombre, proveedor?.apellido) || "Proveedor",
      );
      setServicioTitulo(service?.titulo || "Servicio");
      setVertical(service?.vertical || "alojamiento");
      setExistingReview(review);
      if (review) {
        setValoracion(review.valoracion);
        setComentario(review.comentario || "");
      }
      setLoading(false);
    }

    load();
  }, [router, bookingId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMessage("");

    if (!bookingMeta?.canSubmit) {
      setErrorMessage("No se puede dejar reseña ahora.");
      return;
    }

    if (valoracion < 1) {
      setErrorMessage("Selecciona una valoración de 1 a 5.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.from("reviews").insert({
      booking_id: bookingId,
      cliente_id: bookingMeta.clienteId,
      proveedor_id: bookingMeta.proveedorId,
      service_id: bookingMeta.serviceId,
      valoracion,
      comentario: comentario.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === "23505") {
        setErrorMessage("Ya has valorado este servicio.");
        setExistingReview({
          valoracion,
          comentario: comentario.trim() || null,
        });
        return;
      }
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("¡Gracias por tu valoración!");
    setTimeout(() => {
      router.push("/historial");
    }, 2000);
  }

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <p className="text-sm text-[#666]">Cargando…</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12 font-sans"
      style={{ backgroundColor: BRAND.warm }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border bg-white p-8 shadow-sm sm:p-10"
        style={{ borderColor: BRAND.border }}
      >
        <Logo />

        {errorMessage && !existingReview && !successMessage ? (
          <div className="mt-8 text-center">
            <p className="text-sm leading-relaxed text-[#666]">{errorMessage}</p>
            <a
              href="/historial"
              className="mt-6 inline-block text-sm font-semibold no-underline"
              style={{ color: BRAND.primary }}
            >
              Volver al historial
            </a>
          </div>
        ) : existingReview ? (
          <div className="mt-8 text-center">
            <h1
              className="text-2xl font-bold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              Ya has valorado este servicio
            </h1>
            <p className="mt-2 text-sm text-[#666]">
              {proveedorNombre} · {servicioTitulo}
            </p>
            <div className="mt-6 flex justify-center">
              <VerticalRatingDisplay
                vertical={vertical}
                value={existingReview.valoracion}
              />
            </div>
            {existingReview.comentario && (
              <p className="mt-4 rounded-xl bg-[#f7f5f2] px-4 py-3 text-sm leading-relaxed text-[#444]">
                {existingReview.comentario}
              </p>
            )}
          </div>
        ) : (
          <>
            <h1
              className="mt-8 text-center text-2xl font-bold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              ¿Cómo fue tu experiencia?
            </h1>
            <p className="mt-2 text-center text-sm text-[#666]">
              {proveedorNombre} · {servicioTitulo}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
              <VerticalRatingSelector
                vertical={vertical}
                value={valoracion}
                hover={hoverRating}
                onSelect={setValoracion}
                onHover={setHoverRating}
                onLeave={() => setHoverRating(0)}
              />

              <div>
                <label
                  htmlFor="comentario"
                  className="mb-1.5 block text-xs font-medium text-[#444]"
                >
                  Cuéntanos tu experiencia (opcional)
                </label>
                <textarea
                  id="comentario"
                  rows={4}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="¿Qué destacarías de este proveedor?"
                  className="w-full resize-y rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              {successMessage && (
                <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
                  {successMessage}
                </p>
              )}

              {errorMessage && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !!successMessage}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}
              >
                {submitting ? "Enviando…" : verticalConfig.submitLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
