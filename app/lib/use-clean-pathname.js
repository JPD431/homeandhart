"use client";

import { usePathname } from "next/navigation";
import { stripLocale } from "@/app/lib/locale";

/** usePathname() sin el prefijo de idioma (/en/buscar -> /buscar). */
export function useCleanPathname() {
  return stripLocale(usePathname() ?? "/").path;
}
