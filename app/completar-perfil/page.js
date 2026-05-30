"use client";

import Link from "next/link";
import { useState } from "react";
import { BRAND } from "@/app/components/brand";

export default function CompletarPerfilPage() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    alert("Perfil guardado");
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

        <h1 className="text-2xl font-bold text-[#1a1a1a]">Completa tu perfil</h1>
        <p className="mt-2 text-sm text-[#666]">
          Cuéntanos un poco sobre ti para personalizar tu experiencia.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label
              htmlFor="nombre"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              required
              autoComplete="given-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div>
            <label
              htmlFor="apellido"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Apellido
            </label>
            <input
              id="apellido"
              type="text"
              required
              autoComplete="family-name"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div>
            <label
              htmlFor="telefono"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Teléfono
            </label>
            <input
              id="telefono"
              type="tel"
              required
              autoComplete="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <div>
            <label
              htmlFor="ciudad"
              className="mb-1.5 block text-sm font-medium text-[#444]"
            >
              Ciudad
            </label>
            <input
              id="ciudad"
              type="text"
              required
              autoComplete="address-level2"
              value={ciudad}
              onChange={(e) => setCiudad(e.target.value)}
              className="w-full rounded-xl border px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
              style={{ borderColor: BRAND.border }}
            />
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND.primary }}
          >
            Guardar perfil
          </button>
        </form>
      </div>
    </div>
  );
}
