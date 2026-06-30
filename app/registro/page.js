"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { fetchPostLoginRedirect } from "@/app/lib/post-login-redirect";
import { supabase } from "@/app/lib/supabase";

const PRIMARY = "#1d4f91";
const DARK = "#163a6b";
const WARM = "#f7f5f2";
const BORDER = "#e8e4de";
const LIGHT = "#e8f0fb";

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

const ROLES = [
  {
    id: "cliente",
    emoji: "👨‍👩‍👧",
    title: "Soy familia",
    subtitle: "Busco servicios",
  },
  {
    id: "proveedor",
    emoji: "⭐",
    title: "Soy proveedor",
    subtitle: "Ofrezco servicios",
  },
];

function AuthShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: WARM, fontFamily: "sans-serif" }}>
      {/* MINI NAV */}
      <div
        style={{
          height: 57,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          borderBottom: `1px solid ${BORDER}`,
          background: WARM,
        }}
      >
        <Link href="/" style={{ lineHeight: 1.2, textDecoration: "none" }}>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 18,
              color: "#1a1a1a",
              fontWeight: 600,
            }}
          >
            Home<span style={{ fontStyle: "italic", color: PRIMARY }}>&</span>Heart
          </span>
          <span style={{ display: "block", fontSize: 10, color: "#bbb", marginTop: 2 }}>
            Donde estés, estamos.
          </span>
        </Link>
      </div>

      {/* LAYOUT */}
      <div style={{ display: "flex", minHeight: "calc(100vh - 57px)" }}>
        {/* LADO AZUL — solo desktop */}
        <div
          className="hidden md:flex"
          style={{
            flex: 1,
            background: `linear-gradient(160deg, ${PRIMARY} 0%, ${DARK} 100%)`,
            flexDirection: "column",
            justifyContent: "flex-start",
            overflow: "hidden",
            position: "relative",
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
              top: 0,
              left: 0,
              width: 160,
              height: 160,
              objectFit: "contain",
              zIndex: 2,
            }}
          />

          <div style={{ position: "relative", zIndex: 3, padding: "160px 32px 40px", maxWidth: 380 }}>
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
              Únete gratis
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
              La forma más humana de encontrar{" "}
              <em style={{ color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
                ayuda cerca de ti
              </em>
            </h2>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.45)",
                lineHeight: 1.7,
                marginTop: 14,
              }}
            >
              Crea tu cuenta en un minuto y empieza a reservar o a ofrecer tus
              servicios con total confianza.
            </p>

            <div style={{ display: "flex", gap: 28, marginTop: 32 }}>
              {[
                { num: "340+", label: "Proveedores" },
                { num: "1.200+", label: "Reservas" },
                { num: "3", label: "Sin comisión" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div style={{ fontSize: 18, fontWeight: 200, color: "#fff" }}>
                    {stat.num}
                  </div>
                  <div
                    style={{
                      fontSize: 8,
                      color: "rgba(255,255,255,0.35)",
                      marginTop: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {stat.label}
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
              <div style={{ color: "#f5c542", fontSize: 12, letterSpacing: 2 }}>
                ★★★★★
              </div>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "rgba(255,255,255,0.75)",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                &ldquo;Registrarse fue rapidísimo. En una semana ya teníamos
                cuidador de mascotas fijo.&rdquo;
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                — Carlos R., Barcelona
              </p>
            </div>
          </div>
        </div>

        {/* FORMULARIO — ocupa todo en móvil, mitad en desktop */}
        <div style={{ flex: 1, padding: "32px 24px", background: "#fff", overflowY: "auto" }}>
          <div style={{ maxWidth: 420, margin: "0 auto", paddingBottom: 60 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function RegistroForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref")?.trim() || null;
  const roleParam = searchParams.get("role");

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("cliente");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [mensajeVerificacion, setMensajeVerificacion] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState(refCode || "");
  const [mostrarCodigoInvitacion, setMostrarCodigoInvitacion] = useState(!!refCode);

  useEffect(() => {
    if (roleParam === "proveedor") setRole("proveedor");
  }, [roleParam]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    const codigoTrim = codigoInvitacion.trim();
    if (codigoTrim) {
      const response = await fetch("/api/referidos/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: codigoTrim }),
      });

      const { valid } = await response.json();

      if (!valid) {
        setError("Código no válido");
        return;
      }
    }

    setLoading(true);

    console.log("Datos registro:", { nombre, apellido, role, email });

    const emailRedirectTo = `${window.location.origin}/api/auth/callback`;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          nombre,
          apellido,
          role,
          codigo_referido: codigoTrim || null,
        },
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    setLoading(false);

    if (data.user && !data.user.email_confirmed_at) {
      setMensajeVerificacion(true);
      return;
    }

    if (data.user) {
      const redirectTo = await fetchPostLoginRedirect();
      router.push(redirectTo);
      return;
    }

    router.push("/completar-perfil");
  }

  async function handleResendEmail() {
    setResendLoading(true);
    setResendMessage("");
    setError("");

    const emailRedirectTo = `${window.location.origin}/api/auth/callback`;

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo,
      },
    });

    setResendLoading(false);

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResendMessage("Email de verificación reenviado.");
  }

  if (mensajeVerificacion) {
    return (
      <AuthShell>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 20,
              fontWeight: 300,
              color: "#1a1a1a",
              margin: 0,
            }}
          >
            Revisa tu email
          </h1>
          <p style={{ fontSize: 12, color: "#888", marginTop: 12, lineHeight: 1.7 }}>
            Te hemos enviado un enlace de verificación a{" "}
            <strong style={{ color: "#1a1a1a" }}>{email}</strong>. Haz clic en el
            enlace para activar tu cuenta.
          </p>
          <p style={{ fontSize: 11, color: "#bbb", marginTop: 12 }}>
            ¿No lo ves? Revisa la carpeta de spam.
          </p>
          {error && (
            <p
              style={{
                marginTop: 16,
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
          {resendMessage && (
            <p
              style={{
                marginTop: 16,
                padding: "10px 12px",
                borderRadius: 6,
                background: "#ecfdf5",
                fontSize: 12,
                color: "#047857",
              }}
            >
              {resendMessage}
            </p>
          )}
          <button
            type="button"
            onClick={handleResendEmail}
            disabled={resendLoading}
            className="min-h-[44px]"
            style={{
              marginTop: 24,
              width: "100%",
              background: PRIMARY,
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "12px 16px",
              fontSize: 13,
              fontWeight: 500,
              cursor: resendLoading ? "wait" : "pointer",
              opacity: resendLoading ? 0.7 : 1,
            }}
          >
            {resendLoading ? "Reenviando…" : "Reenviar email"}
          </button>
          <Link
            href="/"
            style={{
              display: "inline-block",
              marginTop: 16,
              fontSize: 12,
              color: PRIMARY,
              textDecoration: "none",
            }}
          >
            Volver al inicio
          </Link>
        </div>
      </AuthShell>
    );
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
        Crear cuenta
      </h1>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
        Es gratis y solo tarda un minuto
      </p>

      <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
        <div className="mb-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {ROLES.map((option) => {
            const isSelected = role === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setRole(option.id)}
                className="min-h-[44px] text-left"
                style={{
                  padding: "12px 14px",
                  borderRadius: 8,
                  border: `2px solid ${isSelected ? PRIMARY : BORDER}`,
                  background: isSelected ? LIGHT : "#fff",
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 16 }}>{option.emoji}</span>
                <span
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 600,
                    color: isSelected ? PRIMARY : "#1a1a1a",
                    marginTop: 6,
                  }}
                >
                  {option.title}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    color: "#888",
                    marginTop: 2,
                  }}
                >
                  · {option.subtitle}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="nombre" style={labelStyle}>
              Nombre
            </label>
            <input
              id="nombre"
              type="text"
              autoComplete="given-name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="min-h-[44px]"
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="apellido" style={labelStyle}>
              Apellido
            </label>
            <input
              id="apellido"
              type="text"
              autoComplete="family-name"
              value={apellido}
              onChange={(e) => setApellido(e.target.value)}
              className="min-h-[44px]"
              style={inputStyle}
            />
          </div>
        </div>

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
            className="min-h-[44px]"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password" style={labelStyle}>
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="min-h-[44px]"
            style={inputStyle}
          />
          <p style={{ fontSize: 10, color: "#bbb", marginTop: 6 }}>
            Mínimo 8 caracteres
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="confirmPassword" style={labelStyle}>
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="min-h-[44px]"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          {!mostrarCodigoInvitacion ? (
            <button
              type="button"
              onClick={() => setMostrarCodigoInvitacion(true)}
              className="min-h-[44px]"
              style={{
                background: "none",
                border: "none",
                padding: "0 4px",
                fontSize: 10,
                color: PRIMARY,
                cursor: "pointer",
              }}
            >
              🎁 ¿Tienes código de invitación? Añadir
            </button>
          ) : (
            <div>
              <label htmlFor="codigoInvitacion" style={labelStyle}>
                Código de invitación
              </label>
              <div style={{ position: "relative" }}>
                <span
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: 14,
                  }}
                >
                  🎁
                </span>
                <input
                  id="codigoInvitacion"
                  type="text"
                  value={codigoInvitacion}
                  onChange={(e) => setCodigoInvitacion(e.target.value)}
                  placeholder="Ej: HH-MARIA3"
                  className="min-h-[44px]"
                  style={{ ...inputStyle, paddingLeft: 36 }}
                />
              </div>
              {refCode && codigoInvitacion.trim() === refCode && (
                <p
                  style={{
                    marginTop: 8,
                    padding: "8px 12px",
                    borderRadius: 6,
                    background: "#e6f4f0",
                    fontSize: 10,
                    color: "#0e7a5c",
                    fontWeight: 500,
                  }}
                >
                  ✓ Aplicado · 1 reserva extra sin comisión
                </p>
              )}
            </div>
          )}
        </div>

        <label
          htmlFor="terminos"
          className="mb-5 flex min-h-[44px] cursor-pointer items-start gap-3"
        >
          <input
            type="checkbox"
            id="terminos"
            checked={aceptaTerminos}
            onChange={(e) => setAceptaTerminos(e.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 cursor-pointer"
          />
          <span style={{ fontSize: 11, color: "#666", lineHeight: 1.6 }}>
            He leído y acepto los{" "}
            <Link href="/legal/terminos" target="_blank" style={{ color: PRIMARY }}>
              Términos de uso
            </Link>{" "}
            y la{" "}
            <Link href="/legal/privacidad" target="_blank" style={{ color: PRIMARY }}>
              Política de privacidad
            </Link>{" "}
            de Home&Heart
          </span>
        </label>

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
          disabled={loading || !aceptaTerminos}
          className="min-h-[44px]"
          style={{
            width: "100%",
            background: loading || !aceptaTerminos ? "#9ca3af" : PRIMARY,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "12px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: loading || !aceptaTerminos ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creando cuenta…" : "Crear cuenta gratis →"}
        </button>

        <p
          style={{
            fontSize: 12,
            color: "#888",
            textAlign: "center",
            marginTop: 20,
          }}
        >
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" style={{ color: PRIMARY, textDecoration: "none" }}>
            Iniciar sesión
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

export default function RegistroPage() {
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
      <RegistroForm />
    </Suspense>
  );
}
