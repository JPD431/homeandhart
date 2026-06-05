"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { BRAND } from "./brand";
import { supabase } from "@/lib/supabase";

function Logo() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tracking-tight sm:text-2xl">
        <span style={{ color: "#111111" }}>Home</span>
        <span style={{ color: "#1d4f91", fontStyle: "italic" }}>&#38;</span>
        <span style={{ color: "#111111" }}>Heart</span>
      </span>
      <span className="mt-0.5 text-xs text-[#5c5c5c] sm:text-sm">
        {t.footer.slogan}
      </span>
    </div>
  );
}

function ChatIcon({ className }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
      />
    </svg>
  );
}

function LangSwitcher() {
  const { lang, setLang } = useLang();

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border p-0.5"
      style={{ borderColor: BRAND.border }}
      role="group"
      aria-label="Idioma"
    >
      {["es", "en"].map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          className="rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors"
          style={{
            color: lang === code ? BRAND.primary : "#888",
          }}
          aria-pressed={lang === code}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

export default function Navbar() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnread() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setUnreadCount(0);
        return;
      }

      const { data: conversations } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `participant_a_id.eq.${user.id},participant_b_id.eq.${user.id}`,
        );

      const conversationIds = (conversations ?? []).map((c) => c.id);
      if (conversationIds.length === 0) {
        setUnreadCount(0);
        return;
      }

      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", conversationIds)
        .eq("read", false)
        .neq("sender_id", user.id);

      setUnreadCount(count ?? 0);
    }

    loadUnread();

    const channel = supabase
      .channel("navbar-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          loadUnread();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md"
      style={{ borderColor: BRAND.border }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 no-underline">
          <Logo />
        </Link>
        <nav
          className="hidden items-center gap-8 text-sm font-medium text-[#444] md:flex"
          aria-label="Principal"
        >
          <Link
            href="/"
            className="transition-colors hover:text-[#1d4f91] no-underline"
            style={{ color: BRAND.primary }}
          >
            {t.navbar.inicio}
          </Link>
          <Link
            href="/buscar"
            className="transition-colors hover:text-[#1d4f91] no-underline"
          >
            {t.navbar.servicios}
          </Link>
          <Link
            href="/garantia"
            className="transition-colors hover:text-[#1d4f91] no-underline"
          >
            {t.navbar.garantia}
          </Link>
          <Link
            href="/#como-funciona"
            className="transition-colors hover:text-[#1d4f91] no-underline"
          >
            {t.navbar.comoFunciona}
          </Link>
          <Link
            href="/ser-proveedor"
            className="transition-colors hover:text-[#1d4f91] no-underline"
          >
            {t.navbar.serProveedor}
          </Link>
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitcher />
          <Link
            href="/chat"
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-[#444] no-underline transition-colors hover:bg-[#f7f5f2]"
            aria-label="Mensajes"
          >
            <ChatIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href="/login"
            className="hidden rounded-lg px-4 py-2 text-sm font-medium text-[#444] no-underline transition-colors hover:bg-[#f7f5f2] sm:inline-block"
          >
            {t.navbar.iniciarSesion}
          </Link>
          <Link
            href="/registro"
            className="rounded-lg px-4 py-2 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND.primary }}
          >
            {t.navbar.registrarse}
          </Link>
        </div>
      </div>
    </header>
  );
}
