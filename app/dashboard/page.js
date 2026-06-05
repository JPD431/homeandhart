"use client";

import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
);

const VERTICALS = {
  alojamiento: { label: "Alojamiento", priceSuffix: "/ noche" },
  ninos: { label: "Cuidado de niños", priceSuffix: "/ hora" },
  mascotas: { label: "Cuidado de mascotas", priceSuffix: "/ día" },
};

const STATUS_STYLES = {
  pendiente: { bg: "#fef3c7", color: "#92400e", label: "Pendiente" },
  confirmada: { bg: BRAND.light, color: BRAND.primary, label: "Confirmada" },
  en_curso: { bg: "#e0e7ff", color: "#3730a3", label: "En curso" },
  completada: { bg: "#dcfce7", color: "#166534", label: "Completada" },
  incidencia: { bg: "#fee2e2", color: "#b91c1c", label: "Incidencia" },
  cancelada: { bg: "#f3f4f6", color: "#6b7280", label: "Cancelada" },
};

// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS confirmacion_cliente boolean DEFAULT false;
// -- ALTER TABLE bookings ADD COLUMN IF NOT EXISTS incidencia_descripcion text;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id text;
// -- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

function getCardBrandLabel(brand) {
  const labels = {
    visa: "Visa",
    mastercard: "Mastercard",
    amex: "American Express",
  };
  return labels[brand] ?? (brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : "Tarjeta");
}

