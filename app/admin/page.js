"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { articulosIniciales, slugify } from "@/app/lib/blog-seed";
import { supabase } from "@/app/lib/supabase";

const TABS = [
  { id: "pendientes", label: "Pendientes de verificar" },
  { id: "verificados", label: "Verificados" },
  { id: "rechazados", label: "Rechazados" },
  { id: "reportes", label: "Reportes" },
  { id: "ingresos", label: "Ingresos" },
  { id: "blog", label: "Blog" },
];

const BLOG_CATEGORIAS_ADMIN = [
  "familias",
  "mascotas",
  "alojamiento",
  "nineras",
  "viajes",
  "consejos",
];

function getUnsplashImage(categoria, slug, width = 800, height = 400) {
  const queries = {
    familias: "family+travel+children",
    mascotas: "dog+pet+care+happy",
    alojamiento: "apartment+interior+modern",
    nineras: "childcare+babysitter+children",
    viajes: "travel+vacation+holiday",
    consejos: "planning+notebook+lifestyle",
  };
  const query = queries[categoria] || "travel+family";
  return `https://source.unsplash.com/${width}x${height}/?${query}&sig=${slug}`;
}

const EMPTY_BLOG_FORM = {
  id: null,
  titulo: "",
  slug: "",
  subtitulo: "",
  categoria: "consejos",
  tags: [],
  contenido: "",
  imagen_url: "",
  publicado: false,
  featured: false,
};

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
  const [reports, setReports] = useState([]);
  const [lateCancellations, setLateCancellations] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogFormOpen, setBlogFormOpen] = useState(false);
  const [blogForm, setBlogForm] = useState(EMPTY_BLOG_FORM);
  const [blogTagInput, setBlogTagInput] = useState("");
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogSeeding, setBlogSeeding] = useState(false);

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
    // -- CREATE TABLE blog_posts (
    // --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    // --   slug text UNIQUE NOT NULL,
    // --   titulo text NOT NULL,
    // --   subtitulo text,
    // --   contenido text NOT NULL,
    // --   imagen_url text,
    // --   categoria text CHECK (categoria IN ('familias', 'mascotas', 'alojamiento', 'nineras', 'viajes', 'consejos')),
    // --   tags text[],
    // --   autor text DEFAULT 'Home&Heart',
    // --   publicado boolean DEFAULT false,
    // --   featured boolean DEFAULT false,
    // --   created_at timestamp with time zone DEFAULT now(),
    // --   updated_at timestamp with time zone DEFAULT now()
    // -- );
    // -- ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
    // -- CREATE POLICY "Lectura publica posts publicados" ON blog_posts FOR SELECT USING (publicado = true);
    // -- CREATE POLICY "Admin gestiona posts" ON blog_posts FOR ALL USING (true);
    // -- CREATE TABLE email_logs (
    // --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    // --   user_id uuid REFERENCES profiles(id),
    // --   tipo text NOT NULL,
    // --   enviado_at timestamp with time zone DEFAULT now()
    // -- );
    const res = await fetch("/api/admin/providers");
    const { providers: profiles, error: profilesError } = await res.json();

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
        profiles_public:cliente_id (
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

    const { data: reportsData, error: reportsError } = await supabase
      .from("reports")
      .select(
        `
        *,
        reporter:profiles_public!reporter_id (nombre, apellido),
        reported:profiles_public!reported_id (nombre, apellido)
      `,
      )
      .order("created_at", { ascending: false });

    if (reportsError) {
      setErrorMessage(reportsError.message);
    } else {
      setReports(reportsData ?? []);
    }

    const garantiaRes = await fetch("/api/admin/garantia/cancelaciones-tardias");
    const garantiaData = await garantiaRes.json().catch(() => ({}));

    if (!garantiaRes.ok) {
      setErrorMessage(
        garantiaData.error || "Error al cargar cancelaciones tardías",
      );
    } else {
      setLateCancellations(garantiaData.cancelaciones ?? []);
    }

    const { data: blogData, error: blogError } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (blogError) {
      if (!blogError.message.includes("does not exist")) {
        setErrorMessage(blogError.message);
      }
      setBlogPosts([]);
    } else {
      setBlogPosts(blogData ?? []);
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const counts = useMemo(() => {
    const result = {
      pendientes: 0,
      verificados: 0,
      rechazados: 0,
      reportes: 0,
      ingresos: 0,
      blog: 0,
    };
    for (const p of providers) {
      result[getProviderStatus(p)] += 1;
    }
    result.reportes = reports.filter((r) => r.estado === "pendiente").length;
    result.ingresos = completedBookings.length;
    result.blog = blogPosts.length;
    return result;
  }, [providers, completedBookings, reports, blogPosts]);

  const pendingReports = useMemo(
    () => reports.filter((r) => r.estado === "pendiente"),
    [reports],
  );

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

    const response = await fetch(`/api/admin/providers/${providerId}/approve`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));

    setActionLoading(null);

    if (!response.ok) {
      setErrorMessage(`Error al aprobar: ${result.error || "Error desconocido"}`);
      return;
    }

    setRejectingId(null);
    setRejectReason("");
    await loadData();
  }

  async function handlePenalizarProveedor(proveedorId) {
    setActionLoading(proveedorId);
    setErrorMessage("");
    setSuccessMessage("");

    const response = await fetch(`/api/admin/providers/${proveedorId}/penalizar`, {
      method: "POST",
    });
    const result = await response.json().catch(() => ({}));

    setActionLoading(null);

    if (!response.ok) {
      setErrorMessage(result.error || "Error al aplicar la penalización.");
      return;
    }

    setSuccessMessage("Penalización aplicada. La valoración visible se reducirá.");
    await loadData();
  }

  async function handleReportStatus(reportId, estado) {
    setActionLoading(reportId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("reports")
      .update({ estado })
      .eq("id", reportId);

    setActionLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      estado === "resuelto"
        ? "Reporte marcado como resuelto."
        : "Reporte desestimado.",
    );
    await loadData();
  }

  async function handleReject(providerId) {
    if (!rejectReason.trim()) {
      setErrorMessage("Indica el motivo del rechazo.");
      return;
    }

    setActionLoading(providerId);
    setErrorMessage("");

    const response = await fetch(`/api/admin/providers/${providerId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo: rejectReason.trim() }),
    });
    const result = await response.json().catch(() => ({}));

    setActionLoading(null);

    if (!response.ok) {
      setErrorMessage(result.error || "Error al rechazar el proveedor.");
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
          proveedor_id: provider.id,
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

      setSuccessMessage("Solicitud enviada correctamente.");
      setRequestingDocsId(null);
      setSelectedDocuments([]);
      setRequestMessage("");
    } catch {
      setErrorMessage("Error de conexión al enviar la solicitud.");
    } finally {
      setRequestSending(null);
    }
  }

  function openNewBlogPost() {
    setBlogForm(EMPTY_BLOG_FORM);
    setBlogTagInput("");
    setBlogFormOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function openEditBlogPost(post) {
    setBlogForm({
      id: post.id,
      titulo: post.titulo || "",
      slug: post.slug || "",
      subtitulo: post.subtitulo || "",
      categoria: post.categoria || "consejos",
      tags: Array.isArray(post.tags) ? [...post.tags] : [],
      contenido: post.contenido || "",
      imagen_url: post.imagen_url || "",
      publicado: !!post.publicado,
      featured: !!post.featured,
    });
    setBlogTagInput("");
    setBlogFormOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function updateBlogForm(field, value) {
    setBlogForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "titulo" && !prev.id) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  function addBlogTag() {
    const tag = blogTagInput.trim();
    if (!tag) return;
    setBlogForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags : [...prev.tags, tag],
    }));
    setBlogTagInput("");
  }

  function removeBlogTag(tag) {
    setBlogForm((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }));
  }

  async function handleSaveBlogPost() {
    if (!blogForm.titulo.trim() || !blogForm.slug.trim() || !blogForm.contenido.trim()) {
      setErrorMessage("Título, slug y contenido son obligatorios.");
      return;
    }

    setBlogSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const payload = {
      titulo: blogForm.titulo.trim(),
      slug: blogForm.slug.trim(),
      subtitulo: blogForm.subtitulo.trim() || null,
      categoria: blogForm.categoria,
      tags: blogForm.tags,
      contenido: blogForm.contenido,
      imagen_url: blogForm.imagen_url.trim() || null,
      publicado: blogForm.publicado,
      featured: blogForm.featured,
      autor: "Home&Heart",
      updated_at: new Date().toISOString(),
    };

    let error;
    if (blogForm.id) {
      ({ error } = await supabase.from("blog_posts").update(payload).eq("id", blogForm.id));
    } else {
      ({ error } = await supabase.from("blog_posts").insert(payload));
    }

    setBlogSaving(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(blogForm.id ? "Artículo actualizado." : "Artículo creado.");
    setBlogFormOpen(false);
    setBlogForm(EMPTY_BLOG_FORM);
    await loadData();
  }

  async function handleToggleBlogPublish(post) {
    setActionLoading(post.id);
    setErrorMessage("");

    const { error } = await supabase
      .from("blog_posts")
      .update({
        publicado: !post.publicado,
        updated_at: new Date().toISOString(),
      })
      .eq("id", post.id);

    setActionLoading(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(post.publicado ? "Artículo despublicado." : "Artículo publicado.");
    await loadData();
  }

  async function handleSeedBlogPosts() {
    setBlogSeeding(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data: existing } = await supabase.from("blog_posts").select("slug");
    const existingSlugs = new Set((existing ?? []).map((p) => p.slug));
    const toInsert = articulosIniciales
      .filter((a) => !existingSlugs.has(a.slug))
      .map((a) => ({
        ...a,
        autor: "Home&Heart",
        updated_at: new Date().toISOString(),
      }));

    if (toInsert.length === 0) {
      setBlogSeeding(false);
      setSuccessMessage("Los artículos de ejemplo ya están importados.");
      return;
    }

    const { error } = await supabase.from("blog_posts").insert(toInsert);

    setBlogSeeding(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(`${toInsert.length} artículo(s) de ejemplo importados.`);
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

        {activeTab === "blog" ? (
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openNewBlogPost}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ backgroundColor: BRAND.primary }}
              >
                Nuevo post
              </button>
              <button
                type="button"
                disabled={blogSeeding}
                onClick={handleSeedBlogPosts}
                className="rounded-xl border px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: BRAND.border, backgroundColor: "#fff" }}
              >
                {blogSeeding ? "Importando…" : "Importar artículos de ejemplo"}
              </button>
            </div>

            {blogFormOpen && (
              <div
                className="mt-6 rounded-2xl border bg-white p-6"
                style={{ borderColor: BRAND.border }}
              >
                <h2 className="text-lg font-semibold text-[#1a1a1a]">
                  {blogForm.id ? "Editar artículo" : "Nuevo artículo"}
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[#444]">Título</label>
                    <input
                      type="text"
                      value={blogForm.titulo}
                      onChange={(e) => updateBlogForm("titulo", e.target.value)}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#444]">Slug</label>
                    <input
                      type="text"
                      value={blogForm.slug}
                      onChange={(e) => updateBlogForm("slug", e.target.value)}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-[#444]">Categoría</label>
                    <select
                      value={blogForm.categoria}
                      onChange={(e) => updateBlogForm("categoria", e.target.value)}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    >
                      {BLOG_CATEGORIAS_ADMIN.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[#444]">Subtítulo</label>
                    <input
                      type="text"
                      value={blogForm.subtitulo}
                      onChange={(e) => updateBlogForm("subtitulo", e.target.value)}
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[#444]">Tags</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {blogForm.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{ backgroundColor: BRAND.warm, color: "#444" }}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeBlogTag(tag)}
                            className="text-[#888] hover:text-red-600"
                            aria-label={`Quitar ${tag}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={blogTagInput}
                        onChange={(e) => setBlogTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addBlogTag();
                          }
                        }}
                        placeholder="Añadir tag…"
                        className="flex-1 rounded-xl border px-4 py-2 text-sm outline-none"
                        style={{ borderColor: BRAND.border }}
                      />
                      <button
                        type="button"
                        onClick={addBlogTag}
                        className="rounded-xl border px-4 py-2 text-sm font-medium"
                        style={{ borderColor: BRAND.border }}
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[#444]">
                      URL de imagen personalizada
                    </label>
                    <input
                      type="url"
                      value={blogForm.imagen_url}
                      onChange={(e) => updateBlogForm("imagen_url", e.target.value)}
                      placeholder="Dejar vacío para usar imagen automática"
                      className="mt-1 w-full rounded-xl border px-4 py-2.5 text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    />
                    <div className="mt-3 overflow-hidden rounded-xl border" style={{ borderColor: BRAND.border }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          blogForm.imagen_url.trim() ||
                          getUnsplashImage(
                            blogForm.categoria,
                            blogForm.slug || "preview",
                            400,
                            200,
                          )
                        }
                        alt="Vista previa"
                        style={{ width: "100%", height: 200, objectFit: "cover" }}
                      />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-[#444]">Contenido (markdown)</label>
                    <textarea
                      rows={14}
                      value={blogForm.contenido}
                      onChange={(e) => updateBlogForm("contenido", e.target.value)}
                      className="mt-1 w-full rounded-xl border px-4 py-3 font-mono text-sm outline-none"
                      style={{ borderColor: BRAND.border }}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#444]">
                    <input
                      type="checkbox"
                      checked={blogForm.publicado}
                      onChange={(e) => updateBlogForm("publicado", e.target.checked)}
                      className="accent-[#1d4f91]"
                    />
                    Publicado
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-[#444]">
                    <input
                      type="checkbox"
                      checked={blogForm.featured}
                      onChange={(e) => updateBlogForm("featured", e.target.checked)}
                      className="accent-[#1d4f91]"
                    />
                    Destacado
                  </label>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={blogSaving}
                    onClick={handleSaveBlogPost}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {blogSaving ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBlogFormOpen(false);
                      setBlogForm(EMPTY_BLOG_FORM);
                    }}
                    className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                    style={{ borderColor: BRAND.border }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {blogPosts.length === 0 ? (
              <p
                className="mt-6 rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
                style={{ borderColor: BRAND.border }}
              >
                No hay artículos. Crea uno nuevo o importa los de ejemplo.
              </p>
            ) : (
              <ul className="mt-6 flex flex-col gap-3">
                {blogPosts.map((post) => {
                  const isBusy = actionLoading === post.id;
                  return (
                    <li
                      key={post.id}
                      className="rounded-2xl border bg-white p-4 sm:p-5"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[#1a1a1a]">{post.titulo}</p>
                          <p className="mt-1 text-[12px] text-[#888]">
                            /blog/{post.slug} · {post.categoria} ·{" "}
                            {new Date(post.created_at).toLocaleDateString("es-ES")}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                              style={{
                                backgroundColor: post.publicado ? "#e6f5ef" : "#f3f3f3",
                                color: post.publicado ? "#0e7a5c" : "#888",
                              }}
                            >
                              {post.publicado ? "Publicado" : "Borrador"}
                            </span>
                            {post.featured && (
                              <span
                                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold"
                                style={{ backgroundColor: "#fdf3e3", color: AMBER }}
                              >
                                Destacado
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEditBlogPost(post)}
                            className="rounded-xl border px-3 py-1.5 text-[12px] font-medium"
                            style={{ borderColor: BRAND.border }}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleToggleBlogPublish(post)}
                            className="rounded-xl px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                            style={{
                              backgroundColor: post.publicado ? "#888" : BRAND.primary,
                            }}
                          >
                            {isBusy
                              ? "…"
                              : post.publicado
                                ? "Despublicar"
                                : "Publicar"}
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : activeTab === "reportes" ? (
          <div className="mt-6">
            {pendingReports.length === 0 ? (
              <p
                className="rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
                style={{ borderColor: BRAND.border }}
              >
                No hay reportes pendientes.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {pendingReports.map((report) => {
                  const reporterNombre = report.reporter
                    ? [report.reporter.nombre, report.reporter.apellido]
                        .filter(Boolean)
                        .join(" ")
                    : "—";
                  const reportedNombre = report.reported
                    ? [report.reported.nombre, report.reported.apellido]
                        .filter(Boolean)
                        .join(" ")
                    : "—";
                  const isBusy = actionLoading === report.id;

                  return (
                    <li
                      key={report.id}
                      className="rounded-2xl border bg-white p-6"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1a1a1a]">
                            {reporterNombre}{" "}
                            <span className="font-normal text-[#888]">
                              reporta a
                            </span>{" "}
                            {reportedNombre}
                          </p>
                          <p className="mt-1 text-xs text-[#888]">
                            {formatDate(report.created_at)}
                            {report.tipo ? ` · ${report.tipo}` : ""}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                          style={{
                            backgroundColor: "#fef3c7",
                            color: "#92400e",
                          }}
                        >
                          Pendiente
                        </span>
                      </div>

                      <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                          Motivo
                        </p>
                        <p className="mt-1 text-sm text-[#1a1a1a]">
                          {report.motivo}
                        </p>
                      </div>

                      {report.descripcion && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                            Descripción
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-[#444]">
                            {report.descripcion}
                          </p>
                        </div>
                      )}

                      <div className="mt-5 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleReportStatus(report.id, "resuelto")}
                          className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                          style={{ backgroundColor: BRAND.primary }}
                        >
                          {isBusy ? "Procesando…" : "Resuelto"}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleReportStatus(report.id, "desestimado")
                          }
                          className="rounded-xl border px-4 py-2 text-sm font-semibold text-[#666] transition-colors hover:bg-[#f7f5f2] disabled:opacity-60"
                          style={{ borderColor: BRAND.border }}
                        >
                          Desestimar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <section
              className="mt-8 rounded-2xl border bg-white p-6"
              style={{ borderColor: BRAND.border }}
            >
              <h2
                className="text-lg font-semibold text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                Cancelaciones tardías
              </h2>
              <p className="mt-1 text-xs text-[#888]">
                Proveedores que cancelaron con menos de 24h en los últimos 30
                días
              </p>

              {lateCancellations.length === 0 ? (
                <p className="mt-4 text-sm text-[#666]">
                  No hay cancelaciones tardías registradas.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {lateCancellations.map((entry) => {
                    const isBusy = actionLoading === entry.proveedorId;
                    return (
                      <li
                        key={entry.proveedorId}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3"
                        style={{ borderColor: BRAND.border }}
                      >
                        <div>
                          <p className="font-medium text-[#1a1a1a]">
                            {entry.nombre}
                          </p>
                          <p className="mt-0.5 text-xs text-[#888]">
                            {entry.count} cancelación
                            {entry.count !== 1 ? "es" : ""} tardía
                            {entry.count !== 1 ? "s" : ""}
                            {entry.penalizacion > 0
                              ? ` · Penalización: -${entry.penalizacion.toFixed(1)} ★`
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handlePenalizarProveedor(entry.proveedorId)
                          }
                          className="rounded-xl border px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                          style={{ borderColor: "#fecaca" }}
                        >
                          {isBusy ? "Aplicando…" : "Penalizar"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : activeTab === "ingresos" ? (
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
                      const cliente = booking.profiles_public;
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
