"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/Navbar";
import ClienteVerificadoBadge from "@/app/components/ClienteVerificadoBadge";
import DataLoadFailed from "@/app/components/DataLoadFailed";
import {
  CONTACT_FILTER_BANNER,
  CONTACT_FILTER_NOTICE,
} from "@/app/lib/chat-content-filter";
import { useModo } from "@/app/lib/ModoContext";
import { supabase } from "@/app/lib/supabase";
import { friendlyLoadError, withLoadTimeout } from "@/app/lib/with-load-timeout";

const BLUE = "#1d4f91";
const AMBER = "#c47d1a";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const DARK = "#2a3a4a";

const VERTICAL_COLORS = {
  alojamiento: "#1d4f91",
  ninos: "#0e7a5c",
  mascotas: "#c47d1a",
};

const VERTICAL_LABELS = {
  alojamiento: "Alojamiento",
  ninos: "Cuidado de niños",
  mascotas: "Cuidado de mascotas",
};

const hideScrollbar = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
};

const inputClass =
  "w-full rounded-xl border px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:ring-2 focus:ring-[#1d4f91]/30";

function getInitials(nombre, apellido) {
  const first = nombre?.trim()?.[0] ?? "";
  const last = apellido?.trim()?.[0] ?? "";
  return (first + last).toUpperCase() || "?";
}

function formatShortName(nombre, apellido) {
  const first = nombre?.trim() || "";
  const lastInitial = apellido?.trim()?.[0] ? `${apellido.trim()[0]}.` : "";
  return [first, lastInitial].filter(Boolean).join(" ");
}

function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatListTime(value) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatLastSeen(lastMessage, otherId) {
  if (!lastMessage || lastMessage.sender_id !== otherId) {
    return "Última vez hace un momento";
  }
  const diff = Date.now() - new Date(lastMessage.created_at).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "En línea ahora";
  if (hours < 24) return `Última vez hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Última vez hace ${days}d`;
}

function parseJsonMessage(content) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.tipo === "oferta" || parsed?.tipo === "solicitud_precio") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

function parseOfferContent(content) {
  const parsed = parseJsonMessage(content);
  return parsed?.tipo === "oferta" ? parsed : null;
}

function getMessagePreview(content) {
  const parsed = parseJsonMessage(content);
  if (parsed?.tipo === "oferta") {
    const precio = Number(parsed.precio_especial);
    return `🏷️ Oferta especial · ${Number.isFinite(precio) ? `${precio.toFixed(0)}€` : ""}`;
  }
  if (parsed?.tipo === "solicitud_precio") return "💬 Solicitud de precio";
  return content;
}

function formatOfferValidUntil(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Avatar({
  nombre,
  apellido,
  vertical = "alojamiento",
  size = 36,
  showOnline = false,
}) {
  const bg = VERTICAL_COLORS[vertical] ?? BLUE;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div
        className="flex items-center justify-center rounded-full text-white"
        style={{
          width: size,
          height: size,
          backgroundColor: bg,
          fontSize: size <= 24 ? 9 : 12,
          fontWeight: 500,
        }}
      >
        {getInitials(nombre, apellido)}
      </div>
      {showOnline && (
        <span
          className="absolute rounded-full"
          style={{
            width: 9,
            height: 9,
            backgroundColor: "#22c55e",
            border: "2px solid #fff",
            bottom: 0,
            right: 0,
          }}
        />
      )}
    </div>
  );
}

