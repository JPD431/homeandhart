"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasDniUploaded } from "@/app/lib/dni";
import { hasEmailContacto, hasTelefono } from "@/app/lib/profile-telefono";
import { getServiceActivationBlockers } from "@/app/lib/provider-publicacion";
import { supabase } from "@/app/lib/supabase";

/**
 * Checklist de primeros pasos para proveedor (documentación → aprobación → cobros → anuncio).
 */
export default function ProviderFirstStepsChecklist({
  perfil,
  accountEmail = null,
  BRAND,
}) {
  const [serviceCount, setServiceCount] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCount() {
      if (!perfil?.id) return;
      const { count, error } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("proveedor_id", perfil.id);
      if (!cancelled && !error) {
        setServiceCount(count ?? 0);
      }
    }
    loadCount();
    return () => {
      cancelled = true;
    };
  }, [perfil?.id]);

  if (perfil?.role !== "proveedor") return null;

  const dniOk = hasDniUploaded(perfil);
  const edadOk = perfil?.mayor_de_edad_confirmada === true;
  const verificado = perfil?.verificado === true;
  const cobrosOk = perfil?.cobros_activos === true;
  const contactoOk =
    hasTelefono(perfil) && hasEmailContacto(perfil, accountEmail);
  const tieneServicio = (serviceCount ?? 0) > 0;

  const steps = [
    {
      id: "dni",
      label: "Sube tu DNI, NIE o pasaporte",
      done: dniOk,
      href: "/subir-dni",
      cta: "Subir documento",
    },
    {
      id: "edad",
      label: "Confirma que eres mayor de edad",
      done: edadOk,
      href: "/editar-perfil?tab=perfil",
      cta: "Ir al perfil",
    },
    {
      id: "aprobacion",
      label: "Espera la aprobación del equipo",
      done: verificado,
      hint: dniOk && edadOk && !verificado
        ? "Tu cuenta está en revisión (suele ser en menos de 24h)."
        : !dniOk
          ? "Primero sube tu documento de identidad."
          : null,
    },
    {
      id: "cobros",
      label: "Configura tus cobros para recibir pagos",
      done: cobrosOk,
      href: "/dashboard?tab=proveedor",
      cta: "Configurar cobros",
      hint: verificado && !cobrosOk
        ? "Usa el botón «Configurar cobros» de este panel."
        : null,
    },
    {
      id: "contacto",
      label: "Completa teléfono y email de contacto",
      done: contactoOk,
      href: "/editar-perfil?tab=perfil",
      cta: "Completar datos",
    },
    {
      id: "servicio",
      label: "Publica tu primer servicio",
      done: tieneServicio,
      href: "/editar-perfil?tab=servicios",
      cta: "Crear anuncio",
      hint:
        tieneServicio === false && serviceCount === 0
          ? "Sin anuncio no puedes recibir reservas."
          : null,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const blockers = getServiceActivationBlockers(perfil, null, {
    accountEmail,
  });

  if (allDone && blockers.length === 0) {
    return (
      <div
        style={{
          marginTop: 16,
          padding: "14px 16px",
          borderRadius: 10,
          border: `1px solid ${BRAND.green}`,
          background: "#e6f4f0",
        }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#085041" }}>
          Todo listo para recibir reservas
        </p>
        <p style={{ margin: "6px 0 0", fontSize: 12, color: "#085041", lineHeight: 1.5 }}>
          Activa tus anuncios si aún están en borrador y mantén tu calendario al día.
        </p>
        <Link
          href="/editar-perfil?tab=servicios"
          style={{
            display: "inline-block",
            marginTop: 10,
            fontSize: 12,
            fontWeight: 600,
            color: BRAND.blue,
          }}
        >
          Ver mis servicios →
        </Link>
      </div>
    );
  }

  const nextOpen = steps.find((s) => !s.done);

  return (
    <div
      style={{
        marginTop: 16,
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px solid ${BRAND.amber}`,
        background: "#fdf4e7",
      }}
    >
      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#5c4a32" }}>
        Para empezar a recibir reservas
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#8a7355" }}>
        {doneCount} de {steps.length} pasos completados
        {nextOpen ? ` · Siguiente: ${nextOpen.label}` : ""}
      </p>

      <ol style={{ margin: "12px 0 0", padding: 0, listStyle: "none" }}>
        {steps.map((step, index) => (
          <li
            key={step.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 0",
              borderTop: index === 0 ? "none" : "0.5px solid rgba(196,125,26,0.25)",
            }}
          >
            <span
              aria-hidden
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                background: step.done ? BRAND.green : "#fff",
                color: step.done ? "#fff" : "#c47d1a",
                border: step.done ? "none" : "1.5px solid #c47d1a",
              }}
            >
              {step.done ? "✓" : index + 1}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: step.done ? "#085041" : "#2a3a4a",
                  textDecoration: step.done ? "line-through" : "none",
                  opacity: step.done ? 0.75 : 1,
                }}
              >
                {step.label}
              </p>
              {!step.done && step.hint && (
                <p style={{ margin: "3px 0 0", fontSize: 11, color: "#8a7355", lineHeight: 1.4 }}>
                  {step.hint}
                </p>
              )}
              {!step.done && step.href && step.cta && (
                <Link
                  href={step.href}
                  style={{
                    display: "inline-block",
                    marginTop: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    color: BRAND.blue,
                  }}
                >
                  {step.cta} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      {blockers.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 8,
            background: "#fff",
            border: "0.5px solid #e8e4de",
          }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "#b91c1c" }}>
            Por qué tus servicios aún no están visibles
          </p>
          <ul
            style={{
              margin: "6px 0 0",
              paddingLeft: 18,
              fontSize: 11,
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            {blockers.slice(0, 4).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
