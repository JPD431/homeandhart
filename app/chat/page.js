"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { BRAND, SERIF } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

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

function filterProtectedContent(text) {
  let result = text;
  result = result.replace(
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    "[dato protegido]",
  );
  result = result.replace(
    /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{2,4}[\s.-]?\d{2,4}[\s.-]?\d{0,4}/g,
    "[dato protegido]",
  );
  return result.trim();
}

function getOtherParticipant(conversation, userId) {
  if (conversation.participant_a_id === userId) {
    return {
      id: conversation.participant_b_id,
      nombre: conversation.other_nombre,
      apellido: conversation.other_apellido,
    };
  }
  return {
    id: conversation.participant_a_id,
    nombre: conversation.other_nombre,
    apellido: conversation.other_apellido,
  };
}

const EMAIL_NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationParam = searchParams.get("conversation");

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(conversationParam);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const messagesEndRef = useRef(null);

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
        .from("profiles")
        .select("id, nombre, apellido")
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

      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, sender_id, content, created_at, read")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });

      if (error) {
        setErrorMessage(error.message);
        setMessages([]);
      } else {
        setMessages(data ?? []);
        await markConversationRead(conversationId, uid);
      }

      setMessagesLoading(false);
    },
    [markConversationRead],
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        router.replace("/login");
        return;
      }

      setUserId(user.id);
      const list = await loadConversations(user.id);
      setConversations(list);
      setLoading(false);

      const initialId = conversationParam || list[0]?.id || null;
      setSelectedId(initialId);
    }

    init();
  }, [router, conversationParam, loadConversations]);

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

  async function handleSend(e) {
    e.preventDefault();
    if (!userId || !selectedId || !draft.trim() || sending) return;

    setSending(true);
    setErrorMessage("");

    const filteredContent = filterProtectedContent(draft);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: selectedId,
        sender_id: userId,
        content: filteredContent,
        read: false,
      })
      .select("id, conversation_id, sender_id, content, created_at, read")
      .single();

    setSending(false);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data) {
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

    setDraft("");
    maybeNotifyRecipient(selectedId, filteredContent);
  }

  async function maybeNotifyRecipient(conversationId, messageContent) {
    if (!userId || !selectedConversation) return;

    // -- ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ultimo_email_notificacion timestamptz;
    const recipientId =
      selectedConversation.participant_a_id === userId
        ? selectedConversation.participant_b_id
        : selectedConversation.participant_a_id;

    const { data: conversation } = await supabase
      .from("conversations")
      .select("ultimo_email_notificacion")
      .eq("id", conversationId)
      .single();

    if (conversation?.ultimo_email_notificacion) {
      const elapsed =
        Date.now() - new Date(conversation.ultimo_email_notificacion).getTime();
      if (elapsed < EMAIL_NOTIFICATION_COOLDOWN_MS) return;
    }

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("email_contacto")
      .eq("id", recipientId)
      .single();

    if (!recipientProfile?.email_contacto) return;

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", userId)
      .single();

    const remitenteNombre =
      formatShortName(senderProfile?.nombre, senderProfile?.apellido) ||
      "Un usuario";

    const response = await fetch("/api/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo: "mensaje_nuevo",
        destinatario: recipientProfile.email_contacto,
        remitente_nombre: remitenteNombre,
        mensaje_preview: messageContent,
        chat_url: `${window.location.origin}/chat?conversation=${conversationId}`,
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
    router.replace(`/chat?conversation=${id}`, { scroll: false });
  }

  if (loading) {
    return (
      <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm }}>
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-16 text-center text-sm text-[#666]">
          Cargando mensajes…
        </main>
      </div>
    );
  }

  const otherParticipant = selectedConversation
    ? getOtherParticipant(selectedConversation, userId)
    : null;

  return (
    <div
      className="flex min-h-screen flex-col font-sans"
      style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}
    >
      <Navbar />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6">
        <h1
          className="mb-4 text-2xl font-bold text-[#1a1a1a]"
          style={{ fontFamily: SERIF }}
        >
          Mensajes
        </h1>

        {errorMessage && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        )}

        <div
          className="flex min-h-[70vh] flex-1 overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: BRAND.border }}
        >
          {/* Lista de conversaciones */}
          <aside
            className={`flex w-full flex-col border-r lg:w-[320px] lg:shrink-0 ${
              selectedId ? "hidden lg:flex" : "flex"
            }`}
            style={{ borderColor: BRAND.border }}
          >
            <div
              className="border-b px-4 py-3 text-sm font-semibold"
              style={{ borderColor: BRAND.border, color: BRAND.primary }}
            >
              Conversaciones
            </div>

            {conversations.length === 0 ? (
              <p className="px-4 py-8 text-sm text-[#888]">
                Aún no tienes conversaciones. Contacta con un proveedor desde su
                perfil.
              </p>
            ) : (
              <ul className="flex-1 overflow-y-auto">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === selectedId;
                  const unread =
                    conversation.last_message &&
                    conversation.last_message.sender_id !== userId &&
                    conversation.last_message.read === false;

                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => selectConversation(conversation.id)}
                        className="flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-[#fafafa]"
                        style={{
                          borderColor: BRAND.border,
                          backgroundColor: isActive ? BRAND.light : "transparent",
                        }}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                          style={{ backgroundColor: BRAND.primary }}
                        >
                          {getInitials(
                            conversation.other_nombre,
                            conversation.other_apellido,
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-[#1a1a1a]">
                              {formatShortName(
                                conversation.other_nombre,
                                conversation.other_apellido,
                              ) || "Usuario"}
                            </p>
                            {conversation.last_message && (
                              <span className="shrink-0 text-[10px] text-[#888]">
                                {formatMessageTime(
                                  conversation.last_message.created_at,
                                )}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs text-[#666]">
                            {conversation.last_message?.content ||
                              "Sin mensajes todavía"}
                          </p>
                        </div>
                        {unread && (
                          <span
                            className="mt-2 h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: BRAND.primary }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          {/* Panel de mensajes */}
          <section
            className={`flex min-w-0 flex-1 flex-col ${
              selectedId ? "flex" : "hidden lg:flex"
            }`}
          >
            {selectedConversation ? (
              <>
                <div
                  className="flex items-center gap-3 border-b px-4 py-3"
                  style={{ borderColor: BRAND.border }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="rounded-lg px-2 py-1 text-sm text-[#666] lg:hidden"
                  >
                    ← Volver
                  </button>
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: BRAND.primary }}
                  >
                    {getInitials(
                      otherParticipant?.nombre,
                      otherParticipant?.apellido,
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a]">
                      {formatShortName(
                        otherParticipant?.nombre,
                        otherParticipant?.apellido,
                      ) || "Usuario"}
                    </p>
                    <p className="text-xs text-[#888]">
                      Los datos de contacto se comparten al confirmar la reserva
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {messagesLoading ? (
                    <p className="text-center text-sm text-[#888]">
                      Cargando mensajes…
                    </p>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-[#888]">
                      Envía el primer mensaje para iniciar la conversación.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {messages.map((message) => {
                        const isMine = message.sender_id === userId;
                        return (
                          <li
                            key={message.id}
                            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm"
                              style={
                                isMine
                                  ? {
                                      backgroundColor: BRAND.primary,
                                      color: "#fff",
                                    }
                                  : {
                                      backgroundColor: BRAND.light,
                                      color: "#1a1a1a",
                                    }
                              }
                            >
                              <p className="whitespace-pre-wrap break-words">
                                {message.content}
                              </p>
                              <p
                                className="mt-1 text-[10px] opacity-70"
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

                <form
                  onSubmit={handleSend}
                  className="border-t p-4"
                  style={{ borderColor: BRAND.border }}
                >
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Escribe un mensaje…"
                      className="flex-1 rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#1d4f91]/30"
                      style={{ borderColor: BRAND.border }}
                    />
                    <button
                      type="submit"
                      disabled={sending || !draft.trim()}
                      className="rounded-xl px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ backgroundColor: BRAND.primary }}
                    >
                      {sending ? "…" : "Enviar"}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] text-[#888]">
                    Teléfonos y emails se ocultan automáticamente hasta confirmar
                    la reserva.
                  </p>
                </form>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-[#888]">
                Selecciona una conversación para ver los mensajes.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
