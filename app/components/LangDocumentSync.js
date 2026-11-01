"use client";

import { useEffect } from "react";
import { useLang } from "@/app/lib/LangContext";
import { translateTitle } from "@/app/lib/page-titles";

/**
 * Sincroniza <html lang> y el <title> con el idioma elegido. Next reescribe el
 * <title> (en español) en cada navegación, así que se observa el <head>.
 */
export default function LangDocumentSync() {
  const { lang } = useLang();

  useEffect(() => {
    document.documentElement.lang = lang;

    function syncTitle() {
      const translated = translateTitle(document.title, lang);
      if (translated !== document.title) document.title = translated;
    }

    syncTitle();
    const observer = new MutationObserver(syncTitle);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [lang]);

  return null;
}
