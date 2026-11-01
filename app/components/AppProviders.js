"use client";

import { LangProvider } from "@/app/lib/LangContext";
import { ModoProvider } from "@/app/lib/ModoContext";
import LangDocumentSync from "@/app/components/LangDocumentSync";

export default function AppProviders({ children }) {
  return (
    <LangProvider>
      <LangDocumentSync />
      <ModoProvider>{children}</ModoProvider>
    </LangProvider>
  );
}
