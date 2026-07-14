"use client";

import { LangProvider } from "@/app/lib/LangContext";
import { ModoProvider } from "@/app/lib/ModoContext";

export default function AppProviders({ children }) {
  return (
    <LangProvider>
      <ModoProvider>{children}</ModoProvider>
    </LangProvider>
  );
}
