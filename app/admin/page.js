"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Navbar from "@/app/components/Navbar";
import AdminProviderDocuments, {
  getMissingMandatoryDocumentsSummary,
} from "@/app/components/admin/AdminProviderDocuments";
import AdminUsersTab from "@/app/components/admin/AdminUsersTab";
import AdminCancelacionesTab from "@/app/components/admin/AdminCancelacionesTab";
import AdminServiciosRevisionTab from "@/app/components/admin/AdminServiciosRevisionTab";
import AdminSuspensionesCautelaresTab from "@/app/components/admin/AdminSuspensionesCautelaresTab";
import { BRAND, SERIF } from "@/app/components/brand";
import { articulosIniciales, slugify } from "@/app/lib/blog-seed";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";
import {
  REVISION_APROBADO,
  REVISION_BORRADOR,
  REVISION_EN_REVISION,
  REVISION_RECHAZADO,
} from "@/app/lib/onboarding-persist";
import { supabase } from "@/app/lib/supabase";

const TABS = [
  { id: "usuarios", label: "Usuarios" },
  { id: "cancelaciones", label: "Cancelaciones" },
  { id: "servicios-revision", label: "Servicios pendientes de revisión" },
  { id: "suspensiones", label: "Suspensiones cautelares" },
  { id: "pendientes", label: "Pendientes de verificar" },
  { id: "verificados", label: "Verificados" },
  { id: "rechazados", label: "Rechazados" },
  { id: "reportes", label: "Reportes" },
  { id: "incidencias", label: "Incidencias" },
  { id: "ingresos", label: "Ingresos" },
  { id: "blog", label: "Blog" },
  { id: "herramientas", label: "Herramientas" },
];

const VALID_TAB_IDS = new Set(TABS.map((t) => t.id));

function initialTabFromSearch(searchParams) {
  const tab = searchParams?.get("tab");
  if (tab && VALID_TAB_IDS.has(tab)) return tab;
  return "pendientes";
}

function formatFechasReserva(inc) {
  if (!inc.fecha_inicio) return "—";
  if (inc.hora) return `${inc.fecha_inicio} · ${inc.hora}`;
  if (inc.fecha_fin && inc.fecha_fin !== inc.fecha_inicio) {
    return `${inc.fecha_inicio} – ${inc.fecha_fin}`;
  }
  return inc.fecha_inicio;
}

function stripeStatusBadgeStyle(status) {
  switch (status) {
    case "requires_capture":
      return { bg: "#fef3c7", color: "#92400e" };
    case "succeeded":
      return { bg: "#e6f4f0", color: "#085041" };
    case "canceled":
      return { bg: "#f3f4f6", color: "#6b7280" };
    default:
      return { bg: "#fee2e2", color: "#b91c1c" };
  }
}

/** PI ya cancelado/reembolsado en Stripe; la reserva puede seguir abierta en BD. */
function stripePagoYaLiberado(status) {
  return status === "canceled";
}

function puedeMostrarAccionesResolucionIncidencia(inc) {
  return inc.estado === "incidencia";
}

function puedeLiberarPagoProveedor(inc) {
  return inc.estado === "incidencia" && !stripePagoYaLiberado(inc.stripe?.status);
}

function puedeRepartoIncidencia(inc) {
  return inc.estado === "incidencia" && !inc.bundle?.is_bundle;
}

function parseEuroInput(value) {
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function repartoSumaValida(inc, importeCliente, importeProveedor) {
  const bote = inc.reparto?.bote ?? inc.ingreso_proveedor_estimado ?? 0;
  if (Number.isNaN(importeCliente) || Number.isNaN(importeProveedor)) return false;
  if (importeCliente < 0 || importeProveedor < 0) return false;
  return Math.abs(importeCliente + importeProveedor - bote) <= 0.01;
}

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

function getTransferidoProveedorFromBooking(booking) {
  if (booking.importe_transferido != null && booking.importe_transferido !== "") {
    return Number(booking.importe_transferido) || 0;
  }
  return getIngresoProveedorFromBooking(booking);
}

function getComisionHHFromBooking(booking) {
  const precio = Number(booking.precio_total) || 0;
  return precio - getTransferidoProveedorFromBooking(booking);
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

function getRevisionEstadoBadge(revisionEstado) {
  if (revisionEstado == null) {
    return { label: "Aprobado", bg: "#e6f4f0", color: "#085041" };
  }
  switch (revisionEstado) {
    case REVISION_EN_REVISION:
      return { label: "En revisión", bg: "#fdf4e7", color: "#92400e" };
    case REVISION_APROBADO:
      return { label: "Aprobado", bg: "#e6f4f0", color: "#085041" };
    case REVISION_RECHAZADO:
      return { label: "Rechazado", bg: "#fef2f2", color: "#b91c1c" };
    case REVISION_BORRADOR:
      return { label: "Borrador", bg: "#f3f4f6", color: "#666" };
    default:
      return { label: revisionEstado, bg: "#f3f4f6", color: "#666" };
  }
}

function fullName(profile) {
  return [profile.nombre, profile.apellido].filter(Boolean).join(" ") || "Sin nombre";
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
          <Navbar />
          <main className="mx-auto max-w-5xl px-4 py-16 text-center text-sm text-[#666]">
            Cargando panel de administración…
          </main>
        </div>
      }
    >
      <AdminPageInner />
    </Suspense>
  );
}

function AdminPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [servicesByProvider, setServicesByProvider] = useState({});
  const [activeTab, setActiveTab] = useState(() =>
    initialTabFromSearch(searchParams),
  );
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
  const [incidencias, setIncidencias] = useState([]);
  const [reembolsoModalInc, setReembolsoModalInc] = useState(null);
  const [reembolsoNota, setReembolsoNota] = useState("");
  const [reembolsoModalError, setReembolsoModalError] = useState("");
  const [liberarModalInc, setLiberarModalInc] = useState(null);
  const [liberarNota, setLiberarNota] = useState("");
  const [liberarModalError, setLiberarModalError] = useState("");
  const [repartoModalInc, setRepartoModalInc] = useState(null);
  const [repartoCliente, setRepartoCliente] = useState("");
  const [repartoProveedor, setRepartoProveedor] = useState("");
  const [repartoNota, setRepartoNota] = useState("");
  const [repartoModalError, setRepartoModalError] = useState("");
  const [reports, setReports] = useState([]);
  const [lateCancellations, setLateCancellations] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogFormOpen, setBlogFormOpen] = useState(false);
  const [blogForm, setBlogForm] = useState(EMPTY_BLOG_FORM);
  const [blogTagInput, setBlogTagInput] = useState("");
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult] = useState(null);
  const [blogSaving, setBlogSaving] = useState(false);
  const [blogSeeding, setBlogSeeding] = useState(false);
  const [usuariosSummary, setUsuariosSummary] = useState({ pendientes: 0, sin_dni: 0 });
  const [serviciosRevisionPendientes, setServiciosRevisionPendientes] = useState(0);
  const [suspensionesCount, setSuspensionesCount] = useState(0);
  const [cancelacionesActivas, setCancelacionesActivas] = useState(0);

  const loadData = useCallback(async () => {
    setErrorMessage("");

    try {
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
      const providersPayload = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(
          providersPayload.error || "Error al cargar proveedores",
        );
        return;
      }

      if (providersPayload.error) {
        setErrorMessage(
          typeof providersPayload.error === "string"
            ? providersPayload.error
            : providersPayload.error.message || "Error al cargar proveedores",
        );
        return;
      }

      const providerList = providersPayload.providers ?? [];
      setProviders(providerList);
      setServicesByProvider(providersPayload.servicesByProvider ?? {});
      setSuspensionesCount(
        providerList.filter((p) => p.suspendido_cautelar === true).length,
      );

      const usuariosRes = await fetch("/api/admin/usuarios?filtro=todos&limit=1");
      const usuariosPayload = await usuariosRes.json().catch(() => ({}));
      if (usuariosRes.ok && usuariosPayload.meta?.summary) {
        setUsuariosSummary(usuariosPayload.meta.summary);
      }

      try {
        const svcRevRes = await fetch("/api/admin/servicios/revision");
        const svcRevPayload = await svcRevRes.json().catch(() => ({}));
        if (svcRevRes.ok) {
          setServiciosRevisionPendientes(
            svcRevPayload.meta?.pendientes ??
              (svcRevPayload.servicios ?? []).length,
          );
        }
      } catch {
        /* ignore */
      }

      try {
        const cancRes = await fetch("/api/admin/cancelaciones?filtro=activas&limit=1");
        const cancPayload = await cancRes.json().catch(() => ({}));
        if (cancRes.ok) {
          setCancelacionesActivas(cancPayload.meta?.activas ?? 0);
        }
      } catch {
        /* tabla puede no existir aún */
      }

      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select(
          `
        id,
        precio_total,
        precio_base,
        cliente_sin_comision,
        proveedor_sin_comision,
        importe_transferido,
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

      const incidenciasRes = await fetch("/api/admin/incidencias");
      const incidenciasPayload = await incidenciasRes.json().catch(() => ({}));

      if (!incidenciasRes.ok) {
        setErrorMessage(
          incidenciasPayload.error || "Error al cargar incidencias",
        );
      } else {
        setIncidencias(incidenciasPayload.incidencias ?? []);
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
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Error al cargar el panel de administración",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setActiveTab(initialTabFromSearch(searchParams));
  }, [searchParams]);

  const counts = useMemo(() => {
    const result = {
      usuarios: usuariosSummary.pendientes,
      cancelaciones: cancelacionesActivas,
      "servicios-revision": serviciosRevisionPendientes,
      suspensiones: suspensionesCount,
      pendientes: 0,
      verificados: 0,
      rechazados: 0,
      reportes: 0,
      incidencias: 0,
      ingresos: 0,
      blog: 0,
    };
    for (const p of providers) {
      result[getProviderStatus(p)] += 1;
    }
    result.reportes = reports.filter((r) => r.estado === "pendiente").length;
    result.incidencias = incidencias.length;
    result.ingresos = completedBookings.length;
    result.blog = blogPosts.length;
    return result;
  }, [providers, completedBookings, reports, incidencias, blogPosts, usuariosSummary, cancelacionesActivas, serviciosRevisionPendientes, suspensionesCount]);

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
      totalTransferido += getTransferidoProveedorFromBooking(booking);
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

  async function handleConfirmarMayorDeEdadProveedor(provider) {
    if (!provider?.id) return;
    if (!provider.doc_dni_url) {
      setErrorMessage("Este proveedor no tiene DNI subido.");
      return;
    }

    setActionLoading(provider.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const res = await fetch("/api/admin/usuarios/confirmar-mayor-de-edad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: provider.id }),
      });
      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload.error || "No se pudo confirmar la mayoría de edad");
      }

      setSuccessMessage(
        payload.already_confirmed
          ? "La mayoría de edad ya estaba confirmada."
          : "Mayoría de edad (18+) confirmada. El proveedor ya puede activar servicios si cumple el resto de requisitos.",
      );
      await loadData();
    } catch (err) {
      setErrorMessage(err.message || "Error al confirmar la mayoría de edad");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleOpenProviderDni(provider) {
    if (!provider?.doc_dni_url) {
      setErrorMessage("Este proveedor no tiene DNI subido.");
      return;
    }

    setActionLoading(`dni-${provider.id}`);
    setErrorMessage("");

    try {
      const res = await fetch(
        `/api/admin/documento-url?storedUrl=${encodeURIComponent(provider.doc_dni_url)}`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.url) {
        throw new Error(payload.error || "No se pudo abrir el DNI");
      }
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setErrorMessage(err.message || "No se pudo abrir el DNI");
    } finally {
      setActionLoading(null);
    }
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

  function formatReembolsoError(result, response) {
    const parts = [
      result.step ? `[${result.step}]` : null,
      result.error,
      result.hint,
      result.stripe?.stripe_error,
      result.stripe_code ? `stripe_code=${result.stripe_code}` : null,
      result.stripe_type ? `stripe_type=${result.stripe_type}` : null,
      result.db_code ? `db_code=${result.db_code}` : null,
      !result.error && !response.ok ? `HTTP ${response.status}` : null,
    ].filter(Boolean);
    return parts.join(" — ") || "Error al procesar el reembolso.";
  }

  function formatLiberarProveedorError(result, response) {
    const parts = [
      result.step ? `[${result.step}]` : null,
      result.error,
      result.hint,
      result.stripe?.stripe_error,
      !result.error && !response.ok ? `HTTP ${response.status}` : null,
    ].filter(Boolean);
    return parts.join(" — ") || "Error al liberar el pago al proveedor.";
  }

  async function handleRepartoConfirm() {
    if (!repartoModalInc) return;

    const ic = parseEuroInput(repartoCliente);
    const ip = parseEuroInput(repartoProveedor);

    if (!repartoSumaValida(repartoModalInc, ic, ip)) {
      const msg = "Cliente + proveedor deben sumar exactamente el bote a repartir.";
      setRepartoModalError(msg);
      setErrorMessage(msg);
      return;
    }

    const bote =
      repartoModalInc.reparto?.bote ?? repartoModalInc.ingreso_proveedor_estimado ?? 0;
    const confirmMsg = [
      "¿Confirmar reparto?",
      "",
      `Al cliente: ${formatEuroAdmin(ic)}`,
      `Al proveedor: ${formatEuroAdmin(ip)}`,
      `Bote repartido: ${formatEuroAdmin(bote)}`,
      "",
      "H&H retiene sus comisiones fijas.",
    ].join("\n");

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setActionLoading(repartoModalInc.id);
    setErrorMessage("");
    setSuccessMessage("");
    setRepartoModalError("");

    try {
      const response = await fetch("/api/admin/incidencias/reparto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          bookingId: repartoModalInc.id,
          importeCliente: ic,
          importeProveedor: ip,
          nota: repartoNota.trim() || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const parts = [
          result.step ? `[${result.step}]` : null,
          result.error,
          result.hint,
          result.stripe?.stripe_error,
        ].filter(Boolean);
        const msg = parts.join(" — ") || "Error al ejecutar el reparto.";
        console.error("[admin] reparto failed", { status: response.status, result });
        setRepartoModalError(msg);
        setErrorMessage(msg);
        window.alert(`Error en reparto:\n\n${msg}`);
        return;
      }

      setRepartoModalInc(null);
      setRepartoCliente("");
      setRepartoProveedor("");
      setRepartoNota("");
      setRepartoModalError("");
      setSuccessMessage(
        result.already_processed
          ? "Esta incidencia ya tenía un reparto aplicado."
          : `Reparto aplicado: ${formatEuroAdmin(result.importe_cliente)} al cliente, ${formatEuroAdmin(result.importe_proveedor)} al proveedor.`,
      );
      await loadData();
    } catch (err) {
      const msg = err?.message || "Error de red al contactar con el servidor.";
      setRepartoModalError(msg);
      setErrorMessage(msg);
      window.alert(`Error en reparto:\n\n${msg}`);
    } finally {
      setActionLoading(null);
    }
  }

  function openRepartoModal(inc) {
    const bote = inc.reparto?.bote ?? inc.ingreso_proveedor_estimado ?? 0;
    const mitad = Math.round((bote / 2) * 100) / 100;
    setRepartoModalInc(inc);
    setRepartoCliente(String(mitad));
    setRepartoProveedor(String(Math.round((bote - mitad) * 100) / 100));
    setRepartoNota("");
    setRepartoModalError("");
  }

  function applyRepartoMitadMitad() {
    if (!repartoModalInc) return;
    const bote = repartoModalInc.reparto?.bote ?? repartoModalInc.ingreso_proveedor_estimado ?? 0;
    const mitad = Math.round((bote / 2) * 100) / 100;
    setRepartoCliente(String(mitad));
    setRepartoProveedor(String(Math.round((bote - mitad) * 100) / 100));
  }

  function onRepartoClienteChange(value) {
    setRepartoCliente(value);
    if (!repartoModalInc) return;
    const bote = repartoModalInc.reparto?.bote ?? repartoModalInc.ingreso_proveedor_estimado ?? 0;
    const ic = parseEuroInput(value);
    if (!Number.isNaN(ic)) {
      setRepartoProveedor(String(Math.max(0, Math.round((bote - ic) * 100) / 100)));
    }
  }

  function onRepartoProveedorChange(value) {
    setRepartoProveedor(value);
    if (!repartoModalInc) return;
    const bote = repartoModalInc.reparto?.bote ?? repartoModalInc.ingreso_proveedor_estimado ?? 0;
    const ip = parseEuroInput(value);
    if (!Number.isNaN(ip)) {
      setRepartoCliente(String(Math.max(0, Math.round((bote - ip) * 100) / 100)));
    }
  }

  async function handleLiberarProveedorConfirm() {
    if (!liberarModalInc) return;

    setActionLoading(liberarModalInc.id);
    setErrorMessage("");
    setSuccessMessage("");
    setLiberarModalError("");

    try {
      const response = await fetch("/api/admin/incidencias/liberar-proveedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          bookingId: liberarModalInc.id,
          nota: liberarNota.trim() || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = formatLiberarProveedorError(result, response);
        console.error("[admin] liberar-proveedor failed", {
          status: response.status,
          result,
        });
        setLiberarModalError(msg);
        setErrorMessage(msg);
        window.alert(`Error al liberar pago:\n\n${msg}`);
        return;
      }

      const importeProveedor =
        result.importe_proveedor ?? liberarModalInc.ingreso_proveedor_estimado;

      setLiberarModalInc(null);
      setLiberarNota("");
      setLiberarModalError("");
      setSuccessMessage(
        result.already_processed
          ? "Esta incidencia ya tenía el pago liberado al proveedor."
          : `Pago liberado al proveedor: ${formatEuroAdmin(importeProveedor)}.`,
      );
      await loadData();
    } catch (err) {
      const msg = err?.message || "Error de red al contactar con el servidor.";
      console.error("[admin] liberar-proveedor network error", err);
      setLiberarModalError(msg);
      setErrorMessage(msg);
      window.alert(`Error al liberar pago:\n\n${msg}`);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReembolsoTotalConfirm() {
    if (!reembolsoModalInc) return;

    setActionLoading(reembolsoModalInc.id);
    setErrorMessage("");
    setSuccessMessage("");
    setReembolsoModalError("");

    try {
      const response = await fetch("/api/admin/incidencias/reembolso-total", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          bookingId: reembolsoModalInc.id,
          nota: reembolsoNota.trim() || undefined,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = formatReembolsoError(result, response);
        console.error("[admin] reembolso-total failed", {
          status: response.status,
          result,
        });
        setReembolsoModalError(msg);
        setErrorMessage(msg);
        window.alert(`Error al reembolsar:\n\n${msg}`);
        return;
      }

      const importeReembolsado =
        result.reembolso?.bruto ?? reembolsoModalInc.precio_total;

      setReembolsoModalInc(null);
      setReembolsoNota("");
      setReembolsoModalError("");
      setSuccessMessage(
        result.already_processed
          ? "Esta incidencia ya tenía un reembolso total aplicado."
          : `Reembolso total aplicado: ${formatEuroAdmin(importeReembolsado)} al cliente.`,
      );
      await loadData();
    } catch (err) {
      const msg = err?.message || "Error de red al contactar con el servidor.";
      console.error("[admin] reembolso-total network error", err);
      setReembolsoModalError(msg);
      setErrorMessage(msg);
      window.alert(`Error al reembolsar:\n\n${msg}`);
    } finally {
      setActionLoading(null);
    }
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

  function openDocumentRequest(providerId, preselectedIds = [], missingLabels = []) {
    setRejectingId(null);
    setRejectReason("");
    setRequestingDocsId(providerId);
    setSelectedDocuments(preselectedIds);
    setRequestMessage(
      missingLabels.length > 0
        ? `Para activar tu servicio de niñera necesitamos que subas: ${missingLabels.join(", ")}.`
        : "",
    );
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
      const response = await fetch("/api/admin/solicitud-documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proveedor_id: provider.id,
          proveedor_nombre: fullName(provider),
          documentos: documentLabels,
          mensaje: requestMessage.trim() || "",
          asunto: "Home&Heart — Necesitamos documentación adicional",
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

  async function handleRunCronDiario() {
    setCronRunning(true);
    setCronResult(null);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/admin/run-cron", { method: "POST" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setErrorMessage(payload.error || "No se pudo ejecutar el cron diario.");
        setCronResult({ ok: false, summary: payload.error || "Error" });
        return;
      }

      const summary =
        payload.summary ||
        (payload.success
          ? "Cron ejecutado correctamente"
          : "Cron terminó con errores");
      setCronResult({
        ok: payload.success !== false,
        summary,
        tasks: payload.tasks,
        started_at: payload.started_at,
        finished_at: payload.finished_at,
      });
      if (payload.success !== false) {
        setSuccessMessage(summary);
      } else {
        setErrorMessage(summary);
      }
    } catch {
      setErrorMessage("Error de conexión al ejecutar el cron diario.");
      setCronResult({ ok: false, summary: "Error de conexión" });
    } finally {
      setCronRunning(false);
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
        {usuariosSummary.pendientes > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("usuarios")}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-opacity hover:opacity-90"
            style={{
              borderColor: "#f59e0b",
              backgroundColor: "#fffbeb",
              color: "#92400e",
            }}
          >
            <span className="text-sm font-semibold">
              DNIs pendientes de revisar ({usuariosSummary.pendientes})
            </span>
            <span className="shrink-0 text-xs font-medium underline">
              Ir a Usuarios →
            </span>
          </button>
        )}

        {serviciosRevisionPendientes > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("servicios-revision")}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-opacity hover:opacity-90"
            style={{
              borderColor: "#f59e0b",
              backgroundColor: "#fffbeb",
              color: "#92400e",
            }}
          >
            <span className="text-sm font-semibold">
              Servicios pendientes ({serviciosRevisionPendientes})
            </span>
            <span className="shrink-0 text-xs font-medium underline">
              Revisar servicios →
            </span>
          </button>
        )}

        {suspensionesCount > 0 && (
          <button
            type="button"
            onClick={() => setActiveTab("suspensiones")}
            className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-opacity hover:opacity-90"
            style={{
              borderColor: "#ef4444",
              backgroundColor: "#fef2f2",
              color: "#b91c1c",
            }}
          >
            <span className="text-sm font-semibold">
              🚨 Suspensiones cautelares pendientes ({suspensionesCount})
            </span>
            <span className="shrink-0 text-xs font-medium underline">
              Revisar →
            </span>
          </button>
        )}

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
                {tab.id !== "herramientas" && (
                  <span
                    className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold"
                    style={{
                      backgroundColor:
                        (tab.id === "usuarios" && usuariosSummary.pendientes > 0 && !isActive) ||
                        (tab.id === "servicios-revision" &&
                          serviciosRevisionPendientes > 0 &&
                          !isActive) ||
                        (tab.id === "suspensiones" && suspensionesCount > 0 && !isActive)
                          ? "#fef3c7"
                          : isActive
                            ? BRAND.primary
                            : "#eee",
                      color:
                        (tab.id === "usuarios" && usuariosSummary.pendientes > 0 && !isActive) ||
                        (tab.id === "servicios-revision" &&
                          serviciosRevisionPendientes > 0 &&
                          !isActive) ||
                        (tab.id === "suspensiones" && suspensionesCount > 0 && !isActive)
                          ? "#92400e"
                          : isActive
                            ? "#fff"
                            : "#666",
                    }}
                  >
                    {counts[tab.id]}
                  </span>
                )}
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

        {activeTab === "usuarios" ? (
          <AdminUsersTab
            onSuccess={(msg) => {
              setSuccessMessage(msg);
              setErrorMessage("");
              fetch("/api/admin/usuarios?filtro=todos&limit=1")
                .then((r) => r.json())
                .then((payload) => {
                  if (payload.meta?.summary) setUsuariosSummary(payload.meta.summary);
                })
                .catch(() => {});
            }}
            onError={(msg) => {
              setErrorMessage(msg);
              setSuccessMessage("");
            }}
          />
        ) : activeTab === "servicios-revision" ? (
          <AdminServiciosRevisionTab
            onSuccess={(msg) => {
              setSuccessMessage(msg);
              setErrorMessage("");
            }}
            onError={(msg) => {
              setErrorMessage(msg);
              setSuccessMessage("");
            }}
            onCountChange={(n) => setServiciosRevisionPendientes(n)}
          />
        ) : activeTab === "suspensiones" ? (
          <AdminSuspensionesCautelaresTab
            onSuccess={(msg) => {
              setSuccessMessage(msg);
              setErrorMessage("");
              loadData();
            }}
            onError={(msg) => {
              setErrorMessage(msg);
              setSuccessMessage("");
            }}
            onMeta={(n) => setSuspensionesCount(n)}
          />
        ) : activeTab === "cancelaciones" ? (
          <AdminCancelacionesTab
            onSuccess={(msg) => {
              setSuccessMessage(msg);
              setErrorMessage("");
              fetch("/api/admin/cancelaciones?filtro=activas&limit=1")
                .then((r) => r.json())
                .then((payload) => {
                  if (payload.meta) setCancelacionesActivas(payload.meta.activas ?? 0);
                })
                .catch(() => {});
            }}
            onError={(msg) => {
              setErrorMessage(msg);
              setSuccessMessage("");
            }}
          />
        ) : activeTab === "blog" ? (
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
        ) : activeTab === "incidencias" ? (
          <div className="mt-6">
            <p className="mb-4 text-sm text-[#666]">
              Reservas con conflicto abierto. Revisa el pago en Stripe antes de resolver.
            </p>

            {repartoModalInc && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reparto-modal-title"
              >
                <div
                  className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-xl"
                  style={{ borderColor: BRAND.border }}
                >
                  <h3
                    id="reparto-modal-title"
                    className="text-lg font-semibold text-[#1a1a1a]"
                  >
                    Reparto / reembolso parcial
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666]">
                    H&H retiene sus comisiones fijas. El resto (bote) se reparte entre cliente y
                    proveedor.
                  </p>

                  <div
                    className="mt-4 rounded-xl border p-4 text-sm"
                    style={{ borderColor: BRAND.border, backgroundColor: "#f7f5f2" }}
                  >
                    <div className="flex justify-between">
                      <span className="text-[#666]">Total pagado</span>
                      <span className="font-semibold">
                        {formatEuroAdmin(repartoModalInc.reparto?.precio_total ?? repartoModalInc.precio_total)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-[#888]">
                      <span>Comisión cliente (H&H)</span>
                      <span>
                        {formatEuroAdmin(repartoModalInc.reparto?.comision_cliente ?? 0)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-xs text-[#888]">
                      <span>Comisión proveedor (H&H)</span>
                      <span>
                        {formatEuroAdmin(repartoModalInc.reparto?.comision_proveedor ?? 0)}
                      </span>
                    </div>
                    <div className="mt-2 flex justify-between border-t pt-2" style={{ borderColor: BRAND.border }}>
                      <span className="font-semibold text-[#1a1a1a]">Bote a repartir</span>
                      <span className="font-bold" style={{ color: BRAND.primary }}>
                        {formatEuroAdmin(
                          repartoModalInc.reparto?.bote ??
                            repartoModalInc.ingreso_proveedor_estimado,
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                        Importe al cliente
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={repartoCliente}
                        onChange={(e) => onRepartoClienteChange(e.target.value)}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: BRAND.border }}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                        Importe al proveedor
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={repartoProveedor}
                        onChange={(e) => onRepartoProveedorChange(e.target.value)}
                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        style={{ borderColor: BRAND.border }}
                      />
                    </label>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={applyRepartoMitadMitad}
                      className="rounded-lg border px-3 py-1 text-xs font-medium text-[#666]"
                      style={{ borderColor: BRAND.border }}
                    >
                      Mitad y mitad
                    </button>
                    {(() => {
                      const bote =
                        repartoModalInc.reparto?.bote ??
                        repartoModalInc.ingreso_proveedor_estimado ??
                        0;
                      const ic = parseEuroInput(repartoCliente);
                      const ip = parseEuroInput(repartoProveedor);
                      const ok = repartoSumaValida(repartoModalInc, ic, ip);
                      return (
                        <span
                          className={`text-xs ${ok ? "text-emerald-700" : "text-amber-700"}`}
                        >
                          {ok
                            ? `Suma: ${formatEuroAdmin(ic + ip)} = bote ✓`
                            : `Deben sumar exactamente ${formatEuroAdmin(bote)} (actual: ${Number.isNaN(ic + ip) ? "—" : formatEuroAdmin(ic + ip)})`}
                        </span>
                      );
                    })()}
                  </div>

                  {repartoModalError && (
                    <p
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                      role="alert"
                    >
                      {repartoModalError}
                    </p>
                  )}

                  <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Nota interna (opcional)
                  </label>
                  <textarea
                    value={repartoNota}
                    onChange={(e) => setRepartoNota(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: BRAND.border }}
                    placeholder="Motivo o contexto para auditoría"
                  />

                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setRepartoModalInc(null);
                        setRepartoCliente("");
                        setRepartoProveedor("");
                        setRepartoNota("");
                        setRepartoModalError("");
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                      style={{ borderColor: BRAND.border }}
                      disabled={actionLoading === repartoModalInc.id}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleRepartoConfirm}
                      disabled={
                        actionLoading === repartoModalInc.id ||
                        !repartoSumaValida(
                          repartoModalInc,
                          parseEuroInput(repartoCliente),
                          parseEuroInput(repartoProveedor),
                        )
                      }
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#7c3aed" }}
                    >
                      {actionLoading === repartoModalInc.id
                        ? "Procesando…"
                        : "Confirmar reparto"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {liberarModalInc && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="liberar-modal-title"
              >
                <div
                  className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl"
                  style={{ borderColor: BRAND.border }}
                >
                  <h3
                    id="liberar-modal-title"
                    className="text-lg font-semibold text-[#1a1a1a]"
                  >
                    ¿Liberar pago al proveedor?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#666]">
                    Se pagarán{" "}
                    <strong>
                      {formatEuroAdmin(liberarModalInc.ingreso_proveedor_estimado)}
                    </strong>{" "}
                    al proveedor por{" "}
                    <strong>{liberarModalInc.servicio.titulo}</strong>. El cliente no
                    recibirá reembolso. La reserva quedará como incidencia resuelta.
                  </p>
                  {liberarModalInc.bundle?.is_bundle && (
                    <p
                      className="mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed text-[#92400e]"
                      style={{ borderColor: "#fcd34d", backgroundColor: "#fffbeb" }}
                    >
                      Bundle: esta acción no está disponible automáticamente para
                      PaymentIntents compartidos. Gestiona manualmente para no afectar
                      otras verticales.
                    </p>
                  )}
                  {liberarModalError && (
                    <p
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800"
                      role="alert"
                    >
                      {liberarModalError}
                    </p>
                  )}
                  <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Nota interna (opcional)
                  </label>
                  <textarea
                    value={liberarNota}
                    onChange={(e) => setLiberarNota(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: BRAND.border }}
                    placeholder="Motivo o contexto para auditoría"
                  />
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLiberarModalInc(null);
                        setLiberarNota("");
                        setLiberarModalError("");
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                      style={{ borderColor: BRAND.border }}
                      disabled={actionLoading === liberarModalInc.id}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleLiberarProveedorConfirm}
                      disabled={
                        actionLoading === liberarModalInc.id ||
                        liberarModalInc.bundle?.is_bundle
                      }
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {actionLoading === liberarModalInc.id
                        ? "Procesando…"
                        : "Confirmar liberación al proveedor"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {reembolsoModalInc && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="reembolso-modal-title"
              >
                <div
                  className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl"
                  style={{ borderColor: BRAND.border }}
                >
                  <h3
                    id="reembolso-modal-title"
                    className="text-lg font-semibold text-[#1a1a1a]"
                  >
                    {stripePagoYaLiberado(reembolsoModalInc.stripe?.status)
                      ? "¿Cerrar incidencia con reembolso total?"
                      : "¿Reembolsar todo al cliente?"}
                  </h3>
                  {stripePagoYaLiberado(reembolsoModalInc.stripe?.status) ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#666]">
                      El pago en Stripe ya está <strong>cancelado/liberado</strong>. Al
                      confirmar solo se cerrará la incidencia en la plataforma (sin volver a
                      tocar Stripe) por{" "}
                      <strong>{reembolsoModalInc.servicio.titulo}</strong> (
                      {formatEuroAdmin(reembolsoModalInc.precio_total)}).
                    </p>
                  ) : (
                    <p className="mt-2 text-sm leading-relaxed text-[#666]">
                      Se devolverán{" "}
                      <strong>{formatEuroAdmin(reembolsoModalInc.precio_total)}</strong> al
                      cliente por{" "}
                      <strong>{reembolsoModalInc.servicio.titulo}</strong>
                      {reembolsoModalInc.credito_aplicado > 0 && (
                        <>
                          {" "}
                          (incl. {formatEuroAdmin(reembolsoModalInc.credito_aplicado)} a
                          crédito)
                        </>
                      )}
                      . La reserva quedará como incidencia resuelta.
                    </p>
                  )}
                  {reembolsoModalInc.bundle?.is_bundle && (
                    <p
                      className="mt-3 rounded-lg border px-3 py-2 text-xs leading-relaxed text-[#92400e]"
                      style={{ borderColor: "#fcd34d", backgroundColor: "#fffbeb" }}
                    >
                      Bundle: solo se reembolsa este servicio. Si el pago estaba retenido,
                      el resto del PaymentIntent se capturará para las otras verticales.
                    </p>
                  )}
                  {reembolsoModalError && (
                    <p
                      className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800"
                      role="alert"
                    >
                      {reembolsoModalError}
                    </p>
                  )}
                  <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-[#888]">
                    Nota interna (opcional)
                  </label>
                  <textarea
                    value={reembolsoNota}
                    onChange={(e) => setReembolsoNota(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                    style={{ borderColor: BRAND.border }}
                    placeholder="Motivo o contexto para auditoría"
                  />
                  <div className="mt-5 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReembolsoModalInc(null);
                        setReembolsoNota("");
                        setReembolsoModalError("");
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium text-[#666]"
                      style={{ borderColor: BRAND.border }}
                      disabled={actionLoading === reembolsoModalInc.id}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleReembolsoTotalConfirm}
                      disabled={actionLoading === reembolsoModalInc.id}
                      className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#b91c1c" }}
                    >
                      {actionLoading === reembolsoModalInc.id
                        ? "Procesando…"
                        : stripePagoYaLiberado(reembolsoModalInc.stripe?.status)
                          ? "Confirmar cierre de incidencia"
                          : "Confirmar reembolso total"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {incidencias.length === 0 ? (
              <p
                className="rounded-2xl border bg-white px-6 py-10 text-center text-sm text-[#666]"
                style={{ borderColor: BRAND.border }}
              >
                No hay reservas en incidencia.
              </p>
            ) : (
              <ul className="flex flex-col gap-4">
                {incidencias.map((inc) => {
                  const stripeStyle = stripeStatusBadgeStyle(inc.stripe?.status);
                  return (
                    <li
                      key={inc.id}
                      className="rounded-2xl border bg-white p-6"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#1a1a1a]">
                            {inc.servicio.titulo}{" "}
                            <span className="font-normal text-[#888]">
                              · {inc.servicio.vertical_label}
                            </span>
                          </p>
                          <p className="mt-1 text-xs text-[#888]">
                            Reserva {inc.id.slice(0, 8)}… · {formatFechasReserva(inc)}
                            {inc.servicio.ciudad ? ` · ${inc.servicio.ciudad}` : ""}
                          </p>
                        </div>
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
                          style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}
                        >
                          Incidencia
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                            Cliente
                          </p>
                          <p className="mt-0.5 text-sm">{inc.cliente.nombre}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                            Proveedor
                          </p>
                          <p className="mt-0.5 text-sm">{inc.proveedor.nombre}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                            Importe cliente
                          </p>
                          <p className="mt-0.5 text-sm font-semibold" style={{ color: BRAND.primary }}>
                            {formatEuroAdmin(inc.precio_total)}
                          </p>
                          {inc.credito_aplicado > 0 && (
                            <p className="text-[10px] text-[#888]">
                              incl. {formatEuroAdmin(inc.credito_aplicado)} crédito
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                            Cobraría proveedor
                          </p>
                          <p className="mt-0.5 text-sm font-semibold" style={{ color: BRAND.primary }}>
                            {formatEuroAdmin(inc.ingreso_proveedor_estimado)}
                          </p>
                        </div>
                      </div>

                      {inc.reporte && (
                        <div
                          className="mt-4 rounded-xl border p-4"
                          style={{ borderColor: BRAND.border, backgroundColor: "#f7f5f2" }}
                        >
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                            Reporte · {formatDate(inc.reporte.created_at)}
                          </p>
                          <p className="mt-1 text-sm">
                            <span className="font-medium capitalize">
                              {inc.reporte.reporter_rol}
                            </span>
                            {inc.reporte.reporter_nombre
                              ? ` (${inc.reporte.reporter_nombre})`
                              : ""}
                            : {inc.reporte.motivo}
                          </p>
                          {inc.reporte.descripcion && (
                            <p className="mt-2 text-sm leading-relaxed text-[#444]">
                              {inc.reporte.descripcion}
                            </p>
                          )}
                        </div>
                      )}

                      <div
                        className="mt-4 rounded-xl border p-4"
                        style={{ borderColor: BRAND.border }}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#888]">
                          Pago Stripe
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                            style={{
                              backgroundColor: stripeStyle.bg,
                              color: stripeStyle.color,
                            }}
                          >
                            {inc.stripe?.status_label ?? "—"}
                          </span>
                          {inc.stripe?.status && (
                            <span className="text-xs text-[#888]">({inc.stripe.status})</span>
                          )}
                        </div>
                        {inc.payment_intent_id && (
                          <p className="mt-2 font-mono text-xs text-[#666]">
                            PI: {inc.payment_intent_id}
                          </p>
                        )}
                        {inc.stripe?.amount_authorized_eur != null && (
                          <p className="mt-1 text-xs text-[#666]">
                            Autorizado: {formatEuroAdmin(inc.stripe.amount_authorized_eur)}
                            {inc.stripe.amount_captured_eur != null &&
                            inc.stripe.amount_captured_eur > 0
                              ? ` · Capturado: ${formatEuroAdmin(inc.stripe.amount_captured_eur)}`
                              : ""}
                          </p>
                        )}
                        {inc.stripe?.error && (
                          <p className="mt-2 text-xs text-red-700">{inc.stripe.error}</p>
                        )}
                        {inc.pago_liberado_at && (
                          <p className="mt-2 text-xs text-amber-700">
                            pago_liberado_at: {formatDate(inc.pago_liberado_at)}
                          </p>
                        )}
                      </div>

                      {inc.bundle?.is_bundle && (
                        <div
                          className="mt-4 rounded-xl border px-4 py-3"
                          style={{ borderColor: "#fcd34d", backgroundColor: "#fffbeb" }}
                        >
                          <p className="text-sm font-semibold text-[#92400e]">
                            Bundle — PaymentIntent compartido
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[#78350f]">
                            {inc.bundle.bundle_note}
                          </p>
                          {inc.bundle.siblings?.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-[#78350f]">
                              {inc.bundle.siblings.map((sib) => (
                                <li key={sib.id}>
                                  · {sib.titulo} ({sib.vertical_label}) — estado: {sib.estado}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {puedeMostrarAccionesResolucionIncidencia(inc) && (
                        <div className="mt-4 flex flex-col gap-2 border-t pt-4" style={{ borderColor: BRAND.border }}>
                          {stripePagoYaLiberado(inc.stripe?.status) && (
                            <p className="text-xs leading-relaxed text-[#666]">
                              El pago ya se liberó en Stripe. Puedes confirmar para cerrar la
                              incidencia en la plataforma sin repetir el reembolso.
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {puedeRepartoIncidencia(inc) && (
                              <button
                                type="button"
                                onClick={() => openRepartoModal(inc)}
                                disabled={actionLoading === inc.id}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ backgroundColor: "#7c3aed" }}
                              >
                                Reparto / reembolso parcial
                              </button>
                            )}
                            {puedeLiberarPagoProveedor(inc) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setLiberarNota("");
                                  setLiberarModalError("");
                                  setLiberarModalInc(inc);
                                }}
                                disabled={actionLoading === inc.id}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                                style={{ backgroundColor: BRAND.primary }}
                              >
                                Liberar pago al proveedor
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setReembolsoNota("");
                                setReembolsoModalError("");
                                setReembolsoModalInc(inc);
                              }}
                              disabled={actionLoading === inc.id}
                              className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              style={{ backgroundColor: "#b91c1c" }}
                            >
                              {stripePagoYaLiberado(inc.stripe?.status)
                                ? "Cerrar incidencia (pago ya liberado)"
                                : "Reembolsar todo al cliente"}
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
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
                      const transferido = getTransferidoProveedorFromBooking(booking);
                      const comision = getComisionHHFromBooking(booking);
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
        ) : activeTab === "herramientas" ? (
          <div className="mt-6">
            <div
              className="rounded-2xl border bg-white p-6"
              style={{ borderColor: BRAND.border }}
            >
              <h2
                className="text-lg font-semibold text-[#1a1a1a]"
                style={{ fontFamily: SERIF }}
              >
                Mantenimiento
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[#666]">
                Ejecuta a mano la misma lógica del cron diario (actualizar
                estados de reservas, secuencias de email, tiempos de respuesta).
                Es seguro reejecutarlo: emails y notificaciones son idempotentes.
              </p>
              <button
                type="button"
                disabled={cronRunning}
                onClick={handleRunCronDiario}
                className="mt-5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}
              >
                {cronRunning
                  ? "Ejecutando…"
                  : "Ejecutar cron diario ahora"}
              </button>

              {cronResult && (
                <div
                  className="mt-5 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: cronResult.ok ? "#b7dfd2" : "#fecaca",
                    backgroundColor: cronResult.ok ? "#f0faf6" : "#fef2f2",
                    color: cronResult.ok ? "#085041" : "#b91c1c",
                  }}
                >
                  <p className="font-semibold">
                    {cronResult.ok
                      ? "Cron ejecutado correctamente"
                      : "Cron con errores"}
                  </p>
                  <p className="mt-1 leading-relaxed">{cronResult.summary}</p>
                  {cronResult.finished_at && (
                    <p className="mt-2 text-xs opacity-70">
                      Finalizado:{" "}
                      {new Date(cronResult.finished_at).toLocaleString("es-ES")}
                    </p>
                  )}
                </div>
              )}
            </div>
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
              const isOpeningDni = actionLoading === `dni-${provider.id}`;
              const hasAlojamiento = services.some((s) => s.vertical === "alojamiento");
              const mayorDeEdadOk = provider.mayor_de_edad_confirmada === true;
              const dniVerificado = provider.dni_estado === "verificado";
              const needsLegacyAgeConfirm =
                Boolean(provider.doc_dni_url) &&
                dniVerificado &&
                !mayorDeEdadOk;
              const docSummary = getMissingMandatoryDocumentsSummary(
                provider,
                provider.providerDocuments ?? [],
                services,
              );
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
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: provider.cobros_activos
                              ? "#e6f4f0"
                              : "#fdf4e7",
                            color: provider.cobros_activos ? "#085041" : "#92400e",
                          }}
                        >
                          Cobros: {provider.cobros_activos ? "activos ✓" : "pendientes"}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: provider.verificado ? "#e8f0fb" : "#fdf4e7",
                            color: provider.verificado ? "#163a6b" : "#92400e",
                          }}
                        >
                          {provider.verificado ? "Verificado ✓" : "Pendiente de verificar"}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            backgroundColor: mayorDeEdadOk ? "#e6f4f0" : "#fdf4e7",
                            color: mayorDeEdadOk ? "#085041" : "#92400e",
                          }}
                        >
                          {mayorDeEdadOk ? "18+ confirmada" : "18+ pendiente"}
                        </span>
                        {provider.suspendido_cautelar === true && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{ backgroundColor: "#fef2f2", color: "#b91c1c" }}
                          >
                            Suspensión cautelar
                          </span>
                        )}
                        {docSummary.missingCount > 0 && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              backgroundColor:
                                provider.verificado && provider.rechazado !== true
                                  ? "#fdf4e7"
                                  : "#fef2f2",
                              color:
                                provider.verificado && provider.rechazado !== true
                                  ? "#92400e"
                                  : "#b91c1c",
                            }}
                          >
                            Docs incompletos ({docSummary.missingCount})
                          </span>
                        )}
                      </div>
                      {needsLegacyAgeConfirm && (
                        <div
                          className="mt-3 rounded-xl border px-3 py-2.5 text-sm"
                          style={{
                            borderColor: "#fcd34d",
                            backgroundColor: "#fffbeb",
                            color: "#92400e",
                          }}
                        >
                          <p>
                            DNI ya verificado, pero falta confirmar mayoría de edad.
                            Abre el DNI, comprueba la fecha de nacimiento y confirma.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isBusy || isOpeningDni}
                              onClick={() => handleOpenProviderDni(provider)}
                              className="rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                              style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                            >
                              {isOpeningDni ? "Abriendo…" : "Ver DNI"}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy || isOpeningDni}
                              onClick={() =>
                                handleConfirmarMayorDeEdadProveedor(provider)
                              }
                              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              style={{ backgroundColor: "#085041" }}
                            >
                              {isBusy ? "Guardando…" : "Confirmar 18+ según el DNI"}
                            </button>
                          </div>
                        </div>
                      )}
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
                          const revisionBadge = getRevisionEstadoBadge(
                            svc.revision_estado,
                          );
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
                              <span
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                style={{
                                  backgroundColor: revisionBadge.bg,
                                  color: revisionBadge.color,
                                }}
                              >
                                {revisionBadge.label}
                              </span>
                              {svc.disponible && (
                                <span className="text-[10px] font-medium text-[#0e7a5c]">
                                  · Activo
                                </span>
                              )}
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

                  <AdminProviderDocuments
                    profile={provider}
                    providerDocuments={provider.providerDocuments ?? []}
                    services={services}
                    actionBusy={isBusy}
                    onNinosDocsUpdated={loadData}
                    onSolicitarDocumentosNinos={(requestableIds, missingLabels) =>
                      openDocumentRequest(
                        provider.id,
                        requestableIds,
                        missingLabels,
                      )
                    }
                  />

                  {provider.motivo_rechazo && activeTab === "rechazados" && (
                    <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      <strong>Motivo:</strong> {provider.motivo_rechazo}
                    </p>
                  )}

                  {(activeTab === "pendientes" || isRequestingDocs) && (
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
                            disabled={isBusy || !mayorDeEdadOk}
                            title={
                              mayorDeEdadOk
                                ? "Aprobar proveedor"
                                : "Confirma la mayoría de edad (18+) revisando el DNI antes de aprobar"
                            }
                            onClick={() => handleApprove(provider.id)}
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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
