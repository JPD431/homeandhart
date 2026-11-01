"use client";

import Link from "next/link";
import { useLang } from "@/app/lib/LangContext";
import { useTranslation } from "@/app/lib/i18n";

export const PRIMARY = "#1d4f91";
export const DARK = "#163a6b";
export const WARM = "#f7f5f2";
export const BORDER = "#e8e4de";

export const inputStyle = {
  width: "100%",
  background: WARM,
  border: `1px solid ${BORDER}`,
  borderRadius: 6,
  padding: "10px 12px",
  fontSize: 13,
  color: "#1a1a1a",
  outline: "none",
};

export const labelStyle = {
  display: "block",
  fontSize: 8,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#bbb",
  marginBottom: 6,
  fontWeight: 600,
};

export function AuthShell({ children }) {
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
