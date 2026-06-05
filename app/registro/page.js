"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { BRAND } from "@/app/components/brand";

const ROLES = [
  {
    id: "cliente",
    title: "Soy cliente",
    subtitle: "busco servicios",
  },
  {
    id: "proveedor",
    title: "Soy proveedor",
    subtitle: "ofrezco servicios",
  },
];

export default function RegistroPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("cliente");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email_contacto: email,
        role,
      });
    }

    setLoading(false);

    router.push("/completar-perfil");
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

        <h1 className="text-2xl font-bold text-[#1a1a1a]">Crear cuenta</h1>

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
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Confirmar contraseña
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-[#444]">
              ¿Cómo usarás Home&Heart?
            </legend>
            <div className="flex flex-col gap-3">
              {ROLES.map((option) => {
                const isSelected = role === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRole(option.id)}
                    className="rounded-xl border p-4 text-left transition-colors"
                    style={{
                      borderColor: isSelected ? BRAND.primary : BRAND.border,
                      backgroundColor: isSelected ? BRAND.light : "#fff",
                    }}
                  >
                    <span
                      className="block text-sm font-semibold"
                      style={{ color: isSelected ? BRAND.primary : "#1a1a1a" }}
                    >
                      {option.title} — {option.subtitle}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terminos"
              required
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-1 cursor-pointer"
            />
            <label htmlFor="terminos" className="text-sm text-[#444]">
              He leído y acepto los{" "}
              <a
                href="/legal/terminos"
                target="_blank"
                className="text-[#1d4f91] underline"
              >
                Términos de uso
              </a>{" "}
              y la{" "}
              <a
                href="/legal/privacidad"
                target="_blank"
                className="text-[#1d4f91] underline"
              >
                Política de privacidad
              </a>{" "}
              de Home&Heart
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !aceptaTerminos}
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-100"
            style={{
              backgroundColor:
                loading || !aceptaTerminos ? "#9ca3af" : BRAND.primary,
            }}
          >
            {loading ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#666]">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium no-underline hover:underline"
            style={{ color: BRAND.primary }}
          >
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
