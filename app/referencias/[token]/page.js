"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { CONOCE_DESDE_OPTIONS } from "@/app/lib/referencias";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

export default function ReferenciaPublicPage() {
  const params = useParams();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [referencia, setReferencia] = useState(null);
  const [proveedorNombre, setProveedorNombre] = useState("");
  const [conoceDesde, setConoceDesde] = useState("");
  const [recomendaria, setRecomendaria] = useState(null);
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      const { data, error: fetchError } = await supabase
        .from("referencias")
        .select(
          `
          id,
          nombre_referente,
          estado,
          proveedor_id,
          profiles:proveedor_id (nombre, apellido)
        `,
        )
        .eq("token", token)
        .maybeSingle();

      if (fetchError || !data) {
        setError("Enlace de referencia no válido o expirado.");
        setLoading(false);
        return;
      }

      if (data.estado === "completada") {
        setSuccess(true);
        const p = data.profiles;
        setProveedorNombre(
          [p?.nombre, p?.apellido].filter(Boolean).join(" ") || "el proveedor",
        );
        setLoading(false);
        return;
      }

      setReferencia(data);
      const p = data.profiles;
      setProveedorNombre(
        [p?.nombre, p?.apellido].filter(Boolean).join(" ") || "el proveedor",
      );
      setLoading(false);
    }

    if (token) load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!conoceDesde) {
      setError("Indica cuánto tiempo conoces a esta persona.");
      return;
    }
    if (recomendaria === null) {
      setError("Indica si recomendarías sus servicios.");
      return;
    }

    setSubmitting(true);
    setError("");

    const { error: updateError } = await supabase
      .from("referencias")
      .update({
        conoce_desde: conoceDesde,
        recomendaria,
        comentario: comentario.trim() || null,
        estado: "completada",
      })
      .eq("token", token)
      .eq("estado", "pendiente");

    setSubmitting(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
  }

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-[#666]">
          Cargando…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        {success ? (
          <div
            className="rounded-2xl border bg-white p-8 text-center"
            style={{ borderColor: BRAND.border }}
          >
            <p className="text-4xl">✓</p>
            <p className="mt-4 text-lg font-semibold text-green-700">
              ¡Gracias! Tu aval ayudará a {proveedorNombre} a generar confianza.
            </p>
          </div>
        ) : error && !referencia ? (
          <div
            className="rounded-2xl border bg-white p-8 text-center"
            style={{ borderColor: BRAND.border }}
          >
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : (
          <div
            className="rounded-2xl border bg-white p-6 sm:p-8"
            style={{ borderColor: BRAND.border }}
          >
            <h1
              className="text-xl font-semibold text-[#1a1a1a]"
              style={{ fontFamily: SERIF }}
            >
              Aval para {proveedorNombre}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              Hola {referencia?.nombre_referente}, {proveedorNombre} te ha pedido
              que compartas tu experiencia como referencia en Home&Heart.
            </p>

            {error && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="conoce-desde"
                  className="mb-1.5 block text-xs font-medium text-[#444]"
                >
                  ¿Cuánto tiempo conoces a {proveedorNombre.split(" ")[0]}?
                </label>
                <select
                  id="conoce-desde"
                  required
                  value={conoceDesde}
                  onChange={(e) => setConoceDesde(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: BRAND.border }}
                >
                  <option value="">Selecciona…</option>
                  {CONOCE_DESDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#444]">
                  ¿Recomendarías sus servicios?
                </p>
                <div className="flex gap-3">
                  {[
                    { value: true, label: "Sí" },
                    { value: false, label: "No" },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setRecomendaria(opt.value)}
                      className="flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors"
                      style={{
                        borderColor:
                          recomendaria === opt.value
                            ? BRAND.primary
                            : BRAND.border,
                        backgroundColor:
                          recomendaria === opt.value ? BRAND.light : "#fff",
                        color:
                          recomendaria === opt.value ? BRAND.primary : "#666",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="comentario"
                  className="mb-1.5 block text-xs font-medium text-[#444]"
                >
                  Comentario libre
                </label>
                <textarea
                  id="comentario"
                  rows={4}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder="Cuéntanos tu experiencia con esta persona…"
                  className={`${inputClass} resize-y`}
                  style={{ borderColor: BRAND.border }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}
              >
                {submitting ? "Enviando…" : "Enviar mi aval"}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
