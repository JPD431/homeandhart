"use client";

import { LangProvider } from "@/app/lib/LangContext";
import { ModoProvider } from "@/app/lib/ModoContext";
import SkipLink from "@/app/components/SkipLink";

export default function AppProviders({ lang, children }) {
  return (
    <LangProvider lang={lang}>
      <SkipLink />
      <ModoProvider>{children}</ModoProvider>
    </LangProvider>
  );
}
