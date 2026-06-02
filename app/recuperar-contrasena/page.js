"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/app/components/brand";

function Logo() {
  return (
    <Link
      href="/"
      className="mb-6 inline-block text-xl font-semibold tracking-tight text-[#1a1a1a] no-underline"
    >
      Home<span className="italic text-[#1d4f91]">&</span>Heart
    </Link>
  );
}

export default function RecuperarContrasenaPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/nueva-contrasena` },
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    setSuccess(true);
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12 font-sans"
      style={{ backgroundColor: BRAND.warm }}
    >
      <div
        className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm sm:p-10"
        style={{ borderColor: BRAND.border }}
      >
        <Logo />

        <h1 className="text-2xl font-bold text-[#1a1a1a]">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-[#666]">
          Te enviaremos un email para restablecer tu contraseña
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          {success && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              ¡Email enviado! Revisa tu bandeja de entrada.
            </p>
          )}

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: BRAND.primary }}
          >
            {loading ? "Enviando…" : "Enviar instrucciones"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#666]">
          <Link
            href="/login"
            className="font-medium no-underline hover:underline"
            style={{ color: BRAND.primary }}
          >
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
