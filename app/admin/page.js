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
  { id: "ingresos", label: "Ingresos" },
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

const STORAGE_BUCKET = "Documentos";
const SIGNED_URL_TTL = 3600;
const AMBER = "#c47d1a";

const REQUESTABLE_DOCUMENTS = [
  { id: "dni_nie", label: "DNI o NIE vigente" },
  { id: "antecedentes", label: "Certificado de antecedentes penales" },
  { id: "delitos_sexuales", label: "Certificado de delitos de naturaleza sexual" },
  { id: "nru", label: "NRU (solo alojamiento)", alojamientoOnly: true },
  { id: "seguro_rc", label: "Seguro de responsabilidad civil" },
  { id: "primeros_auxilios", label: "Certificado de primeros auxilios" },
  { id: "titulacion", label: "Titulación o formación profesional" },
  { id: "foto_perfil", label: "Foto de perfil real y reciente" },
];

function extractStoragePath(storedValue) {
  if (!storedValue) return null;

  const publicMatch =
    storedValue.match(/\/object\/public\/Documentos\/(.+)$/i) ||
    storedValue.match(/\/object\/public\/documentos\/(.+)$/i);
  if (publicMatch) {
    return decodeURIComponent(publicMatch[1].split("?")[0]);
  }

  const signedMatch = storedValue.match(/\/object\/sign\/Documentos\/(.+?)(\?|$)/i);
  if (signedMatch) {
    return decodeURIComponent(signedMatch[1]);
  }

  return storedValue.replace(/^\/+/, "");
}

