"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import { BRAND, SERIF } from "@/app/components/brand";

const NEEDS_OPTIONS = [
  {
    id: "alojamiento",
    title: "Alojamiento verificado",
    subtitle: "Pisos y casas para tu estancia",
    Icon: HomeIcon,
  },
  {
    id: "ninera",
    title: "Niñera o cuidador infantil",
    subtitle: "En tu ciudad o mientras viajas",
    Icon: PersonIcon,
  },
  {
    id: "mascotas",
    title: "Cuidador de mascotas",
    subtitle: "Para cuando viajas o necesitas ayuda",
    Icon: PetIcon,
  },
];

function HomeIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
      />
    </svg>
  );
}

function PersonIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
      />
    </svg>
  );
}

function PetIcon({ className }) {
  return (
    <svg
      className={className}
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
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

function ProgressDots({ step }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {[0, 1, 2, 3].map((index) => {
        const isActive = step === index;
        const isCompleted = step > index;
        return (
          <span
            key={index}
            className="h-2 rounded-full transition-all duration-300"
            style={{
              width: isActive ? "28px" : "8px",
              backgroundColor: isActive || isCompleted ? BRAND.primary : "#d4d0ca",
            }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

function CheckCircle({ selected }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
      style={{
        borderColor: selected ? BRAND.primary : BRAND.border,
        backgroundColor: selected ? BRAND.primary : "transparent",
      }}
    >
      {selected && (
        <svg
          className="h-3.5 w-3.5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={3}
          stroke="currentColor"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m4.5 12.75 6 6 9-7.5"
          />
        </svg>
      )}
    </span>
  );
}

export default function CompletarPerfilPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [selectedNeeds, setSelectedNeeds] = useState([]);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleNeed(id) {
    setSelectedNeeds((prev) =>
      prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id],
    );
  }

  const canContinueStep0 = selectedNeeds.length > 0;
  const canContinueStep1 =
    nombre.trim().length > 0 && apellido.trim().length > 0;
  const canContinueStep2 = ciudad.trim().length > 0;

  const canContinue =
    (step === 0 && canContinueStep0) ||
    (step === 1 && canContinueStep1) ||
    (step === 2 && canContinueStep2);

  async function handleContinue() {
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }

    if (step === 2) {
      setError("");
      setSaving(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setSaving(false);
        setError("Debes iniciar sesión para guardar tu perfil.");
        return;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user.id,
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        ciudad: ciudad.trim(),
        necesidades: selectedNeeds,
      });

      setSaving(false);

      if (profileError) {
        setError(profileError.message);
        return;
      }

      setStep(3);
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10 font-sans"
      style={{ backgroundColor: BRAND.warm }}
    >
      <div
        className="flex w-full flex-col overflow-hidden border bg-white shadow-sm"
        style={{
          maxWidth: "540px",
          borderRadius: "16px",
          borderColor: BRAND.border,
        }}
      >
        {/* Header */}
        <div className="border-b px-6 pt-6 pb-5" style={{ borderColor: BRAND.border }}>
          <Link
            href="/"
            className="block text-center text-xl font-semibold tracking-tight text-[#1a1a1a] no-underline"
          >
            Home<span className="italic text-[#1d4f91]">&</span>Heart
          </Link>
          <div className="mt-5">
            <ProgressDots step={step} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 px-6 py-6">
          {step === 0 && (
            <div>
              <h1
                className="text-2xl leading-snug text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                ¿Qué necesitas de Home&Heart?
              </h1>
              <p className="mt-2 text-sm text-[#666]">
                Selecciona todo lo que te interese.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {NEEDS_OPTIONS.map((option) => {
                  const selected = selectedNeeds.includes(option.id);
                  const { Icon } = option;
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        onClick={() => toggleNeed(option.id)}
                        className="flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors"
                        style={{
                          borderColor: selected ? BRAND.primary : BRAND.border,
                          backgroundColor: selected ? BRAND.light : "#fff",
                        }}
                      >
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                          style={{
                            backgroundColor: selected ? "#fff" : BRAND.light,
                            color: BRAND.primary,
                          }}
                        >
                          <Icon className="h-6 w-6" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#1a1a1a]">
                            {option.title}
                          </p>
                          <p className="mt-0.5 text-xs text-[#666]">
                            {option.subtitle}
                          </p>
                        </div>
                        <CheckCircle selected={selected} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div>
              <h1
                className="text-2xl leading-snug text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                ¿Cómo te llamamos?
              </h1>
              <p className="mt-2 text-sm text-[#666]">
                Solo tu nombre para personalizar la experiencia.
              </p>
              <div className="mt-6 flex flex-col gap-4">
                <div>
                  <label htmlFor="nombre" className="sr-only">
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    type="text"
                    autoComplete="given-name"
                    placeholder="Nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="w-full rounded-xl border px-4 py-4 text-base text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
                <div>
                  <label htmlFor="apellido" className="sr-only">
                    Apellido
                  </label>
                  <input
                    id="apellido"
                    type="text"
                    autoComplete="family-name"
                    placeholder="Apellido"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    className="w-full rounded-xl border px-4 py-4 text-base text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                    style={{ borderColor: BRAND.border }}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h1
                className="text-2xl leading-snug text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                ¿En qué ciudad estás?
              </h1>
              <p className="mt-2 text-sm text-[#666]">
                Para mostrarte proveedores cerca de ti.
              </p>
              <div className="mt-6">
                <label htmlFor="ciudad" className="sr-only">
                  Ciudad
                </label>
                <input
                  id="ciudad"
                  type="text"
                  autoComplete="address-level2"
                  placeholder="Madrid, Barcelona..."
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className="w-full rounded-xl border px-4 py-4 text-base text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                  style={{ borderColor: BRAND.border }}
                />
              </div>
              {error && (
                <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div
              className="-mx-6 -my-6 flex flex-col items-center px-6 py-10 text-center"
              style={{ backgroundColor: BRAND.light }}
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[#1d4f91]"
                style={{ backgroundColor: "#fff" }}
              >
                <HomeIcon className="h-8 w-8" />
              </span>
              <h1
                className="mt-6 text-2xl text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                ¡Todo listo, bienvenida!
              </h1>
              <p
                className="mt-2 text-lg italic"
                style={{ color: BRAND.primary }}
              >
                Donde estés, estamos.
              </p>
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-[#5c5c5c]">
                Tu cuenta está lista. Empieza a explorar proveedores
                verificados.
              </p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="mt-8 w-full max-w-xs rounded-xl py-3.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}
              >
                Ir al inicio
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && (
          <div
            className="flex items-center justify-between border-t px-6 py-4"
            style={{ borderColor: BRAND.border }}
          >
            {step > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-sm font-medium text-[#666] transition-colors hover:text-[#1d4f91]"
              >
                ← Atrás
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={handleContinue}
              disabled={!canContinue || saving}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: BRAND.primary }}
            >
              {saving ? "Guardando…" : "Continuar →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
