"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND } from "./brand";

export default function ActivityBar() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const [index, setIndex] = useState(0);

  const messages = useMemo(
    () => [
      t.activityBar.texto,
      "Carlos reservó alojamiento pet-friendly en Barcelona",
      "Lucía dejó una valoración 5★ a su cuidador de mascotas",
      "8 familias están buscando servicios en tu zona ahora",
    ],
    [t.activityBar.texto],
  );

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((current) => (current + 1) % messages.length);
    }, 4000);
    return () => clearInterval(id);
  }, [messages.length]);

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
          {messages[index]}
        </span>
      </p>
    </div>
  );
}
