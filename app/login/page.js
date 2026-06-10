"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/app/lib/supabase";

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
            Donde estés, estamos.
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
              Confianza local
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
              Servicios de confianza para familias{" "}
              <em style={{ color: "rgba(255,255,255,0.65)", fontStyle: "italic" }}>
                en movimiento
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
              Alojamiento, niñera y cuidado de mascotas verificados por personas
              reales de tu comunidad.
            </p>

            <div
              style={{
                display: "flex",
                gap: 28,
                marginTop: 32,
              }}
            >
              {[
                { num: "340+", label: "Proveedores" },
                { num: "1.200+", label: "Reservas" },
                { num: "4.9★", label: "Valoración" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 200,
                      color: "#fff",
                    }}
                  >
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
                &ldquo;Encontramos una niñera increíble en dos días. La tranquilidad
                no tiene precio.&rdquo;
              </p>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 10,
                  color: "rgba(255,255,255,0.4)",
                }}
              >
                — Laura M., Madrid
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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
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
        Iniciar sesión
      </h1>
      <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
        Accede a tu cuenta de Home&Heart
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
            Contraseña
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
            ¿Olvidaste tu contraseña?
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
          {loading ? "Iniciando sesión…" : "Entrar →"}
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
          <span style={{ fontSize: 11, color: "#bbb" }}>o</span>
          <div style={{ flex: 1, height: 1, background: BORDER }} />
        </div>

        <p style={{ fontSize: 12, color: "#888", textAlign: "center", margin: 0 }}>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" style={{ color: PRIMARY, textDecoration: "none" }}>
            Regístrate gratis
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
          ¿Quieres ser proveedor?{" "}
          <Link
            href="/registro?role=proveedor"
            style={{ color: PRIMARY, textDecoration: "none" }}
          >
            Únete aquí
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
