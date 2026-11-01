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
import {
  AuthShell,
  PRIMARY,
  WARM,
  inputStyle,
  labelStyle,
} from "@/app/components/AuthShell";
import { authErrorMessage } from "@/app/lib/auth-errors";


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
      setError(authErrorMessage(signInError, t));
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

        <p style={{ fontSize: 12, color: "#888", textAlign: "center", margin: "24px 0 0" }}>
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
