"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const TABS = [
  { id: "pendientes", label: "Pendientes de verificar" },
  { id: "verificados", label: "Verificados" },
  { id: "rechazados", label: "Rechazados" },
];

const VERTICALS = {
  alojamiento: { label: "Alojamiento", priceSuffix: "/ noche" },
  ninos: { label: "Cuidado de niños", priceSuffix: "/ hora" },
  mascotas: { label: "Cuidado de mascotas", priceSuffix: "/ día" },
};

const PROVIDER_DOCUMENTS = [
  {
    urlKey: "doc_dni_url",
    linkLabel: "Ver DNI",
    name: "DNI o NIE",
  },
  {
    urlKey: "doc_antecedentes_url",
    linkLabel: "Ver certificado de antecedentes",
    name: "Certificado de antecedentes",
  },
  {
    urlKey: "doc_antecedentes_sexuales_url",
    linkLabel: "Ver cert. delitos sexuales",
    name: "Cert. delitos sexuales",
  },
];

function FileIcon({ className }) {
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
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
      />
    </svg>
  );
}

function ProviderDocuments({ provider }) {
  const available = PROVIDER_DOCUMENTS.filter((doc) => provider[doc.urlKey]);

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        Documentación aportada
      </p>

      {available.length === 0 ? (
        <p className="mt-1 text-sm text-[#888]">
          No ha aportado documentación todavía
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {available.map((doc) => (
            <li key={doc.urlKey}>
              <a
                href={provider[doc.urlKey]}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm no-underline transition-colors hover:bg-[#fafafa]"
                style={{ borderColor: BRAND.border, color: BRAND.primary }}
              >
                <FileIcon className="h-5 w-5 shrink-0" />
                <span className="font-medium text-[#1a1a1a]">{doc.name}</span>
                <span className="text-[#666]">· {doc.linkLabel}</span>
                <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Subido ✓
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatPrice(precio, vertical) {
  const config = VERTICALS[vertical] ?? VERTICALS.alojamiento;
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${config.priceSuffix}`;
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function getProviderStatus(profile) {
  if (profile.rechazado === true) return "rechazados";
  if (profile.verificado === true) return "verificados";
  return "pendientes";
}

function fullName(profile) {
  return [profile.nombre, profile.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [servicesByProvider, setServicesByProvider] = useState({});
  const [activeTab, setActiveTab] = useState("pendientes");
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setErrorMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.replace("/login");
      return;
    }

    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rechazado boolean DEFAULT false;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_contacto text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fecha_registro timestamp with time zone DEFAULT now();
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS motivo_rechazo text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_dni_url text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_antecedentes_url text;
    // -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doc_antecedentes_sexuales_url text;
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "proveedor")
      .order("fecha_registro", { ascending: false });

    if (profilesError) {
      setErrorMessage(profilesError.message);
      setLoading(false);
      return;
    }

    const providerList = profiles ?? [];
    setProviders(providerList);

    if (providerList.length > 0) {
      const providerIds = providerList.map((p) => p.id);
      const { data: services, error: servicesError } = await supabase
        .from("services")
        .select("id, proveedor_id, vertical, titulo, precio, ciudad")
        .in("proveedor_id", providerIds);

      if (servicesError) {
        setErrorMessage(servicesError.message);
      } else {
        const grouped = {};
        for (const svc of services ?? []) {
          if (!grouped[svc.proveedor_id]) grouped[svc.proveedor_id] = [];
          grouped[svc.proveedor_id].push(svc);
        }
        setServicesByProvider(grouped);
      }
    } else {
      setServicesByProvider({});
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    const result = { pendientes: 0, verificados: 0, rechazados: 0 };
    for (const p of providers) {
      result[getProviderStatus(p)] += 1;
    }
    return result;
  }, [providers]);

  const filteredProviders = useMemo(
    () => providers.filter((p) => getProviderStatus(p) === activeTab),
    [providers, activeTab],
  );

  async function handleApprove(providerId) {
    setActionLoading(providerId);
    setErrorMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({ verificado: true, rechazado: false })
      .eq("id", providerId);

    setActionLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRejectingId(null);
    setRejectReason("");
    await loadData();
  }

  async function handleReject(providerId) {
    if (!rejectReason.trim()) {
      setErrorMessage("Indica el motivo del rechazo.");
      return;
    }

    setActionLoading(providerId);
    setErrorMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        verificado: false,
        rechazado: true,
        motivo_rechazo: rejectReason.trim(),
      })
      .eq("id", providerId);

    setActionLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setRejectingId(null);
    setRejectReason("");
    await loadData();
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando panel de administración…
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
      <Navbar />

      <header className="px-4 py-6 text-white sm:px-6" style={{ backgroundColor: BRAND.primary }}>
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold sm:text-2xl" style={{ fontFamily: SERIF }}>
            Panel Admin · Home&Heart
          </h1>
          <span className="rounded-full bg-white/20 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide">
            Admin
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={{
                  borderColor: isActive ? BRAND.primary : BRAND.border,
                  backgroundColor: isActive ? BRAND.light : "#fff",
                  color: isActive ? BRAND.primary : "#444",
                }}
              >
                {tab.label}
                <span
                  className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: isActive ? BRAND.primary : "#eee",
                    color: isActive ? "#fff" : "#666",
                  }}
                >
                  {counts[tab.id]}
                </span>
              </button>
            );
          })}
        </div>

        {errorMessage && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        {filteredProviders.length === 0 ? (
          <p
            className="mt-8 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
            style={{ borderColor: BRAND.border }}
          >
            No hay proveedores en esta categoría.
          </p>
        ) : (
          <ul className="mt-6 flex flex-col gap-5">
            {filteredProviders.map((provider) => {
              const services = servicesByProvider[provider.id] ?? [];
              const languages = Array.isArray(provider.idiomas)
                ? provider.idiomas
                : [];
              const isRejecting = rejectingId === provider.id;
              const isBusy = actionLoading === provider.id;

              return (
                <li
                  key={provider.id}
                  className="rounded-2xl border bg-white p-6"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[#1a1a1a]">
                        {fullName(provider)}
                      </h2>
                      {provider.email_contacto && (
                        <p className="mt-0.5 text-sm text-[#666]">
                          {provider.email_contacto}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-[#888]">
                        {provider.ciudad || "Ciudad no indicada"}
                      </p>
                    </div>
                    <p className="text-xs text-[#888]">
                      Registro: {formatDate(provider.fecha_registro)}
                    </p>
                  </div>

                  {provider.descripcion && (
                    <p className="mt-4 text-sm leading-relaxed text-[#444]">
                      {provider.descripcion}
                    </p>
                  )}

                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                      Servicios
                    </p>
                    {services.length === 0 ? (
                      <p className="mt-1 text-sm text-[#888]">Sin servicios publicados</p>
                    ) : (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {services.map((svc) => {
                          const verticalConfig =
                            VERTICALS[svc.vertical] ?? VERTICALS.alojamiento;
                          return (
                            <li
                              key={svc.id}
                              className="flex flex-wrap items-center gap-2 text-sm"
                            >
                              <span
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                style={{
                                  backgroundColor: BRAND.light,
                                  color: BRAND.primary,
                                }}
                              >
                                {verticalConfig.label}
                              </span>
                              <span className="text-[#444]">
                                {svc.titulo || verticalConfig.label}
                              </span>
                              <span className="font-semibold" style={{ color: BRAND.primary }}>
                                {formatPrice(svc.precio, svc.vertical)}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  {languages.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {languages.map((lang) => (
                        <span
                          key={lang}
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: BRAND.warm, color: "#444" }}
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  )}

                  <ProviderDocuments provider={provider} />

                  {provider.motivo_rechazo && activeTab === "rechazados" && (
                    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      <strong>Motivo:</strong> {provider.motivo_rechazo}
                    </p>
                  )}

                  {activeTab === "pendientes" && (
                    <div className="mt-5 border-t pt-5" style={{ borderColor: BRAND.border }}>
                      {isRejecting ? (
                        <div className="flex flex-col gap-3">
                          <label className="text-xs font-medium text-[#444]">
                            Motivo del rechazo
                          </label>
                          <textarea
                            rows={3}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Explica por qué se rechaza este perfil…"
                            className="w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                            style={{ borderColor: BRAND.border }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReject(provider.id)}
                              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            >
                              {isBusy ? "Guardando…" : "Confirmar rechazo ✗"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectReason("");
                              }}
                              className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                              style={{ borderColor: BRAND.border }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleApprove(provider.id)}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                          >
                            {isBusy ? "Guardando…" : "Aprobar ✓"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => {
                              setRejectingId(provider.id);
                              setRejectReason("");
                            }}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                          >
                            Rechazar ✗
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
