"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { getBookingEstado } from "@/app/lib/viajes";
import { BRAND } from "./brand";
import { needsProviderOnboarding } from "@/app/lib/onboarding";
import {
  DNI_BANNER_CLIENT_MSG,
  DNI_BANNER_PROVIDER_MSG,
  DNI_SUBIR_RUTA,
  hasDniUploaded,
} from "@/app/lib/dni";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

function Logo() {
  const { lang } = useLang();
  const t = useTranslation(lang);

  return (
    <div className="flex flex-col">
      <span className="text-xl font-semibold tracking-tight sm:text-2xl">
        <span style={{ color: "#111111" }}>Home</span>
        <span style={{ color: PRIMARY, fontStyle: "italic" }}>&#38;</span>
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
          className="min-h-[44px] min-w-[44px] rounded-md px-3 text-xs font-semibold uppercase transition-colors"
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

function calcPorcentajePerfil(perfil, servicesCount) {
  let pct = 0;
  if (perfil?.nombre?.trim()) pct += 20;
  if (perfil?.foto_perfil || perfil?.avatar_url) pct += 20;
  if (perfil?.descripcion?.trim()) pct += 20;
  if (Array.isArray(perfil?.idiomas) && perfil.idiomas.length > 0) pct += 20;
  if (servicesCount >= 1) pct += 20;
  return pct;
}

function getRolLabel(isProveedor) {
  return isProveedor ? "Ambos" : "Cliente";
}

function DropdownItem({ href, icon, label, badge, badgeStyle, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex min-h-[44px] items-center justify-between gap-2 px-4 py-3 text-sm text-[#2a3a4a] no-underline transition-colors hover:bg-[#f7f5f2]"
    >
      <span className="flex items-center gap-2.5">
        <span aria-hidden>{icon}</span>
        <span>{label}</span>
      </span>
      {badge != null && badge !== "" && (
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={badgeStyle}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ children }) {
  return (
    <p
      className="px-4 pb-1 pt-3 text-[8px] font-semibold uppercase tracking-widest"
      style={{ color: "#bbb" }}
    >
      {children}
    </p>
  );
}

function getReservasSinComisionCliente(perfil) {
  return Number(perfil?.reservas_sin_comision_cliente) || 0;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { lang } = useLang();
  const t = useTranslation(lang);

  const dropdownRef = useRef(null);

  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [servicesCount, setServicesCount] = useState(0);
  const [reservasActivas, setReservasActivas] = useState(0);
  const [mensajesSinLeer, setMensajesSinLeer] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [vistaModo, setVistaModo] = useState("cliente");
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isProveedor = perfil?.role === "proveedor";
  const onboardingIncompleto = needsProviderOnboarding(perfil);
  const porcentajePerfil = calcPorcentajePerfil(perfil, servicesCount);
  const sinComision = getReservasSinComisionCliente(perfil);

  const closeDropdown = useCallback(() => setDropdownOpen(false), []);
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const navLinks = useMemo(() => {
    const base = [
      { href: "/", label: t.navbar.inicio, primary: true },
      { href: "/buscar", label: t.navbar.servicios },
      { href: "/blog", label: "Blog" },
      { href: "/garantia", label: t.navbar.garantia },
      { href: "/#como-funciona", label: t.navbar.comoFunciona },
      {
        href: "/ser-proveedor",
        label:
          user && isProveedor && onboardingIncompleto
            ? "Continuar registro"
            : t.navbar.serProveedor,
        primary: !!(user && isProveedor && onboardingIncompleto),
      },
    ];
    return base;
  }, [t, user, isProveedor, onboardingIncompleto]);

  const loadMensajesSinLeer = useCallback(async (userId) => {
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id")
      .or(`participant_a_id.eq.${userId},participant_b_id.eq.${userId}`);

    const conversationIds = (conversations ?? []).map((c) => c.id);
    if (conversationIds.length === 0) {
      setMensajesSinLeer(0);
      return;
    }

    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", conversationIds)
      .eq("read", false)
      .neq("sender_id", userId);

    setMensajesSinLeer(count ?? 0);
  }, []);

  const loadUserData = useCallback(
    async (authUser) => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select(
          "nombre, apellido, role, descripcion, idiomas, foto_perfil, reservas_sin_comision_cliente, onboarding_completed_at, doc_dni_url",
        )
        .eq("id", authUser.id)
        .single();

      setPerfil(profileData);

      const { count: svcCount } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("proveedor_id", authUser.id);

      setServicesCount(svcCount ?? 0);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("estado")
        .eq("cliente_id", authUser.id);

      const activas = (bookings ?? []).filter((b) =>
        ["confirmada", "pendiente", "en_curso"].includes(getBookingEstado(b)),
      ).length;
      setReservasActivas(activas);

      await loadMensajesSinLeer(authUser.id);
    },
    [loadMensajesSinLeer],
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
      if (authUser) await loadUserData(authUser);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        loadUserData(authUser);
      } else {
        setPerfil(null);
        setServicesCount(0);
        setReservasActivas(0);
        setMensajesSinLeer(0);
        setDropdownOpen(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("navbar-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => loadMensajesSinLeer(user.id),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadMensajesSinLeer]);

  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    setSigningOut(false);
    setDropdownOpen(false);
    router.push("/");
  }

  const displayName =
    [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ") ||
    perfil?.nombre ||
    "Mi cuenta";
  const initials = perfil?.nombre?.[0]?.toUpperCase() || "U";
  const showDniBanner = user && perfil && !hasDniUploaded(perfil);
  const dniBannerText =
    perfil?.role === "proveedor"
      ? DNI_BANNER_PROVIDER_MSG
      : DNI_BANNER_CLIENT_MSG;
  const dniBannerHref = `${DNI_SUBIR_RUTA}?next=${encodeURIComponent(pathname || "/")}`;

  return (
    <>
    <header
      className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur-md"
      style={{ borderColor: BRAND.border }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0 no-underline">
          <Logo />
        </Link>

        {/* MÓVIL */}
        <div className="flex items-center gap-2 md:hidden">
          {!user && (
            <Link href="/registro" className="no-underline">
              <button
                type="button"
                style={{
                  background: "#1d4f91",
                  color: "#fff",
                  border: "none",
                  padding: "8px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  minHeight: 44,
                }}
              >
                {t.navbar.registrarse}
              </button>
            </Link>
          )}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#1d4f91",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#fff",
                  fontWeight: 500,
                }}
              >
                {initials}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menú"
            aria-expanded={mobileMenuOpen}
            style={{
              minHeight: 44,
              minWidth: 44,
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
            }}
          >
            ☰
          </button>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <nav
            className="flex items-center gap-8 text-sm font-medium text-[#444]"
            aria-label="Principal"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="no-underline transition-colors hover:text-[#1d4f91]"
                style={link.primary ? { color: BRAND.primary } : undefined}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <LangSwitcher />

          {user ? (
            <>
              <Link
                href="/chat"
                onClick={closeDropdown}
                className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full no-underline"
                style={{
                  background: "#fff",
                  border: `0.5px solid ${BORDER}`,
                }}
                aria-label="Notificaciones"
              >
                🔔
                {mensajesSinLeer > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      background: "#dc2626",
                      color: "#fff",
                      fontSize: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 500,
                    }}
                  >
                    {mensajesSinLeer > 9 ? "9+" : mensajesSinLeer}
                  </div>
                )}
              </Link>

              <div ref={dropdownRef} style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setDropdownOpen((o) => !o)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDropdownOpen((o) => !o);
                    }
                  }}
                  className="relative flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border px-3"
                  style={{
                    borderColor: BORDER,
                    background: "#fff",
                  }}
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                >
                  <div style={{ position: "relative" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: PRIMARY,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        fontWeight: 500,
                        color: "#fff",
                      }}
                    >
                      {initials}
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        right: 0,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#0e7a5c",
                        border: "1.5px solid #fff",
                      }}
                    />
                  </div>
                  <span className="hidden max-w-[100px] truncate text-xs font-medium text-[#2a3a4a] sm:inline">
                    {perfil?.nombre || "Mi cuenta"}
                  </span>
                  <span style={{ fontSize: 10, color: "#bbb" }}>▾</span>
                </div>

                {dropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: 0,
                      width: 260,
                      background: "#fff",
                      borderRadius: 12,
                      border: `0.5px solid ${BORDER}`,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
                      overflow: "hidden",
                      zIndex: 100,
                    }}
                  >
                    {/* Header */}
                    <div
                      className="flex items-center gap-3 px-4 py-4"
                      style={{ borderBottom: `0.5px solid #f0ede8` }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: PRIMARY,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                          {displayName}
                        </p>
                        <p className="truncate text-[11px] text-[#888]">
                          {user.email}
                        </p>
                        <span
                          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: isProveedor ? "#e6f4f0" : "#e8f0fb",
                            color: isProveedor ? "#0e7a5c" : PRIMARY,
                          }}
                        >
                          {getRolLabel(isProveedor)}
                        </span>
                      </div>
                    </div>

                    {/* Progreso perfil */}
                    <div
                      style={{
                        padding: "10px 16px",
                        borderBottom: "0.5px solid #f0ede8",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 9,
                          color: "#bbb",
                          marginBottom: 4,
                        }}
                      >
                        <span>Perfil completado</span>
                        <span>{porcentajePerfil}%</span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          background: "#f7f5f2",
                          borderRadius: 2,
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            background: PRIMARY,
                            borderRadius: 2,
                            width: `${porcentajePerfil}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Toggle cliente/proveedor */}
                    {isProveedor && (
                      <div
                        className="flex gap-1 p-2"
                        style={{
                          borderBottom: "0.5px solid #f0ede8",
                          background: "#f7f5f2",
                        }}
                      >
                        {["cliente", "proveedor"].map((modo) => (
                          <button
                            key={modo}
                            type="button"
                            onClick={() => setVistaModo(modo)}
                            className="min-h-[44px] flex-1 rounded-lg py-2 text-xs font-semibold capitalize transition-colors"
                            style={{
                              background:
                                vistaModo === modo ? "#fff" : "transparent",
                              color: vistaModo === modo ? PRIMARY : "#888",
                              boxShadow:
                                vistaModo === modo
                                  ? "0 1px 4px rgba(0,0,0,0.08)"
                                  : "none",
                              border: "none",
                              cursor: "pointer",
                            }}
                          >
                            {modo}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Como cliente */}
                    {(!isProveedor || vistaModo === "cliente") && (
                      <div style={{ borderBottom: "0.5px solid #f0ede8" }}>
                        <SectionLabel>Como cliente</SectionLabel>
                        <DropdownItem
                          href="/dashboard"
                          icon="📅"
                          label="Mis reservas"
                          badge={
                            reservasActivas > 0
                              ? `${reservasActivas} activas`
                              : null
                          }
                          badgeStyle={{
                            backgroundColor: "#e8f0fb",
                            color: PRIMARY,
                          }}
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/dashboard"
                          icon="❤️"
                          label="Mis favoritos"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/historial"
                          icon="🧾"
                          label="Historial y facturas"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/dashboard"
                          icon="✈️"
                          label="Mis viajes"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/familia"
                          icon="👨‍👩‍👧"
                          label="Mi familia"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/pasaporte"
                          icon="🛂"
                          label="Mi pasaporte"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/dashboard"
                          icon="🎁"
                          label="Referidos"
                          badge={
                            sinComision > 0 ? `${sinComision} sin comisión` : null
                          }
                          badgeStyle={{
                            backgroundColor: "#e6f4f0",
                            color: "#0e7a5c",
                          }}
                          onNavigate={closeDropdown}
                        />
                      </div>
                    )}

                    {/* Como proveedor */}
                    {isProveedor && vistaModo === "proveedor" && (
                      <div style={{ borderBottom: "0.5px solid #f0ede8" }}>
                        <SectionLabel>Como proveedor</SectionLabel>
                        <DropdownItem
                          href="/estadisticas"
                          icon="📊"
                          label="Estadísticas"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/editar-perfil?tab=servicios"
                          icon="✏️"
                          label="Editar mis servicios"
                          onNavigate={closeDropdown}
                        />
                        <DropdownItem
                          href="/chat"
                          icon="💬"
                          label="Mis mensajes"
                          badge={
                            mensajesSinLeer > 0
                              ? String(mensajesSinLeer)
                              : null
                          }
                          badgeStyle={{
                            backgroundColor: "#fdf3e3",
                            color: "#c47d1a",
                          }}
                          onNavigate={closeDropdown}
                        />
                      </div>
                    )}

                    {/* Cuenta */}
                    <div style={{ borderBottom: "0.5px solid #f0ede8" }}>
                      <SectionLabel>Cuenta</SectionLabel>
                      <DropdownItem
                        href="/editar-perfil"
                        icon="👤"
                        label="Mi perfil"
                        onNavigate={closeDropdown}
                      />
                      <DropdownItem
                        href="/recuperar-contrasena"
                        icon="🔒"
                        label="Cambiar contraseña"
                        onNavigate={closeDropdown}
                      />
                    </div>

                    {/* Cerrar sesión */}
                    <div className="p-3">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        disabled={signingOut}
                        className="min-h-[44px] w-full rounded-lg border py-3 text-sm font-medium transition-colors disabled:opacity-60"
                        style={{
                          borderColor: BORDER,
                          background: "#fff",
                          color: "#666",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = "#dc2626";
                          e.currentTarget.style.color = "#dc2626";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = BORDER;
                          e.currentTarget.style.color = "#666";
                        }}
                      >
                        {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/chat"
                className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[#444] no-underline transition-colors hover:bg-[#f7f5f2]"
                aria-label="Mensajes"
              >
                <ChatIcon className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-[#444] no-underline transition-colors hover:bg-[#f7f5f2]"
              >
                {t.navbar.iniciarSesion}
              </Link>
              <Link
                href="/registro"
                className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND.primary }}
              >
                {t.navbar.registrarse}
              </Link>
            </>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[60] bg-black/30 md:hidden"
            aria-label="Cerrar menú"
            onClick={closeMobileMenu}
          />
          <div
            className="fixed inset-x-0 top-0 z-[70] max-h-[90vh] overflow-y-auto border-b bg-white shadow-lg md:hidden"
            style={{ borderColor: BORDER }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div
              className="flex min-h-[44px] items-center justify-between border-b px-4"
              style={{ borderColor: BORDER }}
            >
              <span className="text-sm font-semibold text-[#2a3a4a]">Menú</span>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center text-xl text-[#666]"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <nav className="flex flex-col py-2" aria-label="Principal móvil">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="flex min-h-[44px] items-center border-b px-5 text-[15px] font-medium text-[#2a3a4a] no-underline transition-colors hover:bg-[#f7f5f2]"
                  style={{
                    borderColor: "#f0ede8",
                    color: link.primary ? BRAND.primary : "#2a3a4a",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div
              className="flex flex-col gap-2 border-t p-4"
              style={{ borderColor: BORDER }}
            >
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    onClick={closeMobileMenu}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border text-sm font-medium text-[#444] no-underline"
                    style={{ borderColor: BORDER }}
                  >
                    Mi cuenta
                  </Link>
                  <Link
                    href="/chat"
                    onClick={closeMobileMenu}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border text-sm font-medium text-[#444] no-underline"
                    style={{ borderColor: BORDER }}
                  >
                    Mensajes
                    {mensajesSinLeer > 0 ? ` (${mensajesSinLeer})` : ""}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();
                      handleSignOut();
                    }}
                    disabled={signingOut}
                    className="min-h-[44px] rounded-lg border text-sm font-medium text-[#666] disabled:opacity-60"
                    style={{ borderColor: BORDER }}
                  >
                    {signingOut ? "Cerrando sesión…" : "Cerrar sesión"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={closeMobileMenu}
                    className="flex min-h-[44px] items-center justify-center rounded-lg border text-sm font-medium text-[#444] no-underline"
                    style={{ borderColor: BORDER }}
                  >
                    {t.navbar.iniciarSesion}
                  </Link>
                  <Link
                    href="/registro"
                    onClick={closeMobileMenu}
                    className="flex min-h-[44px] items-center justify-center rounded-lg text-sm font-medium text-white no-underline"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {t.navbar.registrarse}
                  </Link>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
    {showDniBanner && (
      <div
        className="border-b px-4 py-2 text-center text-xs leading-relaxed text-[#92400e]"
        style={{ borderColor: BRAND.border, backgroundColor: "#fdf4e7" }}
      >
        {dniBannerText}{" "}
        <Link
          href={dniBannerHref}
          className="font-semibold no-underline hover:underline"
          style={{ color: PRIMARY }}
        >
          Subir DNI →
        </Link>
      </div>
    )}
    </>
  );
}
