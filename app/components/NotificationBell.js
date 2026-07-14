"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BRAND } from "@/app/components/brand";
import { useModo } from "@/app/lib/ModoContext";
import { resolveNotificationHref } from "@/app/lib/notifications";

const PRIMARY = "#1d4f91";
const BORDER = "#e8e4de";
const POLL_MS = 60_000;

function BellIcon({ className }) {
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
        d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
      />
    </svg>
  );
}

function formatRelativeTime(iso) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return "ahora";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export default function NotificationBell({ compact = false }) {
  const router = useRouter();
  const { modo, setModo, puedeAlternarModo } = useModo();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotifications([]);
        setUnreadCount(0);
        return;
      }
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();

    const interval = setInterval(loadNotifications, POLL_MS);

    function onVisibility() {
      if (document.visibilityState === "visible") {
        loadNotifications();
      }
    }

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleNotificationClick(notification) {
    if (!notification.leida) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: "PATCH",
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, leida: true } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        /* navegar igual */
      }
    }

    setOpen(false);
    const destination = resolveNotificationHref(notification);
    if (
      puedeAlternarModo &&
      destination.includes("tab=proveedor")
    ) {
      setModo("proveedor", { redirect: false });
    }
    if (destination) {
      router.push(destination);
    }
  }

  async function handleDeleteNotification(e, notification) {
    e.preventDefault();
    e.stopPropagation();

    if (deletingId) return;

    setDeletingId(notification.id);

    try {
      const res = await fetch(`/api/notifications/${notification.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        return;
      }

      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      if (!notification.leida) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      /* silencioso */
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })));
        setUnreadCount(0);
      }
    } catch {
      /* silencioso */
    } finally {
      setMarkingAll(false);
    }
  }

  const iconButtonClass = compact
    ? "relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#444]"
    : "relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#444]";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={iconButtonClass}
        style={{
          background: "#fff",
          border: `0.5px solid ${BORDER}`,
          cursor: "pointer",
        }}
        aria-label="Notificaciones"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <BellIcon className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: PRIMARY }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-[80] mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-white shadow-lg"
          style={{ borderColor: BORDER }}
          role="dialog"
          aria-label="Panel de notificaciones"
        >
          <div
            className="flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: "#f0ede8" }}
          >
            <span className="text-sm font-semibold text-[#2a3a4a]">
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={markingAll}
                className="text-xs font-medium disabled:opacity-60"
                style={{
                  color: PRIMARY,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {markingAll ? "Marcando…" : "Marcar todas como leídas"}
              </button>
            )}
          </div>

          <div className="max-h-[min(420px,70vh)] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-[#888]">
                Cargando…
              </p>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-2xl" aria-hidden>
                  🔔
                </p>
                <p className="mt-2 text-sm text-[#666]">
                  No tienes notificaciones
                </p>
                <p className="mt-1 text-xs text-[#aaa]">
                  Te avisaremos aquí cuando haya novedades en tus reservas.
                </p>
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="flex items-stretch"
                    style={{ borderBottom: "0.5px solid #f0ede8" }}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(n)}
                      className="min-w-0 flex-1 border-0 px-4 py-3 text-left transition-colors hover:bg-[#f7f5f2]"
                      style={{
                        background: n.leida ? "#fff" : "#f8fafc",
                        cursor: "pointer",
                        borderLeft: n.leida
                          ? "3px solid transparent"
                          : `3px solid ${BRAND.green}`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: n.leida ? "#444" : PRIMARY }}
                        >
                          {n.titulo}
                        </span>
                        <span className="shrink-0 text-[10px] text-[#aaa]">
                          {formatRelativeTime(n.created_at)}
                        </span>
                      </div>
                      {n.mensaje && (
                        <p className="mt-1 text-xs leading-relaxed text-[#666]">
                          {n.mensaje}
                        </p>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="Eliminar notificación"
                      disabled={deletingId === n.id}
                      onClick={(e) => handleDeleteNotification(e, n)}
                      className="flex shrink-0 items-start border-0 bg-transparent px-3 py-3 text-lg leading-none text-[#bbb] transition-colors hover:text-[#666] disabled:opacity-40"
                      style={{ cursor: "pointer" }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {notifications.length > 0 && (
            <div
              className="border-t px-4 py-2 text-center"
              style={{ borderColor: "#f0ede8", background: "#fafafa" }}
            >
              <Link
                href={
                  modo === "proveedor" && puedeAlternarModo
                    ? "/dashboard?tab=proveedor"
                    : "/dashboard?tab=cliente"
                }
                onClick={() => setOpen(false)}
                className="text-xs font-medium no-underline"
                style={{ color: PRIMARY }}
              >
                {modo === "proveedor" && puedeAlternarModo
                  ? "Ver mi panel →"
                  : "Ver mis reservas →"}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
