"use client";

import Link from "@/app/components/LocaleLink";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  AuthError,
  AuthShell,
  AuthStatus,
  PRIMARY,
  inputStyle,
  labelStyle,
} from "@/app/components/AuthShell";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";
import { authErrorMessage } from "@/app/lib/auth-errors";

export default function RecuperarContrasenaPage() {
  const { lang } = useLang();
  const t = useTranslation(lang);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    // ConfirmationURL (plantilla por defecto) aterriza aquí con ?code= / hash.
    // Si pasas la plantilla a token_hash, el enlace debe ir a
    // /api/auth/callback?token_hash=...&type=recovery (ver docs internas).
    const redirectTo = `${(process.env.NEXT_PUBLIC_URL || window.location.origin).replace(/\/$/, "")}/nueva-contrasena`;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );

    setLoading(false);

    if (resetError) {
      setError(authErrorMessage(resetError, t));
      return;
    }

    setSuccess(true);
  }

  return (
    <AuthShell>
      <h1
        style={{
          fontFamily: "Georgia, serif",
          fontSize: 24,
          fontWeight: 300,
          color: "#1a1a1a",
          margin: 0,
        }}
      >
        {t.recuperarContrasena.titulo}
      </h1>
      <p style={{ fontSize: 12, color: "#6b6b6b", marginTop: 6 }}>
        {t.recuperarContrasena.subtitulo}
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
            aria-required="true"
            aria-invalid={error ? "true" : undefined}
            aria-describedby={error ? "recuperar-error" : undefined}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            style={inputStyle}
          />
        </div>

        {success && (
          <AuthStatus style={{ marginBottom: 16 }}>
            {t.recuperarContrasena.emailEnviado}
          </AuthStatus>
        )}

        {error && (
          <AuthError id="recuperar-error" style={{ marginBottom: 16 }}>
            {error}
          </AuthError>
        )}

        <button
          type="submit"
          disabled={loading || success}
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
            opacity: loading || success ? 0.7 : 1,
          }}
        >
          {loading
            ? t.recuperarContrasena.enviando
            : t.recuperarContrasena.enviarInstrucciones}
        </button>

        <p
          style={{
            fontSize: 12,
            color: "#6b6b6b",
            textAlign: "center",
            margin: "24px 0 0",
          }}
        >
          <Link
            href="/login"
            style={{ color: PRIMARY, textDecoration: "underline" }}
          >
            {t.recuperarContrasena.volver}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
