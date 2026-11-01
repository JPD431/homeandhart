"use client";

import NextLink from "next/link";
import { useLang } from "@/app/lib/LangContext";
import { localizeHref } from "@/app/lib/locale";

/** next/link que mantiene el idioma activo en las rutas internas (/en/...). */
export default function Link({ href, ...props }) {
  const { lang } = useLang();
  return <NextLink href={localizeHref(href, lang)} {...props} />;
}
