"use client";

import { createContext, useContext } from "react";
import { usePathname, useRouter } from "next/navigation";
import { switchLocalePath } from "@/app/lib/locale";

const LangContext = createContext({ lang: "es", setLang: () => {} });

/**
 * El idioma viene de la URL (segmento [lang]) y se renderiza ya en el servidor.
 * setLang navega a la URL equivalente y guarda la preferencia en una cookie
 * (el proxy la usa solo para redirigir visitas sin prefijo; los rastreadores no la envían).
 */
export function LangProvider({ lang, children }) {
  const router = useRouter();
  const pathname = usePathname();

  const setLang = (newLang) => {
    if (newLang === lang) return;
    document.cookie = `lang=${newLang};path=/;max-age=31536000;SameSite=Lax`;
    const target = switchLocalePath(pathname ?? "/", newLang);
    router.push(`${target}${window.location.search}${window.location.hash}`);
  };

  return (
    <LangContext.Provider value={{ lang, setLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
