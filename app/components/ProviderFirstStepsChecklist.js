"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AyudaLink from "@/app/components/AyudaLink";
import { hasDniUploaded } from "@/app/lib/dni";
import { hasEmailContacto, hasTelefono } from "@/app/lib/profile-telefono";
import { supabase } from "@/app/lib/supabase";

/**
 * Checklist de activación: distingue acciones del proveedor vs revisión del equipo.
 */
export default function ProviderFirstStepsChecklist({
  perfil,
  accountEmail = null,
  BRAND,
  onConfigureCobros = null,
  configureCobrosLoading = false,
}) {
  const [services, setServices] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadServices() {
      if (!perfil?.id) return;
      const { data, error } = await supabase
        .from("services")
        .select("id, vertical, nru, nru_estado, revision_estado, disponible")
        .eq("proveedor_id", perfil.id);
      if (!cancelled && !error) {
        setServices(data || []);
      }
    }
    loadServices();
    return () => {
      cancelled = true;
    };
  }, [perfil?.id]);

  if (perfil?.role !== "proveedor") return null;

  const dniSubido = hasDniUploaded(perfil);
  const dniVerificado = perfil?.dni_estado === "verificado";
  const dniRechazado = perfil?.dni_estado === "rechazado";
  const edadOk = perfil?.mayor_de_edad_confirmada === true;
  const identidadOk = dniVerificado && edadOk;
  const verificado = perfil?.verificado === true;
  const cobrosOk = perfil?.cobros_activos === true;
  const tieneStripeAccount = Boolean(perfil?.stripe_account_id);
  const contactoOk =
    hasTelefono(perfil) && hasEmailContacto(perfil, accountEmail);
  const tieneServicio = services.length > 0;

  const verticals = new Set(services.map((s) => s.vertical).filter(Boolean));
  const showNinos = !tieneServicio || verticals.has("ninos");
  const showMascotas = !tieneServicio || verticals.has("mascotas");
  const showAlojamiento = !tieneServicio || verticals.has("alojamiento");
  const tieneAnuncioAprobado = services.some(
    (s) => s.revision_estado == null || s.revision_estado === "aprobado",
  );

  const ninosDocsOk = perfil?.ninos_documentacion_aprobada === true;
  const mascotasDocsOk = perfil?.mascotas_documentacion_aprobada === true;
  const alojamientoServices = services.filter((s) => s.vertical === "alojamiento");
  const nruOk =
    alojamientoServices.length > 0 &&
    alojamientoServices.every((s) => s.nru_estado === "verificado");
  const nruPendiente =
    alojamientoServices.length > 0 &&
    alojamientoServices.some((s) => s.nru_estado !== "verificado");

  /** @type {Array<{ id: string, actor: 'proveedor'|'equipo', label: string, done: boolean, href?: string, cta?: string, hint?: string|null, urgent?: boolean }>} */
  const steps = [];

  // —— Acciones del proveedor ——
  steps.push({
    id: "dni-subir",
    actor: "proveedor",
    label: "Sube tu DNI, NIE o pasaporte",
    done: dniSubido && !dniRechazado,
    href: "/subir-dni",
    cta: dniRechazado ? "Volver a subir documento" : "Subir documento",
    hint: dniRechazado
      ? "Tu documento fue rechazado. Súbelo de nuevo para que el equipo lo revise."
      : null,
    urgent: dniRechazado,
  });

  steps.push({
    id: "cobros",
    actor: "proveedor",
    label: "Configura tus cobros (Stripe) para recibir pagos",
    done: cobrosOk,
    href: "/dashboard?tab=proveedor",
    cta: tieneStripeAccount && !cobrosOk
      ? "Completar configuración de cobros"
      : "Configurar cobros",
    hint: !cobrosOk
      ? verificado && tieneAnuncioAprobado
        ? "Último paso: con los cobros activos tu anuncio empieza a recibir reservas."
        : "Sin cobros activos no puedes recibir reservas ni pagos."
      : null,
    urgent: verificado && identidadOk && !cobrosOk,
  });

  steps.push({
    id: "contacto",
    actor: "proveedor",
    label: "Añade teléfono y email de contacto",
    done: contactoOk,
    href: "/editar-perfil?tab=perfil",
    cta: "Completar datos",
  });

  steps.push({
    id: "servicio",
    actor: "proveedor",
    label: "Publica tu primer servicio",
    done: tieneServicio,
    href: "/editar-perfil?tab=servicios",
    cta: "Crear anuncio",
    hint: !tieneServicio
      ? "Sin anuncio no puedes recibir reservas."
      : null,
  });

  // —— Revisión del equipo ——
  if (dniSubido && !identidadOk && !dniRechazado) {
    steps.push({
      id: "dni-revision",
      actor: "equipo",
      label: "Estamos verificando tu DNI y tu mayoría de edad",
      done: false,
      hint: "El equipo revisa tu documento (suele ser en menos de 24h). No tienes que hacer nada más por ahora.",
    });
  } else if (identidadOk) {
    steps.push({
      id: "dni-revision",
      actor: "equipo",
      label: "Identidad y mayoría de edad verificadas",
      done: true,
    });
  }

  if (dniSubido && !verificado) {
    steps.push({
      id: "cuenta-revision",
      actor: "equipo",
      label: "Estamos revisando tu cuenta de proveedor",
      done: false,
      hint: identidadOk
        ? "Cuando te aprueben, te avisaremos por email."
        : "Primero debe verificarse tu documento de identidad.",
    });
  } else if (verificado) {
    steps.push({
      id: "cuenta-revision",
      actor: "equipo",
      label: "Cuenta de proveedor aprobada",
      done: true,
    });
  }

  if (showNinos) {
    steps.push({
      id: "docs-ninos",
      actor: "equipo",
      label: tieneServicio && !verticals.has("ninos")
        ? "Documentación de niñera (si ofreces cuidado de niños)"
        : "Estamos revisando tu documentación de niñera",
      done: ninosDocsOk,
      hint: ninosDocsOk
        ? null
        : !tieneServicio || verticals.has("ninos")
          ? "Sube antecedentes (y el documento sexual si aplica) en tu perfil; el equipo los aprueba antes de activar anuncios de niños."
          : "Si más adelante ofreces cuidado de niños, el equipo deberá aprobar esa documentación.",
    });
  }

  if (showMascotas) {
    steps.push({
      id: "docs-mascotas",
      actor: "equipo",
      label: tieneServicio && !verticals.has("mascotas")
        ? "Documentación de mascotas (si ofreces ese servicio)"
        : "Estamos revisando tu documentación de mascotas",
      done: mascotasDocsOk,
      hint: mascotasDocsOk
        ? null
        : !tieneServicio || verticals.has("mascotas")
          ? "Sube los documentos requeridos en tu perfil; el equipo los aprueba antes de activar anuncios de mascotas."
          : "Si más adelante ofreces cuidado de mascotas, el equipo deberá aprobar esa documentación.",
    });
  }

  if (showAlojamiento) {
    steps.push({
      id: "nru",
      actor: "equipo",
      label: nruOk
        ? "NRU de alojamiento verificado"
        : nruPendiente
          ? "Estamos verificando tu NRU (alojamiento)"
          : "NRU de alojamiento (si ofreces alojamiento)",
      done: nruOk,
      hint: nruOk
        ? null
        : nruPendiente
          ? "El equipo verifica el número de registro turístico de tus anuncios de alojamiento."
          : "Al publicar alojamiento, declara el NRU; el equipo lo verificará antes de activar el anuncio.",
    });
  }

  const proveedorSteps = steps.filter((s) => s.actor === "proveedor");
  const equipoSteps = steps.filter((s) => s.actor === "equipo");
  const doneProveedor = proveedorSteps.filter((s) => s.done).length;
  const doneEquipo = equipoSteps.filter((s) => s.done).length;

  const onlyCobrosLeft =
    cobrosOk === false &&
    identidadOk &&
    verificado &&
    contactoOk &&
    tieneServicio &&
    tieneAnuncioAprobado;

  const allCoreDone =
    identidadOk &&
    verificado &&
    cobrosOk &&
    contactoOk &&
    tieneServicio;

  if (allCoreDone) {
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
          {(!ninosDocsOk && verticals.has("ninos")) ||
          (!mascotasDocsOk && verticals.has("mascotas")) ||
          nruPendiente
            ? " Algunos anuncios concretos pueden seguir pendientes de documentación o NRU."
            : ""}
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
        <div>
          <AyudaLink label="¿Necesitas ayuda?" />
        </div>
      </div>
    );
  }

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
        Tú: {doneProveedor}/{proveedorSteps.length} · Equipo: {doneEquipo}/
        {equipoSteps.length}
      </p>

      {onlyCobrosLeft && (
        <div
          style={{
            marginTop: 12,
            padding: "14px 16px",
            borderRadius: 8,
            background: "#e6f4f0",
            border: `1px solid ${BRAND.green}`,
          }}
        >
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#085041" }}>
            ¡Tu anuncio está aprobado! ✓
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#085041", lineHeight: 1.5 }}>
            Solo te falta configurar tus cobros para empezar a recibir reservas.
            Es el último paso: estás a un clic de estar activo.
          </p>
          {typeof onConfigureCobros === "function" ? (
            <button
              type="button"
              onClick={onConfigureCobros}
              disabled={configureCobrosLoading}
              style={{
                display: "inline-block",
                marginTop: 12,
                minHeight: 40,
                padding: "10px 18px",
                borderRadius: 6,
                border: "none",
                background: BRAND.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: configureCobrosLoading ? "not-allowed" : "pointer",
                opacity: configureCobrosLoading ? 0.7 : 1,
              }}
            >
              {configureCobrosLoading
                ? "Conectando…"
                : tieneStripeAccount && !cobrosOk
                  ? "Completar cobros →"
                  : "Configurar cobros →"}
            </button>
          ) : (
            <Link
              href="/dashboard?tab=proveedor"
              style={{
                display: "inline-block",
                marginTop: 12,
                minHeight: 40,
                padding: "10px 18px",
                borderRadius: 6,
                background: BRAND.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Configurar cobros →
            </Link>
          )}
        </div>
      )}

      <SectionTitle color="#5c4a32">Lo que debes hacer tú</SectionTitle>
      <StepList steps={proveedorSteps} BRAND={BRAND} showCta />

      <SectionTitle color="#5c4a32">En revisión por el equipo</SectionTitle>
      <p style={{ margin: "0 0 4px", fontSize: 11, color: "#8a7355", lineHeight: 1.4 }}>
        Estos pasos los completa Home&amp;Heart. Te avisamos por email y en la
        app cuando cambien.
      </p>
      <StepList steps={equipoSteps} BRAND={BRAND} showCta={false} />

      <div style={{ marginTop: 14 }}>
        <AyudaLink
          highlighted={onlyCobrosLeft || (!allCoreDone && verificado)}
          href={
            onlyCobrosLeft
              ? "/ayuda?asunto=No%20puedo%20activar%20mi%20anuncio&destacado=1"
              : "/ayuda"
          }
          label={
            onlyCobrosLeft
              ? "¿Atascado? Contactar con soporte"
              : "¿Necesitas ayuda?"
          }
        />
      </div>
    </div>
  );
}

function SectionTitle({ children, color }) {
  return (
    <p
      style={{
        margin: "14px 0 0",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </p>
  );
}

function StepList({ steps, BRAND, showCta }) {
  if (steps.length === 0) return null;
  return (
    <ol style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
      {steps.map((step, index) => (
        <li
          key={step.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            padding: "8px 0",
            borderTop:
              index === 0 ? "none" : "0.5px solid rgba(196,125,26,0.25)",
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
              color: step.done ? "#fff" : step.urgent ? "#b91c1c" : "#c47d1a",
              border: step.done
                ? "none"
                : `1.5px solid ${step.urgent ? "#b91c1c" : "#c47d1a"}`,
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
              <p
                style={{
                  margin: "3px 0 0",
                  fontSize: 11,
                  color: "#8a7355",
                  lineHeight: 1.4,
                }}
              >
                {step.hint}
              </p>
            )}
            {showCta && !step.done && step.href && step.cta && (
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
  );
}
