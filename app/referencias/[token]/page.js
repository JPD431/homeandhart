"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { CONOCE_DESDE_OPTIONS } from "@/app/lib/referencias";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const inputClass =
  "w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

export default function ReferenciaPublicPage() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const tr = t.referencias;
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
      const res = await fetch(
        `/api/referencias/responder?token=${encodeURIComponent(token)}`,
      );
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.nombre_referente) {
        setError(
          data.error || tr.errEnlace,
        );
        setLoading(false);
        return;
      }

      setProveedorNombre(data.proveedor_nombre || "el proveedor");

      if (data.estado === "completada") {
        setSuccess(true);
        setLoading(false);
        return;
      }

      setReferencia({ nombre_referente: data.nombre_referente });
      setLoading(false);
    }

    if (token) load();
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!conoceDesde) {
      setError(tr.errTiempo);
      return;
    }
    if (recomendaria === null) {
      setError(tr.errRecomendacion);
      return;
    }

    setSubmitting(true);
    setError("");

    const res = await fetch("/api/referencias/responder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        conoce_desde: conoceDesde,
        recomendaria,
        comentario,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setSubmitting(false);

    if (res.status === 409) {
      setSuccess(true);
      return;
    }

    if (!res.ok || !data.ok) {
      setError(data.error || tr.errEnviar);
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
          {tr.cargando}
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
              {tr.gracias(proveedorNombre)}
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
              {tr.avalPara(proveedorNombre)}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              {tr.intro(referencia?.nombre_referente, proveedorNombre)}
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
                  {tr.cuantoTiempo(proveedorNombre.split(" ")[0])}
                </label>
                <select
                  id="conoce-desde"
                  required
                  value={conoceDesde}
                  onChange={(e) => setConoceDesde(e.target.value)}
                  className={inputClass}
                  style={{ borderColor: BRAND.border }}
                >
                  <option value="">{tr.selecciona}</option>
                  {CONOCE_DESDE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#444]">
                  {tr.recomendarias}
                </p>
                <div className="flex gap-3">
                  {[
                    { value: true, label: tr.si },
                    { value: false, label: tr.no },
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
                  {tr.comentarioLabel}
                </label>
                <textarea
                  id="comentario"
                  rows={4}
                  value={comentario}
                  onChange={(e) => setComentario(e.target.value)}
                  placeholder={tr.comentarioPlaceholder}
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
                {submitting ? tr.enviando : tr.enviarAval}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