async function getDocumentSignedUrl(storedValue) {
  const path = extractStoragePath(storedValue);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error) throw error;
  return data.signedUrl;
}

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
  const [loadingDoc, setLoadingDoc] = useState(null);
  const [docError, setDocError] = useState("");
  const available = PROVIDER_DOCUMENTS.filter((doc) => provider[doc.urlKey]);

  async function handleOpenDocument(urlKey, storedValue) {
    setLoadingDoc(urlKey);
    setDocError("");

    try {
      const signedUrl = await getDocumentSignedUrl(storedValue);
      if (signedUrl) {
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setDocError(err.message || "No se pudo abrir el documento.");
    } finally {
      setLoadingDoc(null);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
        Documentación aportada
      </p>

      {docError && (
        <p className="mt-1 text-xs text-red-600">{docError}</p>
      )}

      {available.length === 0 ? (
        <p className="mt-1 text-sm text-[#888]">
          No ha aportado documentación todavía
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {available.map((doc) => (
            <li key={doc.urlKey}>
              <button
                type="button"
                disabled={loadingDoc === doc.urlKey}
                onClick={() => handleOpenDocument(doc.urlKey, provider[doc.urlKey])}
                className="flex w-full flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors hover:bg-[#fafafa] disabled:cursor-wait disabled:opacity-70"
                style={{ borderColor: BRAND.border, color: BRAND.primary }}
              >
                <FileIcon className="h-5 w-5 shrink-0" />
                <span className="font-medium text-[#1a1a1a]">{doc.name}</span>
                <span className="text-[#666]">
                  · {loadingDoc === doc.urlKey ? "Abriendo…" : doc.linkLabel}
                </span>
                <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                  Subido ✓
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function getTransferidoProveedor(precioTotal) {
  const precio = Number(precioTotal) || 0;
  return (precio / 1.14) * 0.96;
}

function getComisionHH(precioTotal) {
  const precio = Number(precioTotal) || 0;
  return precio - getTransferidoProveedor(precio);
}

function formatEuroAdmin(amount) {
  return `${Number(amount).toFixed(2)}€`;
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
  const [requestingDocsId, setRequestingDocsId] = useState(null);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestSending, setRequestSending] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [completedBookings, setCompletedBookings] = useState([]);

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

    const { data: bookingsData, error: bookingsError } = await supabase
      .from("bookings")
      .select(
        `
        id,
        precio_total,
        fecha_inicio,
        created_at,
        cliente_id,
        service_id,
        profiles:cliente_id (
          nombre,
          apellido
        ),
        services:service_id (
          titulo
        )
      `,
      )
      .eq("estado", "completada")
      .order("created_at", { ascending: false });

    if (bookingsError) {
      setErrorMessage(bookingsError.message);
    } else {
      setCompletedBookings(bookingsData ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    const result = { pendientes: 0, verificados: 0, rechazados: 0, ingresos: 0 };
    for (const p of providers) {
      result[getProviderStatus(p)] += 1;
    }
    result.ingresos = completedBookings.length;
    return result;
  }, [providers, completedBookings]);

  const revenueSummary = useMemo(() => {
    let totalCobrado = 0;
    let totalTransferido = 0;

    for (const booking of completedBookings) {
      const precio = Number(booking.precio_total) || 0;
      totalCobrado += precio;
      totalTransferido += getTransferidoProveedor(precio);
    }

    return {
      totalCobrado,
      totalTransferido,
      comisionNeta: totalCobrado - totalTransferido,
    };
  }, [completedBookings]);

  const latestCompletedBookings = useMemo(
    () => completedBookings.slice(0, 10),
    [completedBookings],
  );

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

  function toggleDocumentSelection(docId) {
    setSelectedDocuments((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  }

  function openDocumentRequest(providerId) {
    setRejectingId(null);
    setRejectReason("");
    setRequestingDocsId(providerId);
    setSelectedDocuments([]);
    setRequestMessage("");
    setSuccessMessage("");
  }

  async function handleSendDocumentRequest(provider) {
    if (selectedDocuments.length === 0) {
      setErrorMessage("Selecciona al menos un documento para solicitar.");
      return;
    }

    if (!provider.email_contacto) {
      setErrorMessage("Este proveedor no tiene email de contacto registrado.");
      return;
    }

    const documentLabels = selectedDocuments.map(
      (id) => REQUESTABLE_DOCUMENTS.find((d) => d.id === id)?.label || id,
    );

    setRequestSending(provider.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "solicitud_documentos",
          destinatario: provider.email_contacto,
          proveedor_nombre: fullName(provider),
          documentos: documentLabels,
          mensaje: requestMessage.trim() || "",
          asunto: "Home&Heart — Necesitamos documentación adicional",
          perfil_url: `${window.location.origin}/ser-proveedor`,
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        setErrorMessage(result.error || "No se pudo enviar la solicitud.");
        return;
      }

      setSuccessMessage(
        `Solicitud enviada a ${provider.email_contacto}`,
      );
      setRequestingDocsId(null);
      setSelectedDocuments([]);
      setRequestMessage("");
    } catch {
      setErrorMessage("Error de conexión al enviar la solicitud.");
    } finally {
      setRequestSending(null);
    }
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
                  setRequestingDocsId(null);
                  setRejectReason("");
                  setSelectedDocuments([]);
                  setRequestMessage("");
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

        {successMessage && (
          <p className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
            {successMessage}
          </p>
        )}

        {activeTab === "ingresos" ? (
          <div className="mt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div
                className="rounded-2xl border bg-white p-6"
                style={{ borderColor: BRAND.border }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Total cobrado a clientes
                </p>
                <p
                  className="mt-3 text-3xl font-bold sm:text-4xl"
                  style={{ color: BRAND.primary }}
                >
                  {formatEuroAdmin(revenueSummary.totalCobrado)}
                </p>
              </div>
              <div
                className="rounded-2xl border bg-white p-6"
                style={{ borderColor: BRAND.border }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Total transferido a proveedores
                </p>
                <p
                  className="mt-3 text-3xl font-bold sm:text-4xl"
                  style={{ color: BRAND.primary }}
                >
                  {formatEuroAdmin(revenueSummary.totalTransferido)}
                </p>
              </div>
              <div
                className="rounded-2xl border bg-white p-6"
                style={{ borderColor: BRAND.border }}
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                  Comisión neta H&H
                </p>
                <p
                  className="mt-3 text-3xl font-bold sm:text-4xl"
                  style={{ color: BRAND.primary }}
                >
                  {formatEuroAdmin(revenueSummary.comisionNeta)}
                </p>
              </div>
            </div>

            {latestCompletedBookings.length === 0 ? (
              <p
                className="mt-6 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
                style={{ borderColor: BRAND.border }}
              >
                Aún no hay reservas completadas.
              </p>
            ) : (
              <div
                className="mt-6 overflow-x-auto rounded-2xl border bg-white"
                style={{ borderColor: BRAND.border }}
              >
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr
                      className="border-b text-xs font-semibold uppercase tracking-wide text-[#888]"
                      style={{ borderColor: BRAND.border }}
                    >
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Servicio</th>
                      <th className="px-4 py-3 text-right">Cobrado al cliente</th>
                      <th className="px-4 py-3 text-right">Transferido al proveedor</th>
                      <th className="px-4 py-3 text-right">Comisión H&H</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestCompletedBookings.map((booking) => {
                      const precio = Number(booking.precio_total) || 0;
                      const transferido = getTransferidoProveedor(precio);
                      const comision = getComisionHH(precio);
                      const cliente = booking.profiles;
                      const clienteNombre = cliente
                        ? [cliente.nombre, cliente.apellido].filter(Boolean).join(" ")
                        : "—";
                      const fecha = booking.fecha_inicio
                        ? formatDate(`${booking.fecha_inicio}T12:00:00`)
                        : formatDate(booking.created_at);

                      return (
                        <tr
                          key={booking.id}
                          className="border-b last:border-b-0"
                          style={{ borderColor: BRAND.border }}
                        >
                          <td className="px-4 py-3 text-[#444]">{fecha || "—"}</td>
                          <td className="px-4 py-3 font-medium text-[#1a1a1a]">
                            {clienteNombre}
                          </td>
                          <td className="px-4 py-3 text-[#444]">
                            {booking.services?.titulo || "—"}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold"
                            style={{ color: BRAND.primary }}
                          >
                            {formatEuroAdmin(precio)}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold"
                            style={{ color: BRAND.primary }}
                          >
                            {formatEuroAdmin(transferido)}
                          </td>
                          <td
                            className="px-4 py-3 text-right font-semibold"
                            style={{ color: BRAND.primary }}
                          >
                            {formatEuroAdmin(comision)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : filteredProviders.length === 0 ? (
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
              const isRequestingDocs = requestingDocsId === provider.id;
              const isBusy = actionLoading === provider.id;
              const hasAlojamiento = services.some((s) => s.vertical === "alojamiento");
              const availableDocuments = REQUESTABLE_DOCUMENTS.filter(
                (doc) => !doc.alojamientoOnly || hasAlojamiento,
              );

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
                      ) : isRequestingDocs ? (
                        <div className="flex flex-col gap-3">
                          <p className="text-xs font-medium text-[#444]">
                            Documentos a solicitar
                          </p>
                          <div className="flex flex-col gap-2">
                            {availableDocuments.map((doc) => {
                              const checked = selectedDocuments.includes(doc.id);
                              return (
                                <label
                                  key={doc.id}
                                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                                  style={{
                                    borderColor: checked ? AMBER : BRAND.border,
                                    backgroundColor: checked ? "#fdf3e3" : "#fff",
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleDocumentSelection(doc.id)}
                                    className="accent-[#c47d1a]"
                                  />
                                  <span className="text-[#444]">{doc.label}</span>
                                </label>
                              );
                            })}
                          </div>
                          <div>
                            <label className="text-xs font-medium text-[#444]">
                              Mensaje adicional (opcional)
                            </label>
                            <textarea
                              rows={3}
                              value={requestMessage}
                              onChange={(e) => setRequestMessage(e.target.value)}
                              placeholder="Añade instrucciones o contexto para el proveedor…"
                              className="mt-1.5 w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#c47d1a]/30"
                              style={{ borderColor: BRAND.border }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={requestSending === provider.id}
                              onClick={() => handleSendDocumentRequest(provider)}
                              className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                              style={{ backgroundColor: AMBER }}
                            >
                              {requestSending === provider.id
                                ? "Enviando…"
                                : "Enviar solicitud"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRequestingDocsId(null);
                                setSelectedDocuments([]);
                                setRequestMessage("");
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
                              setRequestingDocsId(null);
                            }}
                            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                          >
                            Rechazar ✗
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => openDocumentRequest(provider.id)}
                            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: AMBER }}
                          >
                            Solicitar documentos 📎
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
