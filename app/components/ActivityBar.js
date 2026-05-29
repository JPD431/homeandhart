"use client";

import { useEffect, useState } from "react";
import { BRAND } from "./brand";

const MESSAGES = [
  "María acaba de reservar cuidado de niños en Madrid",
  "Carlos reservó alojamiento pet-friendly en Barcelona",
  "Lucía dejó una valoración 5★ a su cuidador de mascotas",
  "8 familias están buscando servicios en tu zona ahora",
];

export default function ActivityBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % MESSAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="border-b py-2.5 text-center text-xs sm:text-sm"
      style={{
        borderColor: BRAND.border,
        backgroundColor: BRAND.light,
        color: BRAND.primary,
      }}
      aria-live="polite"
    >
      <p className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <span className="inline-flex items-center justify-center gap-2">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
            aria-hidden
          />
          {MESSAGES[index]}
        </span>
      </p>
    </div>
  );
}
