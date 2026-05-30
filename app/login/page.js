"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/app/components/brand";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
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
        <Link
          href="/"
          className="mb-6 inline-block text-xl font-semibold tracking-tight text-[#1a1a1a] no-underline"
        >
          Home<span className="italic text-[#1d4f91]">&</span>Heart
        </Link>

        <h1 className="text-2xl font-bold text-[#1a1a1a]">Iniciar sesión</h1>

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

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: BRAND.primary }}
          >
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#666]">
          ¿No tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-medium no-underline hover:underline"
            style={{ color: BRAND.primary }}
          >
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
