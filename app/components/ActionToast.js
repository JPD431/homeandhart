"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Toast flotante de éxito / error.
 * Uso:
 *   const { toast, showSuccess, showError, dismiss } = useActionToast();
 *   … <ActionToastHost toast={toast} onDismiss={dismiss} />
 */
export function useActionToast(autoHideMs = 4500) {
  const [toast, setToast] = useState(null);

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback((message, variant = "success") => {
    if (!message) return;
    setToast({ message, variant, id: Date.now() });
  }, []);

  const showSuccess = useCallback(
    (message) => show(message, "success"),
    [show],
  );
  const showError = useCallback(
    (message) => show(message, "error"),
    [show],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), autoHideMs);
    return () => clearTimeout(t);
  }, [toast, autoHideMs]);

  return { toast, showSuccess, showError, dismiss };
}

export function ActionToastHost({ toast, onDismiss }) {
  if (!toast) return null;
  const isError = toast.variant === "error";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-5 left-1/2 z-[80] w-[min(92vw,420px)] -translate-x-1/2 rounded-lg px-4 py-3 text-sm shadow-lg"
      style={{
        backgroundColor: isError ? "#fef2f2" : "#ecfdf5",
        color: isError ? "#b91c1c" : "#065f46",
        border: `1px solid ${isError ? "#fecaca" : "#a7f3d0"}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="m-0 leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs font-semibold opacity-70 hover:opacity-100"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
