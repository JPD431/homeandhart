"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const GOLD = "#c8922a";

function Logo() {
  return (
    <p className="text-center text-2xl font-semibold tracking-tight">
      <span style={{ color: "#111111" }}>Home</span>
      <span style={{ color: BRAND.primary, fontStyle: "italic" }}>&</span>
      <span style={{ color: "#111111" }}>Heart</span>
    </p>
  );
}

function StarIcon({ filled, size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? GOLD : "none"}
      stroke={filled ? GOLD : "#ccc"}
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    </svg>
  );
}

function StarRatingDisplay({ value }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon key={star} filled={star <= value} />
      ))}
    </div>
  );
}

function StarSelector({ value, hover, onSelect, onHover, onLeave }) {
  return (
    <div className="flex justify-center gap-2" onMouseLeave={onLeave}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = (hover || value) >= star;
        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => onHover(star)}
            onClick={() => onSelect(star)}
            className="transition-transform hover:scale-110"
            aria-label={`${star} estrella${star > 1 ? "s" : ""}`}
          >
            <StarIcon filled={active} />
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
  const [bookingMeta, setBookingMeta] = useState(null);
  const [existingReview, setExistingReview] = useState(null);
  const [valoracion, setValoracion] = useState(0);
  const [hoverStar, setHoverStar] = useState(0);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

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
        setErrorMessage("No se encontró la reserva.");
        setLoading(false);
        return;
      }

      if (booking.cliente_id !== user.id) {
        setErrorMessage("No tienes permiso para valorar esta reserva.");
        setLoading(false);
        return;
      }

      if (booking.estado !== "completada") {
        setErrorMessage("Solo puedes valorar reservas completadas.");
        setLoading(false);
        return;
      }

      const { data: service } = await supabase
        .from("services")
        .select("id, titulo, proveedor_id")
        .eq("id", booking.service_id)
        .single();

      const { data: proveedor } = await supabase
        .from("profiles")
        .select("nombre, apellido")
        .eq("id", service?.proveedor_id)
        .single();

      const { data: review } = await supabase
        .from("reviews")
        .select("*")
        .eq("booking_id", bookingId)
        .maybeSingle();

      setBookingMeta({
        clienteId: user.id,
        proveedorId: service?.proveedor_id,
        serviceId: service?.id,
      });
      setProveedorNombre(
        formatShortName(proveedor?.nombre, proveedor?.apellido) || "Proveedor",
      );
      setServicioTitulo(service?.titulo || "Servicio");
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

    if (!bookingMeta || valoracion < 1) {
      setErrorMessage("Selecciona una valoración de 1 a 5 estrellas.");
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
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage("¡Gracias por tu valoración!");
    setTimeout(() => {
      router.push("/dashboard");
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
          <p className="mt-8 text-center text-sm text-red-600">{errorMessage}</p>
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
              <StarRatingDisplay value={existingReview.valoracion} />
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
              <StarSelector
                value={valoracion}
                hover={hoverStar}
                onSelect={setValoracion}
                onHover={setHoverStar}
                onLeave={() => setHoverStar(0)}
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
                {submitting ? "Enviando…" : "Enviar valoración"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
