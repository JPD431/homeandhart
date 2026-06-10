"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
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

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
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

        <h1 className="text-2xl font-bold text-[#1a1a1a]">Nueva contraseña</h1>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          {success && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              Contraseña actualizada correctamente. Redirigiendo…
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
            {loading ? "Guardando…" : "Guardar nueva contraseña"}
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
