"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchPostLoginRedirect } from "@/app/lib/post-login-redirect";
import { supabase } from "@/app/lib/supabase";

export default function VerificadoPage() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [redirectTo, setRedirectTo] = useState("/completar-perfil");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolveDestination() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setRedirectTo("/login");
        setReady(true);
        return;
      }

      const path = await fetchPostLoginRedirect();
      if (!cancelled) {
        setRedirectTo(path);
        setReady(true);
      }
    }

    resolveDestination();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          router.push(redirectTo);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [ready, redirectTo, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5f2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: "48px 32px",
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          border: "0.5px solid #e8e4de",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#e6f4f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: 32,
          }}
        >
          ✅
        </div>

        <h1
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 26,
            fontWeight: 300,
            color: "#2a3a4a",
            marginBottom: 8,
          }}
        >
          ¡Cuenta verificada!
        </h1>

        <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 24 }}>
          Bienvenida a Home&Heart. Tu cuenta está activa y lista para usar.
        </p>

        <div
          style={{
            background: "#e6f4f0",
            borderRadius: 8,
            padding: "12px 16px",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 12, color: "#0e7a5c", fontWeight: 500 }}>🎁 Recuerda</div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
            Tus primeras reservas están protegidas con la Garantía Home&Heart
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push(redirectTo)}
          disabled={!ready}
          style={{
            width: "100%",
            background: "#1d4f91",
            color: "#fff",
            border: "none",
            padding: "13px",
            borderRadius: 6,
            fontSize: 14,
            cursor: ready ? "pointer" : "wait",
            fontWeight: 500,
            marginBottom: 12,
            opacity: ready ? 1 : 0.7,
          }}
        >
          {ready ? "Continuar →" : "Preparando tu cuenta…"}
        </button>

        <p style={{ fontSize: 11, color: "#bbb" }}>
          {ready
            ? `Redirigiendo automáticamente en ${countdown} segundos...`
            : "Un momento…"}
        </p>
      </div>
    </div>
  );
}