function OfertaMessageCard({ message, offer, isMine, onReject, rejecting }) {
  const rechazada = offer.estado === "rechazada";
  const expirada = offer.valida_hasta < new Date().toISOString().split("T")[0];
  const canRespond = !isMine && !rechazada && !expirada;
  const ahorro = Math.max(
    0,
    (Number(offer.precio_original) || 0) - (Number(offer.precio_especial) || 0),
  );

  const acceptHref = `/reservar/${offer.service_id}?precio_especial=${encodeURIComponent(offer.precio_especial)}&valida_hasta=${encodeURIComponent(offer.valida_hasta)}`;

  return (
    <div className={`flex max-w-[min(100%,340px)] flex-col ${isMine ? "items-end" : "items-start"}`}>
      <div
        className="w-full rounded-[10px] border bg-white p-4"
        style={{ borderColor: BLUE, borderWidth: 1 }}
      >
        <p
          className="text-[9px] font-medium uppercase tracking-wide"
          style={{ color: BLUE }}
        >
          🏷️ OFERTA ESPECIAL
        </p>
        <p className="mt-2 text-[13px] font-medium" style={{ color: DARK }}>
          {offer.service_titulo}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          {offer.precio_original > 0 && (
            <span className="text-sm text-[#aaa] line-through">
              {Number(offer.precio_original).toFixed(2)}€
            </span>
          )}
          <span className="text-base font-semibold" style={{ color: "#0e7a5c" }}>
            {Number(offer.precio_especial).toFixed(2)}€
          </span>
        </div>
        <p className="mt-1 text-[10px] text-[#888]">
          Válida hasta {formatOfferValidUntil(offer.valida_hasta)}
          {ahorro > 0 && ` · Ahorro ${ahorro.toFixed(0)}€`}
        </p>
        {offer.mensaje && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[#666]">{offer.mensaje}</p>
        )}
        {rechazada && (
          <p className="mt-2 text-[10px] font-medium text-[#888]">Oferta rechazada</p>
        )}
        {expirada && !rechazada && (
          <p className="mt-2 text-[10px] font-medium text-[#888]">Oferta caducada</p>
        )}
        {canRespond && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={acceptHref}
              className="inline-flex min-h-[44px] items-center rounded px-3 text-[11px] font-medium text-white no-underline transition-opacity hover:opacity-90"
              style={{ backgroundColor: BLUE }}
            >
              Aceptar oferta →
            </Link>
            <button
              type="button"
              onClick={() => onReject(message)}
              disabled={rejecting}
              className="min-h-[44px] rounded bg-[#e5e5e5] px-3 text-[11px] font-medium text-[#666] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {rejecting ? "…" : "Rechazar"}
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-[9px] text-[#bbb]">
        {formatMessageTime(message.created_at)}
      </p>
    </div>
  );
}

function SolicitudPrecioMessageCard({
  message,
  solicitud,
  isMine,
  isProvider,
  onReject,
  onAcceptAndOffer,
  rejecting,
}) {
  const rechazada = solicitud.estado === "rechazada";
  const canRespond = isProvider && !isMine && !rechazada;

  return (
    <div
      className={`flex max-w-[min(100%,340px)] flex-col ${isMine ? "items-end" : "items-start"}`}
    >
      <div
        className="w-full rounded-[10px] border bg-white p-4"
        style={{ borderColor: AMBER, borderWidth: 1 }}
      >
        <p
          className="text-[9px] font-medium uppercase tracking-wide"
          style={{ color: AMBER }}
        >
          💬 SOLICITUD DE PRECIO ESPECIAL
        </p>
        <p className="mt-2 text-[13px] font-medium" style={{ color: DARK }}>
          {solicitud.service_titulo}
        </p>
        <div className="mt-2 flex flex-wrap items-baseline gap-2">
          {solicitud.precio_original > 0 && (
            <span className="text-sm text-[#aaa] line-through">
              {Number(solicitud.precio_original).toFixed(2)}€
            </span>
          )}
          <span className="text-base font-semibold" style={{ color: "#0e7a5c" }}>
            {Number(solicitud.precio_propuesto).toFixed(2)}€
          </span>
        </div>
        {solicitud.mensaje && (
          <p className="mt-2 whitespace-pre-wrap text-xs text-[#666]">
            {solicitud.mensaje}
          </p>
        )}
        {rechazada && (
          <p className="mt-2 text-[10px] font-medium text-[#888]">Solicitud rechazada</p>
        )}
        {canRespond && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onAcceptAndOffer(solicitud)}
              className="min-h-[44px] rounded px-3 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#0e7a5c" }}
            >
              Aceptar y enviar oferta
            </button>
            <button
              type="button"
              onClick={() => onReject(message)}
              disabled={rejecting}
              className="min-h-[44px] rounded bg-[#e5e5e5] px-3 text-[11px] font-medium text-[#666] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {rejecting ? "…" : "Rechazar"}
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-[9px] text-[#bbb]">
        {formatMessageTime(message.created_at)}
      </p>
    </div>
  );
}

function getOtherParticipant(conversation, userId) {
  if (conversation.participant_a_id === userId) {
    return {
      id: conversation.participant_b_id,
      nombre: conversation.other_nombre,
      apellido: conversation.other_apellido,
      dni_verificado: conversation.other_dni_verificado === true,
    };
  }
  return {
    id: conversation.participant_a_id,
    nombre: conversation.other_nombre,
    apellido: conversation.other_apellido,
    dni_verificado: conversation.other_dni_verificado === true,
  };
}

const EMAIL_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");
  const { modo, esClientePuro } = useModo();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(conversationParam);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [providerServices, setProviderServices] = useState([]);
  const [showOfferForm, setShowOfferForm] = useState(false);
  const [offerServiceId, setOfferServiceId] = useState("");
  const [offerPrecio, setOfferPrecio] = useState("");
  const [offerValidaHasta, setOfferValidaHasta] = useState("");
  const [offerMensaje, setOfferMensaje] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [rejectingOfferId, setRejectingOfferId] = useState(null);
  const [otherParticipantServices, setOtherParticipantServices] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestServiceId, setRequestServiceId] = useState("");
  const [requestPrecio, setRequestPrecio] = useState("");
  const [requestMensaje, setRequestMensaje] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [vistaMovil, setVistaMovil] = useState(
    conversationParam ? "chat" : "lista",
  );
  const [filterActive, setFilterActive] = useState(true);
  const [contactNotice, setContactNotice] = useState("");

  const messagesEndRef = useRef(null);
  const isProvider = modo === "proveedor" && !esClientePuro;

  const loadConversations = useCallback(async (uid) => {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        "id, participant_a_id, participant_b_id, created_at, ultimo_email_notificacion",
      )
      .or(`participant_a_id.eq.${uid},participant_b_id.eq.${uid}`)
      .order("created_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      return [];
    }

    const conversationList = data ?? [];
    const otherIds = [
      ...new Set(
        conversationList.map((c) =>
          c.participant_a_id === uid ? c.participant_b_id : c.participant_a_id,
        ),
      ),
    ];

    let profilesMap = {};
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_public")
        .select("id, nombre, apellido, dni_verificado")
        .in("id", otherIds);

      profilesMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
    }

    const conversationIds = conversationList.map((c) => c.id);
    let lastByConversation = {};

    if (conversationIds.length > 0) {
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("conversation_id, content, created_at, sender_id, read")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false });

      for (const msg of recentMessages ?? []) {
        if (!lastByConversation[msg.conversation_id]) {
          lastByConversation[msg.conversation_id] = msg;
        }
      }
    }

    return conversationList.map((conversation) => {
      const otherId =
        conversation.participant_a_id === uid
          ? conversation.participant_b_id
          : conversation.participant_a_id;
      const otherProfile = profilesMap[otherId] ?? {};

      return {
        ...conversation,
        other_nombre: otherProfile.nombre,
        other_apellido: otherProfile.apellido,
        other_dni_verificado: otherProfile.dni_verificado === true,
        last_message: lastByConversation[conversation.id] ?? null,
      };
    });
  }, []);

  const markConversationRead = useCallback(async (conversationId, uid) => {
    await supabase
      .from("messages")
      .update({ read: true })
      .eq("conversation_id", conversationId)
      .neq("sender_id", uid)
      .eq("read", false);
  }, []);

  const loadMessages = useCallback(
    async (conversationId, uid) => {
      setMessagesLoading(true);
      try {
        await withLoadTimeout((async () => {
          const { data, error } = await supabase
            .from("messages")
            .select("id, conversation_id, sender_id, content, created_at, read")
            .eq("conversation_id", conversationId)
            .order("created_at", { ascending: true });

          if (error) {
            setErrorMessage(friendlyLoadError(error));
            setMessages([]);
            return;
          }
          setMessages(data ?? []);
          await markConversationRead(conversationId, uid);
        })());
      } catch (err) {
        setErrorMessage(friendlyLoadError(err));
        setMessages([]);
      } finally {
        setMessagesLoading(false);
      }
    },
    [markConversationRead],
  );

  useEffect(() => {
    if (!userId) return;

    async function loadProviderServices() {
      const { data } = await supabase
        .from("services")
        .select("id, titulo, precio, vertical")
        .eq("proveedor_id", userId)
        .eq("disponible", true)
        .order("titulo", { ascending: true });

      const list = data ?? [];
      setProviderServices(list);
      setOfferServiceId((prev) => prev || list[0]?.id || "");
    }

    loadProviderServices();
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    let navigatedAway = false;

    async function init() {
      setLoading(true);
      setLoadError("");
      try {
        await withLoadTimeout((async () => {
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();

          if (error || !user) {
            navigatedAway = true;
            router.replace("/login");
            return;
          }

          if (cancelled) return;
          setUserId(user.id);
          const list = await loadConversations(user.id);
          if (cancelled) return;
          setConversations(list);

          const initialId = conversationParam || list[0]?.id || null;
          setSelectedId(initialId);
        })());
      } catch (err) {
        if (!cancelled && !navigatedAway) {
          setLoadError(friendlyLoadError(err));
        }
      } finally {
        if (!cancelled && !navigatedAway) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [router, conversationParam, loadConversations, reloadKey]);

  useEffect(() => {
    if (conversationParam) {
      setSelectedId(conversationParam);
    }
  }, [conversationParam]);

  useEffect(() => {
    if (!userId || !selectedId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedId, userId);
  }, [userId, selectedId, loadMessages]);

  useEffect(() => {
    if (!userId || !selectedId) {
      setFilterActive(true);
      setContactNotice("");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/chat/messages?conversation_id=${encodeURIComponent(selectedId)}`,
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (cancelled) return;
        setFilterActive(json.filter_active !== false);
        setContactNotice("");
      } catch {
        if (!cancelled) setFilterActive(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const incoming = payload.new;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });

          if (incoming.sender_id !== userId) {
            markConversationRead(selectedId, userId);
          }

          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedId
                ? {
                    ...c,
                    last_message: {
                      content: incoming.content,
                      created_at: incoming.created_at,
                      sender_id: incoming.sender_id,
                      read: incoming.read,
                    },
                  }
                : c,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const updated = payload.new;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId, userId, markConversationRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const otherParticipantId = useMemo(() => {
    if (!selectedConversation || !userId) return null;
    return selectedConversation.participant_a_id === userId
      ? selectedConversation.participant_b_id
      : selectedConversation.participant_a_id;
  }, [selectedConversation, userId]);

  useEffect(() => {
    if (!otherParticipantId || isProvider) {
      setOtherParticipantServices([]);
      return;
    }

    async function loadOtherServices() {
      const { data } = await supabase
        .from("services")
        .select("id, titulo, precio, vertical, profiles_public!inner(verificado)")
        .eq("proveedor_id", otherParticipantId)
        .eq("disponible", true)
        .eq("profiles_public.verificado", true)
        .order("titulo", { ascending: true });

      const list = data ?? [];
      setOtherParticipantServices(list);
      setRequestServiceId((prev) => prev || list[0]?.id || "");
    }

    loadOtherServices();
  }, [otherParticipantId, isProvider]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const name = formatShortName(c.other_nombre, c.other_apellido).toLowerCase();
      const preview = (getMessagePreview(c.last_message?.content) || "").toLowerCase();
      return name.includes(q) || preview.includes(q);
    });
  }, [conversations, searchQuery]);

  const unreadTotal = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.last_message &&
          c.last_message.sender_id !== userId &&
          c.last_message.read === false,
      ).length,
    [conversations, userId],
  );

  const serviceVertical = useMemo(() => {
    if (isProvider && providerServices[0]?.vertical) {
      return providerServices[0].vertical;
    }
    if (otherParticipantServices[0]?.vertical) {
      return otherParticipantServices[0].vertical;
    }
    return "alojamiento";
  }, [isProvider, providerServices, otherParticipantServices]);

  const reservarHref = useMemo(() => {
    const svc = isProvider
      ? providerServices[0]
      : otherParticipantServices[0];
    if (svc?.id) return `/reservar/${svc.id}`;
    if (otherParticipantId) return `/proveedor/${otherParticipantId}`;
    return "/buscar";
  }, [isProvider, providerServices, otherParticipantServices, otherParticipantId]);

  function applySentMessage(data) {
    if (!data) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === data.id)) return prev;
      return [...prev, data];
    });
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId
          ? {
              ...c,
              last_message: {
                content: data.content,
                created_at: data.created_at,
                sender_id: data.sender_id,
                read: data.read,
              },
            }
          : c,
      ),
    );
  }

  async function postChatMessage(payload) {
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let json = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    if (!response.ok) {
      throw new Error(json?.error || "No se pudo enviar el mensaje");
    }
    if (typeof json?.filter_active === "boolean") {
      setFilterActive(json.filter_active);
    }
    if (json?.censored) {
      setContactNotice(json.notice || CONTACT_FILTER_NOTICE);
    }
    return json;
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!userId || !selectedId || !draft.trim() || sending) return;

    setSending(true);
    setErrorMessage("");
    setContactNotice("");

    try {
      const json = await postChatMessage({
        conversation_id: selectedId,
        content: draft,
      });
      applySentMessage(json.message);
      setDraft("");
      maybeNotifyRecipient(selectedId, json.message?.content || "");
    } catch (err) {
      setErrorMessage(err?.message || "No se pudo enviar el mensaje");
    } finally {
      setSending(false);
    }
  }

  async function handleSendOffer(e) {
    e.preventDefault();
    if (!userId || !selectedId || sendingOffer) return;

    const svc = providerServices.find((s) => s.id === offerServiceId);
    const precio = Number(offerPrecio);
    if (!svc || !precio || precio <= 0 || !offerValidaHasta) {
      setErrorMessage("Completa servicio, precio especial y fecha de validez.");
      return;
    }

    setSendingOffer(true);
    setErrorMessage("");
    setContactNotice("");

    try {
      const json = await postChatMessage({
        conversation_id: selectedId,
        oferta: {
          service_id: svc.id,
          service_titulo: svc.titulo?.trim() || "Servicio",
          precio_especial: precio,
          precio_original: Number(svc.precio) || 0,
          valida_hasta: offerValidaHasta,
          mensaje: offerMensaje.trim(),
        },
      });
      applySentMessage(json.message);
      setShowOfferForm(false);
      setOfferPrecio("");
      setOfferValidaHasta("");
      setOfferMensaje("");
      maybeNotifyRecipient(selectedId, "🏷️ Oferta especial");
    } catch (err) {
      setErrorMessage(err?.message || "No se pudo enviar la oferta");
    } finally {
      setSendingOffer(false);
    }
  }

  async function handleSendPriceRequest(e) {
    e.preventDefault();
    if (!userId || !selectedId || sendingRequest || isProvider) return;

    const svc = otherParticipantServices.find((s) => s.id === requestServiceId);
    const precio = Number(requestPrecio);
    if (!svc || !precio || precio <= 0) {
      setErrorMessage("Completa servicio y tu propuesta de precio.");
      return;
    }

    setSendingRequest(true);
    setErrorMessage("");
    setContactNotice("");

    try {
      const json = await postChatMessage({
        conversation_id: selectedId,
        solicitud_precio: {
          service_id: svc.id,
          service_titulo: svc.titulo?.trim() || "Servicio",
          precio_propuesto: precio,
          precio_original: Number(svc.precio) || 0,
          mensaje: requestMensaje.trim(),
        },
      });
      applySentMessage(json.message);
      setShowRequestForm(false);
      setRequestPrecio("");
      setRequestMensaje("");
      maybeNotifyRecipient(selectedId, "💬 Solicitud de precio");
    } catch (err) {
      setErrorMessage(err?.message || "No se pudo enviar la solicitud");
    } finally {
      setSendingRequest(false);
    }
  }

  function handleAcceptSolicitudAndOffer(solicitud) {
    const until = new Date();
    until.setDate(until.getDate() + 30);

    setOfferServiceId(solicitud.service_id);
    setOfferPrecio(String(solicitud.precio_propuesto));
    setOfferMensaje(
      solicitud.mensaje
        ? `En respuesta a tu solicitud: ${solicitud.mensaje}`
        : "",
    );
    setOfferValidaHasta(until.toISOString().split("T")[0]);
    setShowOfferForm(true);
    setShowRequestForm(false);
  }

  async function handleRejectSpecialMessage(message) {
    const special = parseJsonMessage(message.content);
    if (!special || special.estado === "rechazada") return;

    setRejectingOfferId(message.id);
    const updated = { ...special, estado: "rechazada" };
    const content = JSON.stringify(updated);

    const { error } = await supabase
      .from("messages")
      .update({ content })
      .eq("id", message.id);

    setRejectingOfferId(null);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, content } : m)),
    );
  }

  async function maybeNotifyRecipient(conversationId, messageContent) {
    if (!userId || !selectedConversation) return;

    const response = await fetch("/api/chat/notify-mensaje", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: conversationId,
        mensaje_preview: messageContent,
      }),
    });

    if (response.ok) {
      const now = new Date().toISOString();
      await supabase
        .from("conversations")
        .update({ ultimo_email_notificacion: now })
        .eq("id", conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, ultimo_email_notificacion: now }
            : c,
        ),
      );
    }
  }

  function selectConversation(id) {
    setSelectedId(id);
    setVistaMovil("chat");
    router.replace(`/chat?conversation=${id}`, { scroll: false });
  }

  function volverALista() {
    setVistaMovil("lista");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <main
          className="flex items-center justify-center text-sm text-[#aaa]"
          style={{ height: "calc(100vh - 57px)" }}
        >
          Cargando mensajes…
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <DataLoadFailed
          message={loadError}
          onRetry={() => setReloadKey((k) => k + 1)}
          style={{ height: "calc(100vh - 57px)" }}
        />
      </div>
    );
  }

  const otherParticipant = selectedConversation
    ? getOtherParticipant(selectedConversation, userId)
    : null;

  const isOtherOnline =
    selectedConversation?.last_message &&
    selectedConversation.last_message.sender_id === otherParticipantId &&
    Date.now() - new Date(selectedConversation.last_message.created_at).getTime() <
      3600000;

  return (
    <div className="min-h-screen bg-white font-sans" style={{ color: DARK }}>
      <style>{`
        .chat-hide-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
      <Navbar />

      {errorMessage && (
        <p className="border-b bg-red-50 px-6 py-2 text-xs text-red-700">
          {errorMessage}
        </p>
      )}

      <div
        className="grid md:grid-cols-[280px_1fr]"
        style={{
          height: "calc(100vh - 57px)",
          backgroundColor: "#fff",
        }}
      >
        {/* Columna izquierda — lista */}
        <aside
          className={`flex flex-col border-r ${vistaMovil === "chat" ? "hidden md:flex" : "flex"}`}
          style={{ borderColor: BORDER }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: `0.5px solid #f0ede8` }}
          >
            <span className="text-[13px] font-medium" style={{ color: DARK }}>
              Mensajes
            </span>
            {unreadTotal > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[9px] font-medium text-white"
                style={{ backgroundColor: BLUE }}
              >
                {unreadTotal} sin leer
              </span>
            )}
          </div>

          <div className="px-3 py-2">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar conversación..."
              className="min-h-[44px] w-full border-0 px-4 py-2 text-xs outline-none"
              style={{
                borderRadius: 20,
                backgroundColor: WARM,
                color: DARK,
              }}
            />
          </div>

          {filteredConversations.length === 0 ? (
            <p className="px-4 py-8 text-xs text-[#bbb]">
              {conversations.length === 0
                ? "Aún no tienes conversaciones."
                : "No hay resultados."}
            </p>
          ) : (
            <ul
              className="chat-hide-scrollbar flex-1 overflow-y-auto"
              style={hideScrollbar}
            >
              {filteredConversations.map((conversation) => {
                const isActive = conversation.id === selectedId;
                const unread =
                  conversation.last_message &&
                  conversation.last_message.sender_id !== userId &&
                  conversation.last_message.read === false;
                const lastParsed = parseJsonMessage(
                  conversation.last_message?.content,
                );
                const convVertical =
                  lastParsed?.tipo === "oferta" ||
                  lastParsed?.tipo === "solicitud_precio"
                    ? "alojamiento"
                    : "alojamiento";

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => selectConversation(conversation.id)}
                      className="flex min-h-[44px] w-full items-center gap-3 px-3 py-3 text-left transition-colors"
                      style={{
                        borderLeft: isActive
                          ? `2px solid ${BLUE}`
                          : "2px solid transparent",
                        backgroundColor: isActive ? WARM : "transparent",
                      }}
                    >
                      <Avatar
                        nombre={conversation.other_nombre}
                        apellido={conversation.other_apellido}
                        vertical={convVertical}
                        size={36}
                        showOnline={isActive}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <p
                              className="truncate text-xs font-medium"
                              style={{ color: DARK }}
                            >
                              {formatShortName(
                                conversation.other_nombre,
                                conversation.other_apellido,
                              ) || "Usuario"}
                            </p>
                            {isProvider &&
                              conversation.other_dni_verificado && (
                                <ClienteVerificadoBadge compact />
                              )}
                          </div>
                          {conversation.last_message && (
                            <span className="shrink-0 text-[9px] text-[#bbb]">
                              {formatListTime(
                                conversation.last_message.created_at,
                              )}
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-0.5 truncate text-[11px]"
                          style={{
                            color: unread ? DARK : "#aaa",
                            fontWeight: unread ? 500 : 400,
                          }}
                        >
                          {conversation.last_message?.content
                            ? getMessagePreview(conversation.last_message.content)
                            : "Sin mensajes todavía"}
                        </p>
                      </div>
                      {unread && (
                        <span
                          className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[9px] font-medium text-white"
                          style={{ backgroundColor: BLUE }}
                        >
                          1
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Columna derecha — chat */}
        <section
          className={`min-w-0 flex-col ${vistaMovil === "lista" ? "hidden md:flex" : "flex"}`}
        >
          {selectedConversation ? (
            <>
              {/* Header chat */}
              <div
                className="flex items-center justify-between gap-4 px-5 py-3"
                style={{
                  backgroundColor: "#fff",
                  borderBottom: "0.5px solid #f0ede8",
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <button
                    type="button"
                    onClick={volverALista}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-sm font-medium text-[#1d4f91] md:hidden"
                    aria-label="Volver a conversaciones"
                  >
                    ← Volver
                  </button>
                  <Avatar
                    nombre={otherParticipant?.nombre}
                    apellido={otherParticipant?.apellido}
                    vertical={serviceVertical}
                    size={36}
                    showOnline={isOtherOnline}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs font-medium" style={{ color: DARK }}>
                        {formatShortName(
                          otherParticipant?.nombre,
                          otherParticipant?.apellido,
                        ) || "Usuario"}
                      </p>
                      {isProvider && otherParticipant?.dni_verificado && (
                        <ClienteVerificadoBadge compact />
                      )}
                    </div>
                    <p className="text-[10px] text-[#aaa]">
                      {VERTICAL_LABELS[serviceVertical] || "Servicio"} ·{" "}
                      {formatLastSeen(
                        selectedConversation.last_message,
                        otherParticipantId,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {otherParticipantId && (
                    <Link
                      href={`/proveedor/${otherParticipantId}`}
                      className="inline-flex min-h-[44px] items-center rounded border px-3 text-[11px] font-medium no-underline transition-colors hover:bg-[#f7f5f2]"
                      style={{ borderColor: BLUE, color: BLUE }}
                    >
                      Ver perfil →
                    </Link>
                  )}
                  <Link
                    href={reservarHref}
                    className="inline-flex min-h-[44px] items-center rounded border px-3 text-[11px] font-medium no-underline transition-colors hover:bg-[#f7f5f2]"
                    style={{ borderColor: BLUE, color: BLUE }}
                  >
                    Reservar
                  </Link>
                </div>
              </div>

              {filterActive && (
                <div
                  className="border-b px-5 py-2.5 text-[11px] leading-relaxed"
                  style={{
                    borderColor: "#f0ede8",
                    backgroundColor: "#f3f7fb",
                    color: "#3a4a5a",
                  }}
                >
                  {CONTACT_FILTER_BANNER}
                </div>
              )}

              {/* Mensajes */}
              <div
                className="chat-hide-scrollbar flex-1 overflow-y-auto px-5 py-4"
                style={{ ...hideScrollbar, backgroundColor: WARM }}
              >
                {messagesLoading ? (
                  <p className="text-center text-xs text-[#aaa]">
                    Cargando mensajes…
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-[#aaa]">
                    Envía el primer mensaje para iniciar la conversación.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {messages.map((message) => {
                      const isMine = message.sender_id === userId;
                      const special = parseJsonMessage(message.content);

                      if (special?.tipo === "oferta") {
                        return (
                          <li
                            key={message.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <OfertaMessageCard
                              message={message}
                              offer={special}
                              isMine={isMine}
                              onReject={handleRejectSpecialMessage}
                              rejecting={rejectingOfferId === message.id}
                            />
                          </li>
                        );
                      }

                      if (special?.tipo === "solicitud_precio") {
                        return (
                          <li
                            key={message.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <SolicitudPrecioMessageCard
                              message={message}
                              solicitud={special}
                              isMine={isMine}
                              isProvider={isProvider}
                              onReject={handleRejectSpecialMessage}
                              onAcceptAndOffer={handleAcceptSolicitudAndOffer}
                              rejecting={rejectingOfferId === message.id}
                            />
                          </li>
                        );
                      }

                      return (
                        <li
                          key={message.id}
                          className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          {!isMine && (
                            <Avatar
                              nombre={otherParticipant?.nombre}
                              apellido={otherParticipant?.apellido}
                              vertical={serviceVertical}
                              size={24}
                            />
                          )}
                          <div className="flex max-w-[75%] flex-col">
                            <div
                              className="px-3 py-2 text-xs leading-relaxed"
                              style={
                                isMine
                                  ? {
                                      backgroundColor: BLUE,
                                      color: "#fff",
                                      borderRadius: "8px 8px 2px 8px",
                                    }
                                  : {
                                      backgroundColor: "#fff",
                                      color: DARK,
                                      border: `0.5px solid ${BORDER}`,
                                      borderRadius: "8px 8px 8px 2px",
                                    }
                              }
                            >
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                            </div>
                            <p
                              className={`mt-1 text-[9px] text-[#bbb] ${isMine ? "text-right" : "text-left"}`}
                            >
                              {formatMessageTime(message.created_at)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                    <li ref={messagesEndRef} />
                  </ul>
                )}
              </div>

              {/* Formularios oferta / solicitud */}
              {showRequestForm && !isProvider && (
                <form
                  onSubmit={handleSendPriceRequest}
                  className="border-t px-5 py-3"
                  style={{
                    borderColor: "#f0ede8",
                    backgroundColor: "#fff",
                  }}
                >
                  <p className="mb-2 text-xs font-medium" style={{ color: AMBER }}>
                    Solicitar precio especial
                  </p>
                  <div className="flex flex-col gap-2">
                    <select
                      value={requestServiceId}
                      onChange={(e) => setRequestServiceId(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: AMBER }}
                      required
                    >
                      {otherParticipantServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.titulo}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={requestPrecio}
                      onChange={(e) => setRequestPrecio(e.target.value)}
                      placeholder="Tu propuesta de precio (€)"
                      className={inputClass}
                      style={{ borderColor: AMBER }}
                      required
                    />
                    <textarea
                      rows={2}
                      value={requestMensaje}
                      onChange={(e) => setRequestMensaje(e.target.value)}
                      placeholder="Explica tu solicitud..."
                      className={`${inputClass} resize-y`}
                      style={{ borderColor: AMBER }}
                    />
                    <button
                      type="submit"
                      disabled={sendingRequest}
                      className="min-h-[44px] self-start rounded px-4 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: BLUE }}
                    >
                      {sendingRequest ? "Enviando…" : "Enviar solicitud"}
                    </button>
                  </div>
                </form>
              )}

              {showOfferForm && isProvider && (
                <form
                  onSubmit={handleSendOffer}
                  className="border-t px-5 py-3"
                  style={{
                    borderColor: "#f0ede8",
                    backgroundColor: "#fff",
                  }}
                >
                  <p className="mb-2 text-xs font-medium" style={{ color: BLUE }}>
                    Nueva oferta personalizada
                  </p>
                  <div className="flex flex-col gap-2">
                    <select
                      value={offerServiceId}
                      onChange={(e) => setOfferServiceId(e.target.value)}
                      className={inputClass}
                      style={{ borderColor: BORDER }}
                      required
                    >
                      {providerServices.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.titulo}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={offerPrecio}
                        onChange={(e) => setOfferPrecio(e.target.value)}
                        placeholder="Precio especial (€)"
                        className={inputClass}
                        required
                      />
                      <input
                        type="date"
                        min={new Date().toISOString().split("T")[0]}
                        value={offerValidaHasta}
                        onChange={(e) => setOfferValidaHasta(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={offerMensaje}
                      onChange={(e) => setOfferMensaje(e.target.value)}
                      placeholder="Mensaje de la oferta..."
                      className={`${inputClass} resize-y`}
                    />
                    <button
                      type="submit"
                      disabled={sendingOffer}
                      className="min-h-[44px] self-start rounded px-4 text-xs font-medium text-white disabled:opacity-60"
                      style={{ backgroundColor: BLUE }}
                    >
                      {sendingOffer ? "Enviando…" : "Enviar oferta"}
                    </button>
                  </div>
                </form>
              )}

              {/* Input */}
              <div
                className="border-t px-5 py-3"
                style={{ backgroundColor: "#fff", borderColor: "#f0ede8" }}
              >
                {(isProvider ||
                  (!isProvider && otherParticipantServices.length > 0)) && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {isProvider && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowOfferForm((v) => !v);
                          setShowRequestForm(false);
                        }}
                        className="min-h-[44px] border px-3 text-[11px] font-medium transition-colors hover:bg-[#f7f5f2]"
                        style={{
                          borderRadius: 16,
                          borderColor: BLUE,
                          color: BLUE,
                          backgroundColor: showOfferForm ? WARM : "#fff",
                        }}
                      >
                        🏷️ Enviar oferta
                      </button>
                    )}
                    {!isProvider && otherParticipantServices.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowRequestForm((v) => !v);
                          setShowOfferForm(false);
                        }}
                        className="min-h-[44px] border px-3 text-[11px] font-medium transition-colors hover:bg-[#f7f5f2]"
                        style={{
                          borderRadius: 16,
                          borderColor: AMBER,
                          color: AMBER,
                          backgroundColor: showRequestForm ? WARM : "#fff",
                        }}
                      >
                        💬 Solicitar precio
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleSend} className="flex gap-2">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Escribe un mensaje…"
                    className="min-h-[44px] flex-1 border-0 px-4 py-2.5 text-xs outline-none"
                    style={{
                      borderRadius: 20,
                      backgroundColor: WARM,
                      color: DARK,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="min-h-[44px] min-w-[44px] shrink-0 border-0 px-4 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      borderRadius: 20,
                      backgroundColor: BLUE,
                    }}
                  >
                    {sending ? "…" : "Enviar →"}
                  </button>
                </form>
                {contactNotice ? (
                  <p
                    className="mt-2 text-[11px] leading-relaxed"
                    style={{ color: AMBER }}
                    role="status"
                  >
                    {contactNotice}
                  </p>
                ) : filterActive ? (
                  <p className="mt-2 text-[9px] text-[#bbb]">
                    Contacto oculto hasta confirmar la reserva ([oculto]).
                  </p>
                ) : (
                  <p className="mt-2 text-[9px] text-[#bbb]">
                    Reserva confirmada: podéis coordinaros con normalidad.
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-xs text-[#aaa]">
              Selecciona una conversación para ver los mensajes.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
