"use client";

import { createContext, useContext, useEffect, useState } from "react";

const LangContext = createContext({ lang: "es", setLang: () => {} });

export function LangProvider({ children }) {
  const [lang, setLang] = useState("es");

  useEffect(() => {
    const saved = localStorage.getItem("lang");
    if (saved) {
      setLang(saved);
      document.cookie = `lang=${saved};path=/;max-age=31536000;SameSite=Lax`;
    }
  }, []);

  const changeLang = (newLang) => {
    setLang(newLang);
    localStorage.setItem("lang", newLang);
    document.cookie = `lang=${newLang};path=/;max-age=31536000;SameSite=Lax`;
  };

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
