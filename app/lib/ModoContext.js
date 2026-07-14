"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { needsProviderOnboarding } from "@/app/lib/onboarding";
import { supabase } from "@/app/lib/supabase";

const STORAGE_KEY = "hh_modo";

/** @typedef {'cliente' | 'proveedor'} Modo */

const ModoContext = createContext(null);

function readStoredModo() {
  if (typeof window === "undefined") return "cliente";
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "proveedor" || v === "cliente") return v;
  } catch {
    /* ignore */
  }
  return "cliente";
}

function writeStoredModo(modo) {
  try {
    localStorage.setItem(STORAGE_KEY, modo);
  } catch {
    /* ignore */
  }
}

export function ModoProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  /** Siempre 'cliente' en SSR y primer paint → evita hydration mismatch */
  const [modo, setModoState] = useState("cliente");
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [servicesCount, setServicesCount] = useState(0);
  const [profileReady, setProfileReady] = useState(false);

  const onboardingIncompleto = needsProviderOnboarding(perfil);
  const esProveedorRol = perfil?.role === "proveedor";
  const puedeActuarComoProveedor =
    esProveedorRol && !onboardingIncompleto && !!perfil?.onboarding_completed_at;
  const esClientePuro = !puedeActuarComoProveedor;
  const esAmbos = puedeActuarComoProveedor;
  const esProveedor = puedeActuarComoProveedor;
  const puedeAlternarModo = puedeActuarComoProveedor;
  const enAdmin = pathname?.startsWith("/admin") ?? false;
  const mostrarSwitch = puedeAlternarModo && !enAdmin;

  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setPerfil(null);
      setServicesCount(0);
      setProfileReady(true);
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select(
        "nombre, apellido, role, descripcion, idiomas, foto_perfil, reservas_sin_comision_cliente, reservas_sin_comision_proveedor, onboarding_completed_at, doc_dni_url",
      )
      .eq("id", authUser.id)
      .single();

    setPerfil(profileData ?? null);

    const { count: svcCount } = await supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("proveedor_id", authUser.id);

    setServicesCount(svcCount ?? 0);
    setProfileReady(true);
  }, []);

  useEffect(() => {
    async function init() {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      setUser(authUser);
      await loadProfile(authUser);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      setProfileReady(false);
      loadProfile(authUser);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  /** Restaurar modo persistido una sola vez tras hidratación + perfil */
  const restoredRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !profileReady) return;

    if (!user) {
      restoredRef.current = false;
      setModoState("cliente");
      return;
    }

    if (restoredRef.current) return;
    restoredRef.current = true;

    if (!puedeAlternarModo) {
      setModoState("cliente");
      return;
    }

    const stored = readStoredModo();
    setModoState(stored === "proveedor" ? "proveedor" : "cliente");
  }, [hydrated, profileReady, puedeAlternarModo, user]);

  const setModo = useCallback(
    (nextModo, options = {}) => {
      const { redirect = true } = options;

      if (nextModo !== "cliente" && nextModo !== "proveedor") return;
      if (nextModo === "proveedor" && !puedeAlternarModo) return;

      setModoState(nextModo);
      writeStoredModo(nextModo);

      if (redirect && !enAdmin) {
        router.push(nextModo === "proveedor" ? "/dashboard" : "/buscar");
      }
    },
    [puedeAlternarModo, router, enAdmin],
  );

  const value = useMemo(
    () => ({
      modo,
      setModo,
      hydrated,
      user,
      perfil,
      servicesCount,
      esProveedor,
      esClientePuro,
      esAmbos,
      puedeAlternarModo,
      mostrarSwitch,
      onboardingIncompleto,
      enAdmin,
    }),
    [
      modo,
      setModo,
      hydrated,
      user,
      perfil,
      servicesCount,
      esProveedor,
      esClientePuro,
      esAmbos,
      puedeAlternarModo,
      mostrarSwitch,
      onboardingIncompleto,
      enAdmin,
    ],
  );

  return (
    <ModoContext.Provider value={value}>{children}</ModoContext.Provider>
  );
}

export function useModo() {
  const ctx = useContext(ModoContext);
  if (!ctx) {
    throw new Error("useModo debe usarse dentro de ModoProvider");
  }
  return ctx;
}

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";

/** Toggle Cliente | Proveedor — usa ModoContext */
export function ModoSwitch({ compact = false, onChanged, className = "" }) {
  const { modo, setModo, mostrarSwitch, hydrated } = useModo();

  if (!mostrarSwitch) return null;

  return (
    <div
      className={`flex gap-0.5 rounded-lg border p-0.5 ${className}`}
      style={{
        borderColor: BORDER,
        background: compact ? "#f7f5f2" : "#fff",
      }}
      role="group"
      aria-label="Modo de navegación"
    >
      {["cliente", "proveedor"].map((m) => {
        const active = hydrated && modo === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (modo === m) return;
              setModo(m, { redirect: true });
              onChanged?.();
            }}
            className={
              compact
                ? "min-h-[36px] flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold capitalize transition-colors"
                : "min-h-[36px] rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors"
            }
            style={{
              background: active ? PRIMARY : "transparent",
              color: active ? "#fff" : "#888",
              border: "none",
              cursor: "pointer",
              boxShadow: active ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            }}
            aria-pressed={active}
          >
            {m === "cliente" ? "Cliente" : "Proveedor"}
          </button>
        );
      })}
    </div>
  );
}
