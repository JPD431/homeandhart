"use client";

import { useEffect, useState } from "react";

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    if (localStorage.getItem("pwa_dismissed") === "true") {
      return;
    }

    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    setIsIOS(ios);

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    if (ios) {
      setShowBanner(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem("pwa_dismissed", "true");
  };

  if (!showBanner || isInstalled) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#fff",
        borderTop: "0.5px solid #e8e4de",
        boxShadow: "0 -8px 32px rgba(0,0,0,.12)",
        padding: "16px",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        zIndex: 9999,
        borderRadius: "16px 16px 0 0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <img
          src="/logoo1.png"
          alt="Home&Heart"
          style={{ width: 40, height: 40, borderRadius: "50%" }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#2a3a4a" }}>
            Añade Home&Heart a tu móvil
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>Accede más rápido como una app</div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          style={{
            background: "none",
            border: "none",
            fontSize: 18,
            color: "#bbb",
            cursor: "pointer",
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {isIOS ? (
        <div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginBottom: 14,
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
            }}
          >
            <div
              style={{
                flex: "1 1 90px",
                minWidth: 90,
                background: "#f7f5f2",
                borderRadius: 8,
                padding: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>📤</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#2a3a4a", marginBottom: 2 }}>
                Paso 1
              </div>
              <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                Toca <strong>⋯</strong> o el botón compartir de Safari
              </div>
            </div>
            <div
              style={{
                flex: "1 1 90px",
                minWidth: 90,
                background: "#f7f5f2",
                borderRadius: 8,
                padding: 10,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>➕</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#2a3a4a", marginBottom: 2 }}>
                Paso 2
              </div>
              <div style={{ fontSize: 10, color: "#888", lineHeight: 1.4 }}>
                &quot;Añadir a pantalla de inicio&quot;
              </div>
            </div>
            <div
              style={{
                flex: "1 1 90px",
                minWidth: 90,
                background: "#e8f0fb",
                borderRadius: 8,
                padding: 10,
                textAlign: "center",
                border: "0.5px solid #1d4f91",
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>🏠</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "#1d4f91", marginBottom: 2 }}>
                Paso 3
              </div>
              <div style={{ fontSize: 10, color: "#1d4f91", lineHeight: 1.4 }}>
                Toca &quot;Añadir&quot; y listo
              </div>
            </div>
          </div>
          <div
            style={{
              background: "#fdf3e3",
              borderRadius: 6,
              padding: "8px 10px",
              marginBottom: 10,
              marginTop: 8,
            }}
          >
            <div style={{ fontSize: 10, color: "#c47d1a", lineHeight: 1.5 }}>
              💡 En iPhone: toca los <strong>tres puntos ⋯</strong> arriba a la derecha, luego busca{" "}
              <strong>&quot;Añadir a pantalla de inicio&quot;</strong>
            </div>
          </div>
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "#1d4f91",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span>El botón compartir está aquí</span>
            <span style={{ fontSize: 16 }}>👇</span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleInstall}
          style={{
            width: "100%",
            background: "#1d4f91",
            color: "#fff",
            border: "none",
            padding: "12px",
            borderRadius: 8,
            fontSize: 13,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          📲 Instalar Home&Heart →
        </button>
      )}
    </div>
  );
}
