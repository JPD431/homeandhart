"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchPostLoginRedirect } from "@/app/lib/post-login-redirect";
import {
  buildRegistroUrl,
  getRedirectFromSearchParams,
  persistAuthRedirect,
  resolveAuthRedirect,
} from "@/app/lib/auth-redirect";
import { supabase } from "@/app/lib/supabase";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

const PRIMARY = "#1d4f91";
const DARK = "#163a6b";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";

const inputStyle = {
  width: "100%",
  background: WARM,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 13,
  color: "#1a1a1a",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#bbb",
  marginBottom: 6,
  fontWeight: 600,
};

function AuthShell({ children }) {
  const { lang } = useLang();
  const t = useTranslation(lang);

  return (
    <div
      className="font-sans"
      style={{ minHeight: "100vh", background: WARM }}
    >
      <div
        style={{
          height: 57,
          display: "flex",
          alignItems: "center",
          padding: "0 32px",
          borderBottom: `1px solid ${BORDER}`,
          background: WARM,
        }}
      >
        <Link href="/" className="no-underline" style={{ lineHeight: 1.2 }}>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 18,
              color: "#1a1a1a",
              fontWeight: 600,
            }}
          >
            Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>
            Heart
          </span>
          <span
            style={{
              display: "block",
              fontSize: 10,
              color: "#bbb",
              marginTop: 2,
            }}
          >
            {t.footer.slogan}
          </span>
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          minHeight: "calc(100vh - 57px)",
        }}
      >
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            background: `linear-gradient(160deg, ${PRIMARY} 0%, ${DARK} 100%)`,
            padding: "0",
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -80,
              right: -80,
              width: 280,
              height: 280,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: 40,
              left: -40,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />

          <img
            src="/logoo1.png"
            alt="Home&Heart"
            style={{
              position: "absolute",
              top: -20,
              left: -20,
              width: 240,
              height: 240,
              objectFit: "contain",
              zIndex: 2,
            }}
          />

          <div style={{ position: "relative", zIndex: 3, padding: "220px 40px 40px", maxWidth: 380 }}>
            <p
              style={{
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "rgba(255,255,255,0.45)",
                marginBottom: 10,
                fontWeight: 600,
              }}
            >
              {t.login.tagline}
            </p>
            <h2
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 22,
                fontWeight: 300,
                color: "#fff",
                lineHeight: 1.45,
                margin: 0,
              }}
            >
              {t.login.titulo}
            </h2>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.7,
                marginTop: 14,
              }}
            >
              {t.login.subtitulo}
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 20,
                marginTop: 32,
              }}
            >
              {[t.login.pill1, t.login.pill2, t.login.pill3].map((label) => (
                <div key={label}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#fff",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 36,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                padding: "16px 18px",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.6,
                }}
              >
                {t.login.garantiaTexto}
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "#fff",
            padding: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { lang } = useLang();
  const t = useTranslation(lang);
  const emailParam = searchParams.get("email")?.trim() || "";
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  useEffect(() => {
    const intended = getRedirectFromSearchParams(searchParams);
    if (intended) persistAuthRedirect(intended);
  }, [searchParams]);

  const intendedRedirect = getRedirectFromSearchParams(searchParams);
  const registroHref = buildRegistroUrl(intendedRedirect);
  const registroProveedorHref = buildRegistroUrl(intendedRedirect, {
    role: "proveedor",
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    const redirectTo = signInData.user
      ? await resolveAuthRedirect(searchParams, fetchPostLoginRedirect)
      : "/dashboard";

    setLoading(false);
    router.push(redirectTo);
  }

  return (
    <AuthShell>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 20,
          fontWeight: 300,
          color: "#1a1a1a",
          margin: 0,
        }}
      >
        {t.login.formTitulo}
      </h1>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
        {t.login.formSubtitulo}
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 28 }}>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email" style={labelStyle}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 8 }}>
          <label htmlFor="password" style={labelStyle}>
            {t.login.labelContrasena}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ textAlign: "right", marginBottom: 20 }}>
          <Link
            href="/recuperar-contrasena"
            style={{
              fontSize: 10,
              color: PRIMARY,
              textDecoration: "none",
            }}
          >
            {t.login.olvidaste}
          </Link>
        </div>

        {error && (
          <p
            style={{
              marginBottom: 16,
              padding: "10px 12px",
              borderRadius: 6,
              background: "#fef2f2",
              fontSize: 12,
              color: "#b91c1c",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: PRIMARY,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? t.login.iniciando : t.login.entrar}
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "24px 0",
          }}
        >
          <div style={{ flex: 1, height: 1, background: BORDER }} />
          <span style={{ fontSize: 11, color: "#bbb" }}>{t.login.o}</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <p style={{ fontSize: 12, color: "#888", textAlign: "center", margin: 0 }}>
          {t.login.sinCuenta}{" "}
          <Link href={registroHref} style={{ color: PRIMARY, textDecoration: "none" }}>
            {t.login.registrarse}
          </Link>
        </p>
        <p
          style={{
            fontSize: 12,
            color: "#888",
            textAlign: "center",
            marginTop: 10,
          }}
        >
          {t.login.serProveedor}{" "}
          <Link
            href={registroProveedorHref}
            style={{ color: PRIMARY, textDecoration: "none" }}
          >
            {t.login.unete}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center font-sans"
          style={{ background: WARM }}
        >
          <p style={{ fontSize: 12, color: "#888" }}>Cargando…</p>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