function AddCardForm({ onSuccess, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    setError("");

    const { error: confirmError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard`,
      },
      redirect: "if_required",
    });

    setSaving(false);

    if (confirmError) {
      setError(confirmError.message);
      return;
    }

    onSuccess();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
      <PaymentElement />
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={!stripe || saving}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: BRAND.primary }}
        >
          {saving ? "Guardando…" : "Guardar tarjeta"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#666] transition-colors hover:bg-[#f7f5f2]"
          style={{ borderColor: BRAND.border }}
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function getBookingEstado(booking) {
  return booking.estado ?? booking.status;
}

function isFechaFinPast24h(fechaFin) {
  if (!fechaFin) return false;
  const end = new Date(`${fechaFin}T23:59:59`);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return end.getTime() < cutoff;
}

function needsClientConfirmation(booking) {
  if (booking.confirmacion_cliente) return false;
  if (!booking.payment_intent_id) return false;
  const estado = getBookingEstado(booking);
  if (estado === "incidencia" || estado === "cancelada" || estado === "pendiente") {
    return false;
  }
  if (estado === "en_curso") return true;
  if (estado === "completada") return true;
  return false;
}

async function capturePayment(paymentIntentId, proveedores) {
  const res = await fetch("/api/stripe/capture-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paymentIntentId, proveedores }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error || "No se pudo liberar el pago.");
  }
  return data;
}

async function buildProveedoresForPayment(booking, allBookings) {
  const reservasGrupo = allBookings.filter(
    (b) =>
      b.payment_intent_id &&
      b.payment_intent_id === booking.payment_intent_id,
  );
  console.log("Reservas del grupo:", reservasGrupo);

  if (reservasGrupo.length === 0) return [];

  const serviciosIds = [
    ...new Set(reservasGrupo.map((b) => b.service_id).filter(Boolean)),
  ];
  console.log("Servicios de las reservas:", serviciosIds);

  if (serviciosIds.length === 0) return [];

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select(
      `
      id,
      proveedor_id,
      profiles!proveedor_id (
        id,
        stripe_account_id
      )
    `,
    )
    .in("id", serviciosIds);

  if (servicesError) {
    console.log("Error al cargar servicios/proveedores:", servicesError);
    return [];
  }

  console.log("Servicios con perfiles:", services);

  const proveedores = [];
  const processedProveedorIds = new Set();

  for (const service of services ?? []) {
    const proveedorId = service.proveedor_id;
    const profile = service.profiles;
    const stripeAccountId = profile?.stripe_account_id;

    if (!proveedorId || processedProveedorIds.has(proveedorId)) continue;

    if (!stripeAccountId) {
      console.log(
        "Proveedor sin stripe_account_id:",
        proveedorId,
        profile,
      );
      processedProveedorIds.add(proveedorId);
      continue;
    }

    const serviceIdsForProvider = (services ?? [])
      .filter((s) => s.proveedor_id === proveedorId)
      .map((s) => s.id);

    const amount = reservasGrupo
      .filter((b) => serviceIdsForProvider.includes(b.service_id))
      .reduce((sum, b) => {
        const precioBase = (Number(b.precio_total) || 0) / 1.14; // quitar 14% cliente
        const netoProveedor = precioBase * 0.96; // quitar 4% comision H&H
        return sum + netoProveedor;
      }, 0);

    if (amount > 0) {
      proveedores.push({
        stripe_account_id: stripeAccountId,
        amount,
      });
    }

    processedProveedorIds.add(proveedorId);
  }

  return proveedores;
}

function Section({ title, children }) {
  return (
    <section
      className="rounded-2xl border bg-white p-6 sm:p-8"
      style={{ borderColor: BRAND.border }}
    >
      <h2
        className="text-xl font-semibold text-[#1a1a1a]"
        style={{ fontFamily: SERIF }}
      >
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StatusBadge({ status }) {
  const key = status?.toLowerCase?.() ?? "pendiente";
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.pendiente;
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

function formatPrice(precio, vertical) {
  const config = VERTICALS[vertical] ?? VERTICALS.alojamiento;
  if (precio == null || precio === "") return "Consultar";
  return `${Number(precio)}€${config.priceSuffix}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());
  const [incidentBookingId, setIncidentBookingId] = useState(null);
  const [incidentText, setIncidentText] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [bookingFeedback, setBookingFeedback] = useState({});
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [stripeCustomerId, setStripeCustomerId] = useState(null);
  const [savedPaymentMethods, setSavedPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [showAddCard, setShowAddCard] = useState(false);
  const [setupClientSecret, setSetupClientSecret] = useState(null);
  const [paymentMethodError, setPaymentMethodError] = useState("");
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);
  const [roleSwitchLoading, setRoleSwitchLoading] = useState(false);
  const [roleSwitchError, setRoleSwitchError] = useState("");

  async function handleBecomeProvider() {
    if (!profile?.id) return;

    setRoleSwitchLoading(true);
    setRoleSwitchError("");

    const { error } = await supabase
      .from("profiles")
      .update({ role: "proveedor" })
      .eq("id", profile.id);

    setRoleSwitchLoading(false);

    if (error) {
      setRoleSwitchError(error.message);
      return;
    }

    window.location.reload();
  }

  async function handleConfirmSwitchToClient() {
    if (!profile?.id) return;

    setRoleSwitchLoading(true);
    setRoleSwitchError("");

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ role: "cliente" })
      .eq("id", profile.id);

    if (profileError) {
      setRoleSwitchLoading(false);
      setRoleSwitchError(profileError.message);
      return;
    }

    const { error: servicesError } = await supabase
      .from("services")
      .update({ disponible: false })
      .eq("proveedor_id", profile.id);

    setRoleSwitchLoading(false);
    setShowRoleSwitchModal(false);

    if (servicesError) {
      setRoleSwitchError(servicesError.message);
      return;
    }

    window.location.reload();
  }

  async function completeBookingWithCapture(booking, allBookings) {
    const proveedores = await buildProveedoresForPayment(booking, allBookings);
    console.log("Intentando liberar pago:", booking.payment_intent_id);
    console.log("Proveedores:", proveedores);
    await capturePayment(booking.payment_intent_id, proveedores);

    const relatedIds = allBookings
      .filter((b) => b.payment_intent_id === booking.payment_intent_id)
      .map((b) => b.id);

    const { error } = await supabase
      .from("bookings")
      .update({
        estado: "completada",
        confirmacion_cliente: true,
      })
      .in("id", relatedIds);

    if (error) throw new Error(error.message);
  }

  async function runAutoCaptureForBookings(clientBookings, userId) {
    const eligible = clientBookings.filter(
      (b) =>
        getBookingEstado(b) === "confirmada" &&
        !b.confirmacion_cliente &&
        b.payment_intent_id &&
        isFechaFinPast24h(b.fecha_fin),
    );

    if (eligible.length === 0) return clientBookings;

    const capturedPaymentIntents = new Set();

    for (const booking of eligible) {
      if (capturedPaymentIntents.has(booking.payment_intent_id)) continue;
      capturedPaymentIntents.add(booking.payment_intent_id);
      // try {
      //   await completeBookingWithCapture(booking, clientBookings);
      // } catch {
      //   // Siguiente reserva si una falla
      // }
    }

    const { data: refreshed } = await supabase
      .from("bookings")
      .select("*")
      .eq("cliente_id", userId)
      .order("created_at", { ascending: false });

    return refreshed ?? clientBookings;
  }

  useEffect(() => {
    async function loadDashboard() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      setProfile(profileData ?? null);

      if (profileData?.role === "proveedor") {
        const { data: servicesData } = await supabase
          .from("services")
          .select("*")
          .eq("proveedor_id", user.id);

        const providerServices = servicesData ?? [];
        setServices(providerServices);

        const serviceIds = providerServices.map((s) => s.id);
        if (serviceIds.length > 0) {
          const { data: bookingsData } = await supabase
            .from("bookings")
            .select("*")
            .in("service_id", serviceIds)
            .order("created_at", { ascending: false });

          setBookings(bookingsData ?? []);
        } else {
          setBookings([]);
        }
      } else {
        const { data: bookingsData } = await supabase
          .from("bookings")
          .select("*")
          .eq("cliente_id", user.id)
          .order("created_at", { ascending: false });

        let clientBookings = bookingsData ?? [];
        // clientBookings = await runAutoCaptureForBookings(clientBookings, user.id);
        setBookings(clientBookings);

        if (clientBookings.length > 0) {
          const bookingIds = clientBookings.map((b) => b.id);
          const { data: reviewsData } = await supabase
            .from("reviews")
            .select("booking_id")
            .in("booking_id", bookingIds);

          setReviewedBookingIds(
            new Set((reviewsData ?? []).map((r) => r.booking_id)),
          );
        } else {
          setReviewedBookingIds(new Set());
        }

        setPaymentMethodsLoading(true);
        try {
          const nombre = [profileData?.nombre, profileData?.apellido]
            .filter(Boolean)
            .join(" ");
          const customerRes = await fetch("/api/stripe/customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              nombre: nombre || "Cliente",
              customer_id: profileData?.stripe_customer_id || undefined,
            }),
          });
          const customerData = await customerRes.json();

          if (customerRes.ok && customerData.customer_id) {
            setStripeCustomerId(customerData.customer_id);
            setSavedPaymentMethods(customerData.paymentMethods ?? []);

            if (customerData.customer_id !== profileData?.stripe_customer_id) {
              await supabase
                .from("profiles")
                .update({ stripe_customer_id: customerData.customer_id })
                .eq("id", user.id);
            }
          }
        } catch {
          setSavedPaymentMethods([]);
        } finally {
          setPaymentMethodsLoading(false);
        }
      }

      setLoading(false);
    }

    loadDashboard();
  }, [router]);

  async function handleConfirmService(booking) {
    setActionLoadingId(booking.id);
    setBookingFeedback((prev) => {
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });

    try {
      await completeBookingWithCapture(booking, bookings);
      setBookings((prev) =>
        prev.map((b) =>
          b.payment_intent_id === booking.payment_intent_id
            ? { ...b, estado: "completada", confirmacion_cliente: true }
            : b,
        ),
      );
      setBookingFeedback((prev) => ({
        ...prev,
        [booking.id]: {
          type: "released",
          message: "¡Pago liberado al proveedor!",
        },
      }));
      setIncidentBookingId(null);
    } catch (err) {
      setBookingFeedback((prev) => ({
        ...prev,
        [booking.id]: { type: "error", message: err.message },
      }));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleSubmitIncident(booking) {
    const descripcion = incidentText.trim();
    if (!descripcion) return;

    setActionLoadingId(booking.id);
    setBookingFeedback((prev) => {
      const next = { ...prev };
      delete next[booking.id];
      return next;
    });

    try {
      const { error } = await supabase
        .from("bookings")
        .update({
          estado: "incidencia",
          incidencia_descripcion: descripcion,
        })
        .eq("id", booking.id);

      if (error) throw new Error(error.message);

      await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "incidencia",
          booking_id: booking.id,
          cliente_nombre:
            [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") ||
            "Cliente",
          fecha_inicio: booking.fecha_inicio,
          fecha_fin: booking.fecha_fin,
          descripcion,
        }),
      });

      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                estado: "incidencia",
                incidencia_descripcion: descripcion,
              }
            : b,
        ),
      );
      setBookingFeedback((prev) => ({
        ...prev,
        [booking.id]: {
          type: "incident",
          message:
            "Incidencia registrada. Nuestro equipo la revisará en menos de 24h.",
        },
      }));
      setIncidentBookingId(null);
      setIncidentText("");
    } catch (err) {
      setBookingFeedback((prev) => ({
        ...prev,
        [booking.id]: { type: "error", message: err.message },
      }));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function ensureStripeCustomer() {
    if (stripeCustomerId) return stripeCustomerId;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !profile?.id) return null;

    const nombre = [profile.nombre, profile.apellido].filter(Boolean).join(" ");
    const res = await fetch("/api/stripe/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: profile.email_contacto || user.email,
        nombre: nombre || "Cliente",
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) return null;

    setStripeCustomerId(data.customer_id);
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: data.customer_id })
      .eq("id", profile.id);

    return data.customer_id;
  }

  async function handleAddCard() {
    setPaymentMethodError("");
    setPaymentMethodsLoading(true);

    try {
      const customerId = await ensureStripeCustomer();
      if (!customerId) throw new Error("No se pudo crear el cliente de Stripe.");

      const res = await fetch("/api/stripe/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setup_intent",
          customer_id: customerId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo iniciar el alta de tarjeta.");
      }

      setSetupClientSecret(data.clientSecret);
      setShowAddCard(true);
    } catch (err) {
      setPaymentMethodError(err.message);
    } finally {
      setPaymentMethodsLoading(false);
    }
  }

  async function handleDeleteCard(paymentMethodId) {
    setPaymentMethodError("");

    try {
      const res = await fetch("/api/stripe/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "detach",
          payment_method_id: paymentMethodId,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo eliminar la tarjeta.");
      }

      setSavedPaymentMethods((prev) =>
        prev.filter((pm) => pm.id !== paymentMethodId),
      );
    } catch (err) {
      setPaymentMethodError(err.message);
    }
  }

  async function refreshPaymentMethods() {
    if (!stripeCustomerId) return;

    const res = await fetch("/api/stripe/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: stripeCustomerId }),
    });
    const data = await res.json();
    if (res.ok) {
      setSavedPaymentMethods(data.paymentMethods ?? []);
    }
  }

  async function handleConnectBankAccount() {
    setConnectError("");
    setConnectingStripe(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || !profile?.id) {
        throw new Error("No se pudo identificar tu cuenta.");
      }

      const email = profile.email_contacto || user.email;
      if (!email) {
        throw new Error("Añade un email en tu perfil para conectar Stripe.");
      }

      const res = await fetch("/api/stripe/connect/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          proveedor_id: profile.id,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "No se pudo iniciar la conexión con Stripe.");
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ stripe_account_id: data.accountId })
        .eq("id", profile.id);

      if (updateError) throw new Error(updateError.message);

      window.location.href = data.url;
    } catch (err) {
      setConnectError(err.message);
      setConnectingStripe(false);
    }
  }

  const isProvider = profile?.role === "proveedor";
  const greetingName = profile?.nombre?.trim();
  const stripeReturn = searchParams.get("stripe");

  if (loading) {
    return (
      <div
        className="min-h-screen font-sans"
        style={{ backgroundColor: BRAND.warm }}
      >
        <Navbar />
        <main className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando tu panel…
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <header>
          <h1
            className="text-3xl font-bold text-[#1a1a1a] sm:text-4xl"
            style={{ fontFamily: SERIF }}
          >
            {greetingName ? `Hola, ${greetingName}` : "Hola"}
          </h1>
          <p className="mt-2 text-lg text-[#5c5c5c]">
            {isProvider ? "Tu panel de proveedor" : "Tu panel de cliente"}
          </p>
        </header>

        {isProvider ? (
          <>
            <Section title="Mis servicios">
              {services.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-[#666]">
                    Aún no has publicado ningún servicio.
                  </p>
                  <Link
                    href="/ser-proveedor"
                    className="mt-4 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Publicar mi primer servicio
                  </Link>
                </div>
              ) : (
                <>
                  <ul className="flex flex-col gap-3">
                    {services.map((service) => {
                      const vertical =
                        VERTICALS[service.vertical] ?? VERTICALS.alojamiento;
                      return (
                        <li
                          key={service.id}
                          className="flex flex-col gap-2 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          style={{ borderColor: BRAND.border }}
                        >
                          <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-[#888]">
                              {vertical.label}
                            </p>
                            <p className="font-semibold text-[#1a1a1a]">
                              {service.titulo || vertical.label}
                            </p>
                          </div>
                          <p
                            className="text-lg font-bold"
                            style={{ color: BRAND.primary }}
                          >
                            {formatPrice(service.precio, service.vertical)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <Link
                    href="/ser-proveedor"
                    className="mt-5 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Añadir servicio
                  </Link>
                </>
              )}
            </Section>

            <Section title="Cuenta bancaria">
              {profile?.stripe_account_id ? (
                <p className="text-sm font-semibold text-green-700">
                  Cuenta bancaria conectada ✓
                </p>
              ) : (
                <>
                  <p className="text-sm text-[#666]">
                    Conecta tu cuenta para recibir los pagos de tus reservas.
                  </p>
                  {connectError && (
                    <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {connectError}
                    </p>
                  )}
                  <button
                    type="button"
                    disabled={connectingStripe}
                    onClick={handleConnectBankAccount}
                    className="mt-4 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {connectingStripe
                      ? "Conectando…"
                      : "Conectar cuenta bancaria 🏦"}
                  </button>
                </>
              )}
              {stripeReturn === "success" && profile?.stripe_account_id && (
                <p className="mt-3 text-sm text-green-700">
                  Configuración de Stripe completada correctamente.
                </p>
              )}
              {stripeReturn === "refresh" && !profile?.stripe_account_id && (
                <p className="mt-3 text-sm text-[#666]">
                  Puedes reintentar la conexión cuando quieras.
                </p>
              )}
            </Section>

            <Section title="Reservas recibidas">
              {bookings.length === 0 ? (
                <p className="text-sm text-[#666]">
                  Aún no has recibido reservas.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex flex-col gap-2 rounded-xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderColor: BRAND.border }}
                    >
                      <div>
                        <p className="font-medium text-[#1a1a1a]">
                          Reserva #{booking.id?.slice?.(0, 8) ?? "—"}
                        </p>
                        {booking.fecha_inicio && (
                          <p className="mt-0.5 text-xs text-[#888]">
                            {booking.fecha_inicio}
                            {booking.fecha_fin ? ` — ${booking.fecha_fin}` : ""}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={booking.estado ?? booking.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Mi perfil">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {[profile?.nombre, profile?.apellido]
                      .filter(Boolean)
                      .join(" ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Ciudad
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.ciudad || profile?.location_zone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Descripción
                  </dt>
                  <dd className="mt-0.5 leading-relaxed text-[#5c5c5c]">
                    {profile?.descripcion || "—"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                disabled={roleSwitchLoading}
                onClick={() => setShowRoleSwitchModal(true)}
                className="mt-5 w-full rounded-xl border px-5 py-2.5 text-sm font-semibold text-[#666] transition-colors hover:bg-[#f7f5f2] disabled:opacity-60 sm:w-auto"
                style={{ borderColor: BRAND.border }}
              >
                {roleSwitchLoading ? "Procesando…" : "Cambiar a modo cliente"}
              </button>

              <Link
                href="/editar-perfil"
                className="mt-3 inline-block rounded-xl border px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                Editar perfil
              </Link>
            </Section>
          </>
        ) : (
          <>
            <Section title="Mis reservas">
              {bookings.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-[#666]">
                    Aún no tienes reservas. Empieza a explorar proveedores.
                  </p>
                  <Link
                    href="/buscar"
                    className="mt-4 inline-block rounded-xl px-5 py-3 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    Buscar proveedores
                  </Link>
                </div>
              ) : (
                <ul className="flex flex-col gap-4">
                  {bookings.map((booking) => {
                    const estado = getBookingEstado(booking);
                    const showConfirmation = needsClientConfirmation(booking);
                    const feedback = bookingFeedback[booking.id];
                    const isIncidentOpen = incidentBookingId === booking.id;
                    const isLoading = actionLoadingId === booking.id;
                    const canReview =
                      estado === "completada" &&
                      booking.confirmacion_cliente &&
                      !reviewedBookingIds.has(booking.id);
                    const showReviewAfterRelease = feedback?.type === "released";

                    return (
                      <li
                        key={booking.id}
                        className="flex flex-col gap-3 rounded-xl border px-4 py-4"
                        style={{ borderColor: BRAND.border }}
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-medium text-[#1a1a1a]">
                              Reserva #{booking.id?.slice?.(0, 8) ?? "—"}
                            </p>
                            {booking.fecha_inicio && (
                              <p className="mt-0.5 text-xs text-[#888]">
                                {booking.fecha_inicio}
                                {booking.fecha_fin ? ` — ${booking.fecha_fin}` : ""}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={estado} />
                            {canReview && !showReviewAfterRelease && (
                              <Link
                                href={`/resena/${booking.id}`}
                                className="rounded-xl border px-3 py-1.5 text-xs font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                                style={{
                                  borderColor: BRAND.primary,
                                  color: BRAND.primary,
                                }}
                              >
                                Valorar
                              </Link>
                            )}
                          </div>
                        </div>

                        {showConfirmation && !isIncidentOpen && (
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => handleConfirmService(booking)}
                              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                              style={{ backgroundColor: "#16a34a" }}
                            >
                              {isLoading ? "Procesando…" : "✅ Todo fue bien"}
                            </button>
                            <button
                              type="button"
                              disabled={isLoading}
                              onClick={() => {
                                setIncidentBookingId(booking.id);
                                setIncidentText("");
                                setBookingFeedback((prev) => {
                                  const next = { ...prev };
                                  delete next[booking.id];
                                  return next;
                                });
                              }}
                              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                              style={{ backgroundColor: "#dc2626" }}
                            >
                              ⚠️ Hubo un problema
                            </button>
                          </div>
                        )}

                        {showConfirmation && isIncidentOpen && (
                          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50/50 p-4">
                            <label
                              htmlFor={`incident-${booking.id}`}
                              className="text-sm font-medium text-[#444]"
                            >
                              Describe el problema
                            </label>
                            <textarea
                              id={`incident-${booking.id}`}
                              rows={3}
                              value={incidentText}
                              onChange={(e) => setIncidentText(e.target.value)}
                              className="w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-red-200"
                            />
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <button
                                type="button"
                                disabled={isLoading || !incidentText.trim()}
                                onClick={() => handleSubmitIncident(booking)}
                                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                                style={{ backgroundColor: "#dc2626" }}
                              >
                                {isLoading ? "Enviando…" : "Enviar incidencia"}
                              </button>
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => {
                                  setIncidentBookingId(null);
                                  setIncidentText("");
                                }}
                                className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#666] transition-colors hover:bg-white"
                                style={{ borderColor: BRAND.border }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {feedback?.type === "released" && (
                          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
                            {feedback.message}
                          </p>
                        )}

                        {feedback?.type === "incident" && (
                          <p className="rounded-lg bg-[#e8f0fb] px-3 py-2 text-sm text-[#1d4f91]">
                            {feedback.message}
                          </p>
                        )}

                        {feedback?.type === "error" && (
                          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                            {feedback.message}
                          </p>
                        )}

                        {(showReviewAfterRelease || canReview) && (
                          <Link
                            href={`/resena/${booking.id}`}
                            className="inline-flex w-full justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white no-underline transition-opacity hover:opacity-90 sm:w-auto"
                            style={{ backgroundColor: BRAND.primary }}
                          >
                            Dejar una valoración
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section title="Mis favoritos">
              <p className="text-sm text-[#666]">
                Próximamente podrás guardar tus proveedores favoritos.
              </p>
            </Section>

            <Section title="Mi perfil">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Nombre
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.nombre || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Apellido
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.apellido || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-[#888]">
                    Ciudad
                  </dt>
                  <dd className="mt-0.5 text-[#1a1a1a]">
                    {profile?.ciudad || profile?.location_zone || "—"}
                  </dd>
                </div>
              </dl>

              <div
                className="mt-6 border-t pt-6"
                style={{ borderColor: BRAND.border }}
              >
                <h3 className="text-base font-semibold text-[#1a1a1a]">
                  Métodos de pago
                </h3>

                {paymentMethodError && (
                  <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                    {paymentMethodError}
                  </p>
                )}

                {paymentMethodsLoading ? (
                  <p className="mt-3 text-sm text-[#666]">Cargando tarjetas…</p>
                ) : savedPaymentMethods.length === 0 ? (
                  <p className="mt-2 text-sm text-[#666]">
                    No tienes tarjetas guardadas.
                  </p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-2">
                    {savedPaymentMethods.map((pm) => (
                      <li
                        key={pm.id}
                        className="flex items-center justify-between gap-3 rounded-xl border px-4 py-3"
                        style={{ borderColor: BRAND.border }}
                      >
                        <span className="text-sm font-medium text-[#1a1a1a]">
                          {getCardBrandLabel(pm.card?.brand)} ···· {pm.card?.last4}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCard(pm.id)}
                          className="text-sm font-semibold text-red-600 hover:underline"
                        >
                          Eliminar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {showAddCard && setupClientSecret ? (
                  <Elements
                    key={setupClientSecret}
                    stripe={stripePromise}
                    options={{ clientSecret: setupClientSecret }}
                  >
                    <AddCardForm
                      onSuccess={async () => {
                        setShowAddCard(false);
                        setSetupClientSecret(null);
                        await refreshPaymentMethods();
                      }}
                      onCancel={() => {
                        setShowAddCard(false);
                        setSetupClientSecret(null);
                      }}
                    />
                  </Elements>
                ) : (
                  <button
                    type="button"
                    disabled={paymentMethodsLoading}
                    onClick={handleAddCard}
                    className="mt-4 rounded-xl border px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-[#e8f0fb] disabled:opacity-60"
                    style={{ borderColor: BRAND.primary, color: BRAND.primary }}
                  >
                    Añadir tarjeta
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={roleSwitchLoading}
                onClick={handleBecomeProvider}
                className="mt-5 w-full rounded-xl border px-5 py-2.5 text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-60 sm:w-auto"
                style={{
                  borderColor: BRAND.primary,
                  backgroundColor: BRAND.light,
                  color: BRAND.primary,
                }}
              >
                {roleSwitchLoading
                  ? "Procesando…"
                  : "Quiero ser proveedor también →"}
              </button>

              {roleSwitchError && !showRoleSwitchModal && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {roleSwitchError}
                </p>
              )}

              <Link
                href="/editar-perfil"
                className="mt-3 inline-block rounded-xl border px-5 py-2.5 text-sm font-semibold no-underline transition-colors hover:bg-[#e8f0fb]"
                style={{ borderColor: BRAND.primary, color: BRAND.primary }}
              >
                Editar perfil
              </Link>
            </Section>
          </>
        )}
      </main>

      {showRoleSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div
            className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-lg"
            style={{ borderColor: BRAND.border }}
          >
            <p className="text-lg font-semibold text-[#1a1a1a]">
              ¿Seguro que quieres cambiar a modo cliente?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#666]">
              Tu perfil de proveedor y servicios se desactivarán temporalmente.
            </p>

            {roleSwitchError && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {roleSwitchError}
              </p>
            )}

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={roleSwitchLoading}
                onClick={() => {
                  setShowRoleSwitchModal(false);
                  setRoleSwitchError("");
                }}
                className="rounded-xl border px-4 py-2.5 text-sm font-semibold text-[#666] transition-colors hover:bg-[#f7f5f2] disabled:opacity-60"
                style={{ borderColor: BRAND.border }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={roleSwitchLoading}
                onClick={handleConfirmSwitchToClient}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: BRAND.primary }}
              >
                {roleSwitchLoading ? "Procesando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
