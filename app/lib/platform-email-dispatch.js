import "server-only";

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { canShowProviderContact } from "@/app/lib/booking-display";
import { sequences } from "@/app/lib/email-sequences";
import { isExcludedFromUserEmailSequences } from "@/app/lib/email-sequence-recipients";
import {
  resolverEmailUsuario,
  resolverNombreUsuario,
} from "@/app/lib/email-usuario";
import { getIngresoProveedorFromBooking } from "@/app/lib/ingresos-proveedor";
import { firmarTokenConfirmacion } from "@/app/lib/confirmar-token";
import {
  BASE_URL,
  BRAND_PRIMARY,
  BRAND_LIGHT,
  BRAND_DARK,
  BRAND_GREEN,
  BRAND_WARM,
  BRAND_BORDER,
  emailLayout,
  marketingEmailLayout,
} from "@/app/lib/email-layouts";
import { buildProviderContactEmailFields } from "@/app/lib/service-contact";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "soporte@homeandheart.es";

function ctaButton(href, label) {
  return `<p style="margin:28px 0 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:6px;">${label}</a>
  </p>`;
}

function cardBlock({ emoji, title, text, href }) {
  const linkStart = href ? `<a href="${href}" style="text-decoration:none;color:inherit;">` : "";
  const linkEnd = href ? "</a>" : "";
  return `<div style="margin:12px 0;padding:16px 18px;background:${BRAND_WARM};border:1px solid ${BRAND_BORDER};border-radius:8px;">
    ${linkStart}
    <p style="margin:0;font-size:20px;">${emoji}</p>
    <p style="margin:8px 0 0;font-size:15px;font-weight:600;color:#1a1a1a;font-family:Georgia,serif;">${title}</p>
    <p style="margin:6px 0 0;font-size:14px;color:#444;line-height:1.7;">${text}</p>
    ${linkEnd}
  </div>`;
}

function clienteBienvenidaHtml(data) {
  const nombre = data.nombre || "familia";
  return marketingEmailLayout({
    title: sequences.cliente_bienvenida.asunto,
    bodyHtml: `
      <h1 style="margin:0;font-size:24px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">Bienvenida, ${nombre}</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Gracias por unirte a Home&amp;Heart. Aquí encontrarás proveedores verificados para lo que necesites, con garantía y confianza humana.
      </p>
      ${cardBlock({
        emoji: "🔍",
        title: "Buscar proveedores",
        text: "Explora niñeras, alojamiento y cuidadores de mascotas cerca de ti.",
        href: `${BASE_URL}/buscar`,
      })}
      ${cardBlock({
        emoji: "👨‍👩‍👧",
        title: "Crear grupo familiar",
        text: "Invita a tu familia y gestionad reservas juntos.",
        href: `${BASE_URL}/familia`,
      })}
      ${cardBlock({
        emoji: "🛡️",
        title: "Ver garantía",
        text: "Conoce la Garantía Home&Heart: pago retenido y alternativas si algo falla.",
        href: `${BASE_URL}/garantia`,
      })}
      ${ctaButton(`${BASE_URL}/buscar`, "Empezar a explorar")}`,
  });
}

function clienteActivacionHtml() {
  return marketingEmailLayout({
    title: sequences.cliente_activacion.asunto,
    headerHtml: `<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">¿Qué necesitas?</p>`,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">¿Qué necesitas hoy?</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
        Proveedores con documentación revisada y pago protegido en Home&amp;Heart.
      </p>
      <div style="margin:20px 0 0;">
        <div style="margin:12px 0;padding:18px;background:${BRAND_WARM};border:1px solid ${BRAND_BORDER};border-radius:8px;">
          <p style="margin:0;font-size:18px;">🏠</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;font-family:Georgia,serif;">Alojamiento</p>
          <p style="margin:6px 0 0;font-size:14px;color:#444;line-height:1.7;">Desde <strong style="color:${BRAND_PRIMARY};">35€/noche</strong> · Casas y apartamentos verificados</p>
        </div>
        <div style="margin:12px 0;padding:18px;background:${BRAND_WARM};border:1px solid ${BRAND_BORDER};border-radius:8px;">
          <p style="margin:0;font-size:18px;">👶</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;font-family:Georgia,serif;">Niñera</p>
          <p style="margin:6px 0 0;font-size:14px;color:#444;line-height:1.7;">Desde <strong style="color:${BRAND_PRIMARY};">12€/hora</strong> · Cuidado infantil de confianza</p>
        </div>
        <div style="margin:12px 0;padding:18px;background:${BRAND_WARM};border:1px solid ${BRAND_BORDER};border-radius:8px;">
          <p style="margin:0;font-size:18px;">🐾</p>
          <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:#1a1a1a;font-family:Georgia,serif;">Mascotas</p>
          <p style="margin:6px 0 0;font-size:14px;color:#444;line-height:1.7;">Desde <strong style="color:${BRAND_PRIMARY};">15€/día</strong> · Paseos, cuidado y hospedaje</p>
        </div>
      </div>
      ${ctaButton(`${BASE_URL}/buscar`, "Ver proveedores disponibles")}`,
  });
}

function clientePrimeraReservaHtml(data) {
  const nombre = data.nombre || "familia";
  return marketingEmailLayout({
    title: sequences.cliente_primera_reserva.asunto,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">Tu primera reserva está protegida</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Hola <strong>${nombre}</strong>, aún no has hecho tu primera reserva. En Home&amp;Heart tu pago queda <strong>retenido de forma segura</strong> hasta que el servicio se complete.
      </p>
      <div style="margin:20px 0 0;padding:18px;background:${BRAND_LIGHT};border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">
          <strong>🛡️ Garantía 30 min:</strong> si el proveedor cancela con menos de 24h, te buscamos alternativas al mismo precio.
        </p>
        <p style="margin:12px 0 0;font-size:14px;color:#444;line-height:1.7;">
          <strong>💳 Pago retenido:</strong> el dinero solo se libera cuando confirmas que todo fue bien.
        </p>
      </div>
      ${ctaButton(`${BASE_URL}/buscar`, "Hacer mi primera reserva")}`,
  });
}

function proveedorCardHtml(prov) {
  const fotoBlock = prov.foto_url
    ? `<img src="${prov.foto_url}" alt="" width="56" height="56" style="border-radius:50%;object-fit:cover;display:block;" />`
    : `<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(160deg,${BRAND_PRIMARY},${BRAND_DARK});display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:600;">${(prov.nombre || "P")[0]}</div>`;

  return `<div style="margin:12px 0;padding:14px;border:1px solid ${BRAND_BORDER};border-radius:8px;background:#fff;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td width="64" valign="top">${fotoBlock}</td>
        <td valign="top" style="padding-left:12px;">
          <p style="margin:0;font-size:15px;font-weight:600;color:#1a1a1a;">${prov.nombre || "Proveedor"}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#666;">${prov.titulo || prov.vertical || "Servicio verificado"}</p>
          <p style="margin:6px 0 0;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};">${prov.precio_label || (prov.precio != null ? `${prov.precio}€` : "Consultar")}</p>
        </td>
      </tr>
    </table>
  </div>`;
}

function clienteReactivacionHtml(data) {
  const nombre = data.nombre || "familia";
  const nuevos = data.nuevos_proveedores ?? 12;
  const proveedores = Array.isArray(data.proveedores) ? data.proveedores.slice(0, 3) : [];
  const cardsHtml =
    proveedores.length > 0
      ? proveedores.map(proveedorCardHtml).join("")
      : `<p style="margin:16px 0 0;font-size:14px;color:#666;">Nuevos proveedores verificados te esperan en Home&amp;Heart.</p>`;

  return marketingEmailLayout({
    title: sequences.cliente_reactivacion.asunto,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">Te echamos de menos, ${nombre} 👋</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Hay <strong>${nuevos} nuevos proveedores verificados</strong> desde tu última visita. Estos son algunos destacados:
      </p>
      ${cardsHtml}
      ${ctaButton(`${BASE_URL}/buscar`, "Volver a explorar")}`,
  });
}

function proveedorBienvenidaHtml(data) {
  const nombre = data.nombre || "proveedor";
  const docs = Array.isArray(data.documentos_pendientes)
    ? data.documentos_pendientes
    : [
        "DNI o NIE vigente",
        "Certificado de antecedentes penales",
        "Certificado de delitos de naturaleza sexual",
        "Foto de perfil real y reciente",
      ];
  const checklistHtml = docs
    .map(
      (doc) =>
        `<li style="margin:8px 0;font-size:14px;color:#444;line-height:1.6;">☐ ${doc}</li>`,
    )
    .join("");

  return marketingEmailLayout({
    title: sequences.proveedor_bienvenida.asunto,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">Tu perfil está en revisión</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Hola <strong>${nombre}</strong>, hemos recibido tu solicitud. Nuestro equipo revisará tu documentación antes de activar tu perfil.
      </p>
      <div style="margin:24px 0 0;padding:18px;background:${BRAND_WARM};border-radius:8px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:0.06em;">Tu timeline</p>
        <p style="margin:6px 0;font-size:14px;color:#444;"><strong style="color:${BRAND_PRIMARY};">●</strong> En revisión <span style="color:#888;">← Estás aquí</span></p>
        <p style="margin:6px 0;font-size:14px;color:#888;">○ Verificado</p>
        <p style="margin:6px 0;font-size:14px;color:#888;">○ ¡Activo!</p>
      </div>
      <p style="margin:24px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>Mientras tanto:</strong> completa tu perfil al 100% para acelerar la revisión.
      </p>
      <ul style="margin:12px 0 0;padding-left:20px;">${checklistHtml}</ul>
      ${ctaButton(`${BASE_URL}/editar-perfil`, "Completar mi perfil")}`,
  });
}

function proveedorVerificadoHtml(data) {
  const nombre = data.nombre || "proveedor";
  return marketingEmailLayout({
    title: sequences.proveedor_verificado.asunto,
    headerHtml: `<p style="margin:0;font-size:28px;">🎉</p>`,
    headerBg: `background:linear-gradient(160deg, ${BRAND_GREEN} 0%, #0a5c45 100%);`,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">¡Bienvenido a la comunidad!</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
        Hola <strong>${nombre}</strong>, tu perfil ya está <strong>activo</strong> y visible para las familias.
      </p>
      <p style="margin:20px 0 0;text-align:center;">
        <span style="display:inline-block;background:#e6f4f0;color:${BRAND_GREEN};font-size:13px;font-weight:700;padding:10px 18px;border-radius:20px;">
          Tus primeras 3 reservas son SIN comisión
        </span>
      </p>
      <div style="margin:24px 0 0;padding:18px;background:${BRAND_WARM};border-radius:8px;">
        <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#1a1a1a;">Consejos para tu primera reserva</p>
        <p style="margin:6px 0;font-size:14px;color:#444;line-height:1.7;">✓ Responde rápido a los mensajes</p>
        <p style="margin:6px 0;font-size:14px;color:#444;line-height:1.7;">✓ Mantén tu calendario actualizado</p>
        <p style="margin:6px 0;font-size:14px;color:#444;line-height:1.7;">✓ Pide referencias a clientes satisfechos</p>
      </div>
      ${ctaButton(`${BASE_URL}/proveedor/${data.user_id || data.proveedor_id || ""}`, "Ver mi perfil público")}`,
  });
}

function proveedorSinActividadHtml(data) {
  const nombre = data.nombre || "proveedor";
  const consejos = [
    "Sube una foto de perfil clara y cercana",
    "Escribe una descripción personal y detallada",
    "Revisa que tu precio sea competitivo en tu zona",
    "Pide referencias a familias que ya te conocen",
    "Activa la garantía de emergencia en tu perfil",
  ];
  const consejosHtml = consejos
    .map(
      (c, i) =>
        `<p style="margin:10px 0;font-size:14px;color:#444;line-height:1.7;"><strong style="color:${BRAND_PRIMARY};">${i + 1}.</strong> ${c}</p>`,
    )
    .join("");

  return marketingEmailLayout({
    title: sequences.proveedor_sin_actividad.asunto,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;">Llevas 7 días sin reservas</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Hola <strong>${nombre}</strong>, tu perfil está activo pero aún no has recibido reservas. Estos consejos pueden ayudarte:
      </p>
      <div style="margin:20px 0 0;padding:18px;background:${BRAND_WARM};border-radius:8px;">
        ${consejosHtml}
      </div>
      ${ctaButton(`${BASE_URL}/editar-perfil`, "Mejorar mi perfil")}`,
  });
}

function proveedorOnboardingPendiente1Html(data) {
  const nombre = data.nombre || "proveedor";
  return marketingEmailLayout({
    title: sequences.proveedor_onboarding_pendiente_1.asunto,
    headerHtml: `<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Tu alta de proveedor</p>`,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">Estás a un paso</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
        Hola <strong>${nombre}</strong>, estás a un paso de ofrecer tus servicios en Home&amp;Heart.
        Continúa tu alta cuando quieras.
      </p>
      <div style="margin:20px 0 0;padding:18px;background:${BRAND_LIGHT};border-radius:8px;">
        <p style="margin:0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
          No hay prisa: retoma el proceso en el punto exacto en el que lo dejaste.
        </p>
      </div>
      ${ctaButton(`${BASE_URL}/ser-proveedor`, "Continuar mi alta")}`,
  });
}

function proveedorOnboardingPendiente2Html(data) {
  const nombre = data.nombre || "proveedor";
  return marketingEmailLayout({
    title: sequences.proveedor_onboarding_pendiente_2.asunto,
    headerHtml: `<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Sin presión</p>`,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">¿Retomamos tu alta de proveedor?</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
        Hola <strong>${nombre}</strong>, ¿retomamos tu alta de proveedor? Estamos aquí cuando quieras.
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#666;line-height:1.7;">
        Este es nuestro último recordatorio sobre este tema. Si prefieres seguir solo como cliente, no te enviaremos más emails de este tipo.
      </p>
      ${ctaButton(`${BASE_URL}/ser-proveedor`, "Retomar mi alta")}`,
  });
}

function resenaRecordatorio1Html(data) {
  const nombre = data.nombre || "Cliente";
  const servicio = data.servicio_titulo || "tu servicio";
  const bookingId = data.booking_id;
  const resenaUrl = bookingId
    ? `${BASE_URL}/resena/${bookingId}`
    : `${BASE_URL}/historial`;

  return marketingEmailLayout({
    title: sequences.resena_recordatorio_1.asunto,
    headerHtml: `<p style="margin:0;font-size:14px;color:rgba(255,255,255,0.85);">Tu opinión cuenta</p>`,
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1a1a;font-family:Georgia,serif;text-align:center;">¿Nos cuentas cómo fue?</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;text-align:center;">
        Hola <strong>${nombre}</strong>, tu opinión sobre <strong>${servicio}</strong> ayuda a otras familias a elegir con confianza.
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#666;line-height:1.7;text-align:center;">
        Si tienes un momento, deja tu reseña. Solo te pedimos esto una vez.
      </p>
      ${ctaButton(resenaUrl, "Deja tu reseña")}`,
  });
}

const MARKETING_HTML_BUILDERS = {
  cliente_bienvenida: clienteBienvenidaHtml,
  cliente_activacion: clienteActivacionHtml,
  cliente_primera_reserva: clientePrimeraReservaHtml,
  cliente_reactivacion: clienteReactivacionHtml,
  proveedor_bienvenida: proveedorBienvenidaHtml,
  proveedor_verificado: proveedorVerificadoHtml,
  proveedor_sin_actividad: proveedorSinActividadHtml,
  proveedor_onboarding_pendiente_1: proveedorOnboardingPendiente1Html,
  proveedor_onboarding_pendiente_2: proveedorOnboardingPendiente2Html,
  resena_recordatorio_1: resenaRecordatorio1Html,
};

async function logMarketingEmail(userId, tipo, bookingId = null) {
  if (!userId || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const row = { user_id: userId, tipo };
  if (bookingId) row.booking_id = bookingId;

  const { error } = await supabaseAdmin.from("email_logs").insert(row);
  if (error && error.code !== "23505") {
    console.error("[emails] Error logMarketingEmail:", error.message, {
      userId,
      tipo,
      bookingId,
    });
  }
}

async function sendMarketingSequenceEmail(data) {
  const userId = data.user_id || data.proveedor_id || data.cliente_id;
  let email = data.email;

  if (userId) {
    const resolved = await resolverEmailUsuario(userId);
    if (resolved) email = resolved;
  }

  if (!email) {
    return { error: "No se encontró el email del destinatario" };
  }

  // Defensa: no enviar ni loguear secuencias de marketing a admin/internos.
  if (isExcludedFromUserEmailSequences(userId, email)) {
    console.info(
      `[emails] Skip secuencia marketing «${data.tipo}» para cuenta interna`,
      { userId, email },
    );
    return { success: true, skipped: "internal_account" };
  }

  const { tipo } = data;
  const sequence = sequences[tipo];
  const buildHtml = MARKETING_HTML_BUILDERS[tipo];

  if (!sequence || !buildHtml) {
    return { error: `Tipo de email de secuencia no soportado: ${tipo}` };
  }

  const payload = { ...data, email };

  const result = await resend.emails.send({
    from: FROM,
    to: email,
    subject: sequence.asunto,
    html: buildHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  if (userId) {
    await logMarketingEmail(userId, tipo, data.booking_id || null);
  }

  return { success: true };
}

function formatModalidad(modalidad, vertical = null) {
  const labels = {
    domicilio_cliente:
      vertical === "mascotas" ? "En casa del dueño" : "En casa de la familia",
    domicilio_proveedor:
      vertical === "mascotas" ? "En mi casa (guardería)" : "En mi casa",
    ambas: "Las dos (el cliente elige)",
    paseos: "Paseo (recojo a la mascota)",
    todo_incluido: "En mi casa (guardería)",
  };
  return labels[modalidad] || modalidad;
}

function shouldShowProviderContactInEmail(data) {
  if (!data || data.mostrar_contacto_proveedor === false) return false;
  if (data.booking_estado) {
    return canShowProviderContact(data.booking_estado);
  }
  // Solo si el caller lo marca explícitamente (reserva ya confirmada).
  return data.mostrar_contacto_proveedor === true;
}

function proveedorContactBlock(data) {
  if (!shouldShowProviderContactInEmail(data)) return "";

  const lines = [];

  if (data.direccion_exacta) {
    lines.push(`📍 Dirección: ${data.direccion_exacta}`);
  }
  if (data.telefono_proveedor) {
    lines.push(`📞 Teléfono: ${data.telefono_proveedor}`);
  }
  if (data.modalidad) {
    lines.push(
      `🏠 Modalidad: ${formatModalidad(data.modalidad, data.vertical || null)}`,
    );
  }

  if (lines.length === 0) return "";

  const linesHtml = lines
    .map(
      (line) =>
        `<p style="margin:8px 0 0;font-size:14px;color:#222;line-height:1.6;">${line}</p>`,
    )
    .join("");

  return `<div style="margin:20px 0 0;background-color:#e8f0fb;border-radius:8px;padding:16px 20px;">
    <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND_PRIMARY};">Datos de contacto del proveedor:</p>
    ${linesHtml}
  </div>`;
}

function clienteContactBlock(data) {
  const lines = [];

  if (data.cliente_telefono) {
    lines.push(`📞 Teléfono: ${data.cliente_telefono}`);
  }
  if (data.cliente_email) {
    lines.push(`✉️ Email: ${data.cliente_email}`);
  }
  if (data.cliente_direccion) {
    lines.push(`📍 Dirección: ${data.cliente_direccion}`);
  } else if (data.cliente_direccion_a_definir === true) {
    lines.push(`📍 Dirección: A definir (coordinar por teléfono)`);
  }

  if (lines.length === 0) return "";

  const linesHtml = lines
    .map(
      (line) =>
        `<p style="margin:8px 0 0;font-size:14px;color:#222;line-height:1.6;">${line}</p>`,
    )
    .join("");

  return `<div style="margin:20px 0 0;background-color:#e8f0fb;border-radius:8px;padding:16px 20px;">
    <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND_PRIMARY};">Datos de contacto del cliente:</p>
    ${linesHtml}
  </div>`;
}

function formatEurEmail(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "0,00 €";
  return `${n.toFixed(2).replace(".", ",")} €`;
}

const CLIENT_PRICE_LABELS = new Set([
  "Total",
  "Total reserva",
  "Crédito aplicado",
  "Total a pagar",
]);

function clientPriceRows(precio_total, credito_aplicado) {
  const total = Number(precio_total);
  if (precio_total == null || precio_total === "" || !Number.isFinite(total)) {
    return [];
  }

  const credito = Number(credito_aplicado) || 0;
  if (credito <= 0) {
    return [
      [
        "Total",
        `${typeof precio_total === "string" ? precio_total : total.toFixed(2)} € (gastos de gestión incluidos)`,
      ],
    ];
  }

  const aPagar = Math.max(0, Math.round((total - credito) * 100) / 100);
  const rows = [
    ["Total reserva", formatEurEmail(total)],
    ["Crédito aplicado", `−${formatEurEmail(credito)}`],
  ];

  if (aPagar <= 0) {
    rows.push([
      "Total a pagar",
      `${formatEurEmail(0)}<span style="display:block;margin-top:4px;font-size:11px;color:#888;font-weight:400;">Cubierto con tu crédito Home&Heart</span>`,
    ]);
  } else {
    rows.push([
      "Total a pagar",
      `${formatEurEmail(aPagar)} (gastos de gestión incluidos)`,
    ]);
  }

  return rows;
}

function bundleDetailsBlock(data) {
  const servicios = Array.isArray(data.servicios) ? data.servicios : [];
  const rowsHtml = servicios
    .map(
      (svc) => `
        <tr>
          <td colspan="2" style="padding:8px 0;font-size:14px;color:#666;vertical-align:top;">${svc.titulo}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 8px;font-size:12px;color:#888;">Proveedor: ${svc.proveedor_nombre}</td>
        </tr>`,
    )
    .join("");

  const priceRowsHtml = clientPriceRows(
    data.precio_total,
    data.credito_aplicado,
  )
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 0;font-size:12px;color:#888;">${label}</td><td style="padding:8px 0;font-size:12px;color:#888;text-align:right;">${value}</td></tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
    <tr>
      <td colspan="2" style="padding:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:0.05em;">Servicios reservados</td>
    </tr>
    ${rowsHtml}
    ${priceRowsHtml}
    <tr>
      <td colspan="2" style="padding:8px 0 0;font-size:12px;color:#888;">Fechas: ${data.fecha_inicio}${data.fecha_fin && data.fecha_fin !== data.fecha_inicio ? ` — ${data.fecha_fin}` : ""}</td>
    </tr>
  </table>`;
}

function detailsBlock({
  servicio_titulo,
  fecha_inicio,
  fecha_fin,
  precio_total,
  credito_aplicado,
}) {
  const rows = [
    ["Servicio", servicio_titulo],
    ["Fecha de inicio", fecha_inicio],
    fecha_fin ? ["Fecha de fin", fecha_fin] : null,
    ...clientPriceRows(precio_total, credito_aplicado),
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      ([label, value]) => {
        const isPriceRow = CLIENT_PRICE_LABELS.has(label);
        const labelStyle = isPriceRow
          ? "padding:8px 0;font-size:12px;color:#888;width:140px;vertical-align:top;"
          : "padding:8px 0;font-size:14px;color:#666;width:140px;vertical-align:top;";
        const valueStyle = isPriceRow
          ? "padding:8px 0;font-size:12px;color:#888;"
          : "padding:8px 0;font-size:14px;color:#222;font-weight:600;";
        return `
        <tr>
          <td style="${labelStyle}">${label}</td>
          <td style="${valueStyle}">${value}</td>
        </tr>`;
      },
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
    ${rowsHtml}
  </table>`;
}

function proveedorDetailsBlock(data) {
  const {
    servicio_titulo,
    fecha_inicio,
    fecha_fin,
    precio_total,
    precio_base,
    cliente_sin_comision,
    proveedor_sin_comision,
    sinComisionProveedor,
  } = data;

  let ingresoLabel = null;
  if (precio_total != null && precio_total !== "") {
    ingresoLabel = getIngresoProveedorFromBooking(
      {
        precio_base,
        precio_total,
        cliente_sin_comision,
        proveedor_sin_comision,
      },
      { sinComisionProveedor },
    ).toFixed(2);
  }

  const rows = [
    ["Servicio", servicio_titulo],
    ["Fecha de inicio", fecha_inicio],
    fecha_fin ? ["Fecha de fin", fecha_fin] : null,
    ingresoLabel != null
      ? ["Tu ingreso estimado por esta reserva", `${ingresoLabel} €`]
      : null,
  ].filter(Boolean);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#666;width:140px;vertical-align:top;">${label}</td>
          <td style="padding:8px 0;font-size:14px;color:#222;font-weight:600;">${value}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
    ${rowsHtml}
  </table>`;
}

function clienteEmailHtml(data) {
  const isBundle = Array.isArray(data.servicios) && data.servicios.length > 0;
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Tu mensaje:</strong> ${data.mensaje}</p>`
    : "";

  if (isBundle) {
    const contactBlocks = data.servicios
      .map((svc) =>
        proveedorContactBlock({
          ...svc,
          mostrar_contacto_proveedor:
            svc.mostrar_contacto_proveedor ?? data.mostrar_contacto_proveedor,
          booking_estado: svc.booking_estado ?? data.booking_estado,
          direccion_exacta: svc.direccion_exacta,
          telefono_proveedor: svc.telefono_proveedor,
          modalidad: svc.modalidad,
        }).replace(
          "Datos de contacto del proveedor:",
          `Contacto — ${svc.proveedor_nombre}:`,
        ),
      )
      .filter(Boolean)
      .join("");

    return emailLayout({
      title: "¡Reserva confirmada! — Home&Heart",
      bodyHtml: `
        <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">¡Tu reserva está confirmada!</h1>
        ${bundleDetailsBlock(data)}
        ${mensajeBlock}
        ${contactBlocks}
        <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
          Un solo pago · distribuido automáticamente entre los proveedores. Hemos compartido tus datos de contacto para que puedan coordinarse contigo.
        </p>`,
    });
  }

  return emailLayout({
    title: "¡Reserva confirmada! — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">¡Tu reserva está confirmada!</h1>
      ${detailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Proveedor: <strong>${data.proveedor_nombre}</strong>
      </p>
      ${mensajeBlock}
      ${proveedorContactBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Hemos compartido tus datos de contacto con el proveedor para que pueda coordinarse contigo.
      </p>`,
  });
}

function reservaSolicitudEmailHtml(data) {
  const isBundle = Array.isArray(data.servicios) && data.servicios.length > 0;
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Tu mensaje:</strong> ${data.mensaje}</p>`
    : "";

  if (isBundle) {
    return emailLayout({
      title: "Hemos recibido tu solicitud — Home&Heart",
      bodyHtml: `
        <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Hemos recibido tu solicitud</h1>
        <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;text-align:center;">
          Tu solicitud está <strong>pendiente de confirmación</strong> por parte de uno o más proveedores.
          Te avisaremos por email en cuanto respondan.
        </p>
        ${bundleDetailsBlock(data)}
        ${mensajeBlock}
        <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
          El pago queda retenido de forma segura hasta que el proveedor confirme la reserva.
        </p>`,
    });
  }

  return emailLayout({
    title: "Hemos recibido tu solicitud — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Hemos recibido tu solicitud</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;text-align:center;">
        Tu solicitud está <strong>pendiente de confirmación</strong> por parte del proveedor.
        Te avisaremos por email en cuanto responda.
      </p>
      ${detailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Proveedor: <strong>${data.proveedor_nombre}</strong>
      </p>
      ${mensajeBlock}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        El pago queda retenido de forma segura hasta que el proveedor confirme la reserva.
      </p>`,
  });
}

function reservaRechazadaEmailHtml(data) {
  const fechaLabel = formatFechaReservaEmail(data.fecha_inicio, data.fecha_fin);
  const buscarUrl = `${BASE_URL}/buscar`;

  return emailLayout({
    title: "Tu solicitud no pudo confirmarse — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Tu solicitud no pudo confirmarse</h1>
      <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">
        Hola ${data.cliente_nombre ?? "Cliente"},
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>${data.proveedor_nombre || "El proveedor"}</strong> no ha podido confirmar tu solicitud de
        <strong>${data.servicio_titulo || "servicio"}</strong> para el <strong>${fechaLabel}</strong>.
      </p>
      ${detailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>No se te ha cobrado nada.</strong> Hemos liberado el pago retenido de forma segura;
        puede tardar unos días en reflejarse en tu banco.
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Seguro que encuentras otra opción que encaje contigo.
      </p>
      ${ctaButton(buscarUrl, "Buscar otras opciones")}
    `,
  });
}

function proveedorEmailHtml(data) {
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Mensaje del cliente:</strong> ${data.mensaje}</p>`
    : "";

  return emailLayout({
    title: "Nueva reserva recibida — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Has recibido una nueva reserva</h1>
      ${proveedorDetailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Cliente: <strong>${data.cliente_nombre}</strong>
      </p>
      ${mensajeBlock}
      ${clienteContactBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        El cliente recibirá tus datos de contacto para coordinarse.
      </p>`,
  });
}

function reservaConfirmadaProveedorEmailHtml(data) {
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Mensaje del cliente:</strong> ${data.mensaje}</p>`
    : "";

  return emailLayout({
    title: "Reserva confirmada — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Has confirmado la reserva</h1>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;text-align:center;">
        La reserva está <strong>confirmada</strong>. Aquí tienes los datos para coordinarte con el cliente.
      </p>
      ${proveedorDetailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Cliente: <strong>${data.cliente_nombre}</strong>
      </p>
      ${mensajeBlock}
      ${clienteContactBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        El cliente ha recibido tus datos de contacto para coordinarse contigo.
      </p>`,
  });
}

function reservaNuevaEmailHtml(data) {
  const dashboardUrl =
    data.dashboard_url ||
    `${process.env.NEXT_PUBLIC_URL || "https://homeandheart.es"}/dashboard?reserva=${data.booking_id}`;

  return emailLayout({
    title: "Nueva reserva recibida — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Nueva reserva recibida</h1>
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Hola${data.proveedor_nombre ? ` <strong>${data.proveedor_nombre}</strong>` : ""}, tienes una nueva reserva en Home&amp;Heart.
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Cliente: <strong>${data.cliente_nombre || "Un cliente"}</strong>
      </p>
      ${proveedorDetailsBlock(data)}
      <p style="margin:24px 0 0;text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
          Ver reserva
        </a>
      </p>`,
  });
}

function formatFechaReservaEmail(fechaInicio, fechaFin) {
  if (!fechaInicio) return "—";
  if (fechaFin && fechaFin !== fechaInicio) {
    return `${fechaInicio} – ${fechaFin}`;
  }
  return fechaInicio;
}

function reservaCanceladaClienteEmailHtml(data) {
  const pct = Number(data.pct) || 0;
  const precioTotal = Number(data.precio_total) || 0;
  const reembolsoTotal = Number(data.reembolso_total) || 0;
  const reembolsoTarjeta = Number(data.reembolso_tarjeta) || 0;
  const reembolsoCredito = Number(data.reembolso_credito) || 0;
  const importeFinal =
    data.importe_final != null
      ? Number(data.importe_final)
      : Math.max(0, precioTotal - reembolsoTotal);
  const creditoAplicado = Number(data.credito_aplicado) || 0;
  const importeTarjetaInicial = Math.max(0, precioTotal - creditoAplicado);
  const importeTarjetaFinal = Math.max(0, importeTarjetaInicial - reembolsoTarjeta);
  const proveedorNombre = data.proveedor_nombre || "tu proveedor";
  const servicioTitulo = data.servicio_titulo || "tu reserva";
  const fechaLabel = formatFechaReservaEmail(
    data.fecha_inicio,
    data.fecha_fin,
  );
  const historialUrl = `${BASE_URL}/historial`;

  let tarjetaHtml = "";
  if (importeTarjetaInicial > 0) {
    if (pct >= 100) {
      tarjetaHtml = `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>Tarjeta:</strong> no se te cobrará nada por esta reserva.
      </p>`;
    } else if (pct === 0 || reembolsoTarjeta <= 0) {
      tarjetaHtml = `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>Tarjeta:</strong> se mantiene el cargo de <strong>${formatEurEmail(importeTarjetaFinal)}</strong> según la política de cancelación.
      </p>`;
    } else {
      tarjetaHtml = `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        <strong>Tarjeta:</strong> cargo final de <strong>${formatEurEmail(importeTarjetaFinal)}</strong>
        (no se cobrarán los <strong>${formatEurEmail(reembolsoTarjeta)}</strong> restantes de la reserva).
        Puede tardar unos días en reflejarse en tu banco.
      </p>`;
    }
  }

  let creditoHtml = "";
  if (reembolsoCredito > 0) {
    creditoHtml = `<div style="margin:16px 0 0;padding:14px 18px;background-color:#e6f4f0;border-radius:8px;border:1px solid #c5e8dc;">
      <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">
        <strong style="color:${BRAND_GREEN};">Crédito Home&amp;Heart:</strong>
        hemos devuelto <strong>${formatEurEmail(reembolsoCredito)}</strong> a tu saldo,
        disponible en tu próxima reserva.
      </p>
    </div>`;
  }

  const devolucionLabel =
    pct > 0 ? `Devolución (${pct}%)` : "Devolución";

  return emailLayout({
    title: "Tu reserva en Home&Heart ha sido cancelada",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">
        Tu reserva ha sido cancelada
      </h1>
      <p style="margin:20px 0 0;font-size:15px;color:#444;line-height:1.7;">
        Hola ${data.cliente_nombre ?? "Cliente"}, hemos cancelado tu reserva de
        <strong>${servicioTitulo}</strong> con <strong>${proveedorNombre}</strong>
        para el <strong>${fechaLabel}</strong>.
      </p>
      <p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.7;">
        Según la política de cancelación del anuncio, te corresponde un
        <strong>${pct}%</strong> de devolución.
      </p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#666;">Total de la reserva</td>
          <td style="padding:6px 0;font-size:14px;color:#222;font-weight:600;text-align:right;">${formatEurEmail(precioTotal)}</td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#666;">${devolucionLabel}</td>
          <td style="padding:6px 0;font-size:14px;color:${BRAND_GREEN};font-weight:600;text-align:right;">−${formatEurEmail(reembolsoTotal)}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:8px 0 0;border-top:1px solid ${BRAND_BORDER};"></td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:15px;color:#222;font-weight:600;">Importe final que pagas</td>
          <td style="padding:6px 0;font-size:15px;color:${BRAND_PRIMARY};font-weight:700;text-align:right;">${formatEurEmail(importeFinal)}</td>
        </tr>
      </table>
      ${creditoHtml}
      ${tarjetaHtml}
      <p style="margin:20px 0 0;font-size:13px;color:#888;line-height:1.6;">
        El importe final es lo que pagas por esta reserva tras la cancelación.
        Si tienes dudas, puedes revisar tu historial o escribirnos.
      </p>
      ${ctaButton(historialUrl, "Ver historial de reservas")}
    `,
  });
}

async function sendReservaCanceladaClienteEmail(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  const required = [
    "cliente_email",
    "servicio_titulo",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
    if (payload[field] == null || payload[field] === "") {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.cliente_email,
    subject: "Tu reserva en Home&Heart ha sido cancelada",
    html: reservaCanceladaClienteEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendIncidenciaReembolsoClienteEmail(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  if (!payload.cliente_email) {
    return { error: "No se pudo resolver el email del cliente" };
  }

  const reembolsoTotal = Number(payload.reembolso_total) || 0;
  const reembolsoTarjeta = Number(payload.reembolso_tarjeta) || 0;
  const reembolsoCredito = Number(payload.reembolso_credito) || 0;
  const servicioTitulo = payload.servicio_titulo || "tu reserva";
  const fechas =
    payload.fecha_fin && payload.fecha_fin !== payload.fecha_inicio
      ? `${payload.fecha_inicio} — ${payload.fecha_fin}`
      : payload.fecha_inicio || "";

  let detalleReembolso = `te hemos reembolsado <strong>${formatEurEmail(reembolsoTotal)}</strong>`;
  if (reembolsoCredito > 0 && reembolsoTarjeta > 0) {
    detalleReembolso = `te hemos devuelto <strong>${formatEurEmail(reembolsoTarjeta)}</strong> a tu tarjeta y <strong>${formatEurEmail(reembolsoCredito)}</strong> a tu saldo de crédito`;
  } else if (reembolsoCredito > 0) {
    detalleReembolso = `hemos devuelto <strong>${formatEurEmail(reembolsoCredito)}</strong> a tu saldo de crédito`;
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.cliente_email,
    subject: "Incidencia resuelta — reembolso en Home&Heart",
    html: emailLayout({
      title: "Incidencia resuelta",
      bodyHtml: `
        <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Hemos resuelto tu incidencia</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
          Hola ${payload.cliente_nombre}, tras revisar el problema con <strong>${servicioTitulo}</strong>${fechas ? ` (${fechas})` : ""},
          ${detalleReembolso}.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#666;">
          Si tienes alguna duda, responde a este correo o escríbenos desde la app.
        </p>
      `,
    }),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendIncidenciaLiberadoProveedorEmail(data) {
  const payload = { ...data };

  if (payload.proveedor_id && !payload.proveedor_email) {
    payload.proveedor_email = await resolverEmailUsuario(payload.proveedor_id);
  }

  if (!payload.proveedor_nombre && payload.proveedor_id) {
    payload.proveedor_nombre =
      (await resolverNombreUsuario(payload.proveedor_id)) || "Proveedor";
  }

  if (!payload.proveedor_email) {
    return { error: "No se pudo resolver el email del proveedor" };
  }

  const importeProveedor = Number(payload.importe_proveedor) || 0;
  const servicioTitulo = payload.servicio_titulo || "tu servicio";

  const result = await resend.emails.send({
    from: FROM,
    to: payload.proveedor_email,
    subject: "Pago liberado — Home&Heart",
    html: emailLayout({
      title: "Pago liberado",
      bodyHtml: `
        <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Se ha liberado tu pago</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
          Hola ${payload.proveedor_nombre}, tras revisar la incidencia de <strong>${servicioTitulo}</strong>,
          hemos liberado el pago de <strong>${formatEurEmail(importeProveedor)}</strong> a tu cuenta.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#666;">
          El importe debería reflejarse en tu cuenta de Stripe en breve. Si tienes dudas, responde a este correo.
        </p>
      `,
    }),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendIncidenciaResueltaClienteEmail(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  if (!payload.cliente_email) {
    return { error: "No se pudo resolver el email del cliente" };
  }

  const servicioTitulo = payload.servicio_titulo || "tu reserva";
  const proveedorNombre = payload.proveedor_nombre || "el proveedor";

  const result = await resend.emails.send({
    from: FROM,
    to: payload.cliente_email,
    subject: "Incidencia resuelta — Home&Heart",
    html: emailLayout({
      title: "Incidencia resuelta",
      bodyHtml: `
        <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Incidencia resuelta</h1>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
          Hola ${payload.cliente_nombre}, tras revisar el problema con <strong>${servicioTitulo}</strong>,
          hemos cerrado la incidencia. El servicio se considera prestado correctamente por ${proveedorNombre}.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#666;">
          Si tienes alguna duda, responde a este correo o escríbenos desde la app.
        </p>
      `,
    }),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendReservaRechazadaEmail(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  const required = [
    "cliente_email",
    "cliente_nombre",
    "proveedor_nombre",
    "servicio_titulo",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
    if (payload[field] == null || payload[field] === "") {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.cliente_email,
    subject: "Tu solicitud no pudo confirmarse — Home&Heart",
    html: reservaRechazadaEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendReservaNuevaEmail(data) {
  let proveedorEmail = data.proveedor_email;

  if (data.proveedor_id) {
    proveedorEmail = await resolverEmailUsuario(data.proveedor_id);
  }

  if (!proveedorEmail) {
    return { error: "No se encontró el email del proveedor" };
  }

  let proveedorNombre = data.proveedor_nombre;
  if (!proveedorNombre && data.proveedor_id) {
    proveedorNombre =
      (await resolverNombreUsuario(data.proveedor_id)) || "Proveedor";
  }

  const payload = {
    ...data,
    proveedor_email: proveedorEmail,
    proveedor_nombre: proveedorNombre,
  };

  const required = [
    "cliente_nombre",
    "servicio_titulo",
    "fecha_inicio",
    "precio_total",
    "booking_id",
  ];

  for (const field of required) {
    if (!payload[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.proveedor_email,
    subject: "Nueva reserva recibida — Home&Heart",
    html: reservaNuevaEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendReservaConfirmadaProveedorEmail(data) {
  const payload = { ...data };

  if (payload.proveedor_id && !payload.proveedor_email) {
    payload.proveedor_email = await resolverEmailUsuario(payload.proveedor_id);
  }

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  const required = [
    "proveedor_email",
    "cliente_nombre",
    "servicio_titulo",
    "fecha_inicio",
  ];

  for (const field of required) {
    if (!payload[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.proveedor_email,
    subject: "Reserva confirmada — Home&Heart",
    html: reservaConfirmadaProveedorEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendReservaConfirmadaEmails(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  if (payload.proveedor_id && !payload.proveedor_email) {
    payload.proveedor_email = await resolverEmailUsuario(payload.proveedor_id);
  }

  if (!payload.proveedor_nombre && payload.proveedor_id) {
    payload.proveedor_nombre =
      (await resolverNombreUsuario(payload.proveedor_id)) || "Proveedor";
  }

  // Safety net: contacto desde service_contact (nunca columnas dropeadas de services).
  // Solo para emails de reserva confirmada (cliente ya puede contactar/ir).
  // Dirección solo si shouldShowProviderDireccion / needsDireccionFields
  // (alojamiento, domicilio_proveedor, todo_incluido; no paseos/domicilio_cliente).
  if (Array.isArray(payload.servicios) && payload.servicios.length > 0) {
    payload.servicios = await Promise.all(
      payload.servicios.map(async (svc) => {
        const contact = await buildProviderContactEmailFields({
          estado: svc.booking_estado || payload.booking_estado || "confirmada",
          serviceId: svc.service_id || svc.id,
          service: {
            ...svc,
            id: svc.service_id || svc.id,
            vertical: svc.vertical || payload.vertical,
            modalidad: svc.modalidad || payload.modalidad,
          },
          telefonoFallback: svc.telefono_proveedor || null,
        });
        return { ...svc, ...contact };
      }),
    );
    payload.mostrar_contacto_proveedor = true;
    payload.booking_estado = payload.booking_estado || "confirmada";
  } else {
    const contact = await buildProviderContactEmailFields({
      estado: payload.booking_estado || "confirmada",
      serviceId: payload.service_id,
      service: {
        id: payload.service_id,
        vertical: payload.vertical,
        modalidad: payload.modalidad,
        direccion_exacta: payload.direccion_exacta,
        telefono_contacto: null,
      },
      telefonoFallback: payload.telefono_proveedor || null,
    });
    Object.assign(payload, contact);
  }

  const required = [
    "cliente_email",
    "cliente_nombre",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
    if (!payload[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const soloCliente = payload.solo_cliente === true;
  const isBundle = Array.isArray(payload.servicios) && payload.servicios.length > 0;

  if (isBundle) {
    const clienteResult = await resend.emails.send({
      from: FROM,
      to: payload.cliente_email,
      subject: "¡Reserva confirmada! — Home&Heart",
      html: clienteEmailHtml(payload),
    });

    if (clienteResult.error) {
      return { error: clienteResult.error.message };
    }

    if (soloCliente) {
      return { success: true };
    }

    const providerEmails = await Promise.all(
      payload.servicios.map(async (svc) => {
        let proveedorEmail = svc.proveedor_email;
        if (svc.proveedor_id) {
          proveedorEmail = await resolverEmailUsuario(svc.proveedor_id);
        }
        if (!proveedorEmail) {
          return { error: { message: "No se encontró el email del proveedor" } };
        }

        let proveedorNombre = svc.proveedor_nombre;
        if (!proveedorNombre && svc.proveedor_id) {
          proveedorNombre =
            (await resolverNombreUsuario(svc.proveedor_id)) || "Proveedor";
        }

        return resend.emails.send({
          from: FROM,
          to: proveedorEmail,
          subject: "Nueva reserva recibida — Home&Heart",
          html: proveedorEmailHtml({
            ...payload,
            servicio_titulo: svc.titulo,
            proveedor_nombre: proveedorNombre,
            precio_total: svc.precio,
            precio_base: svc.precio_base,
            cliente_sin_comision: svc.cliente_sin_comision,
            proveedor_sin_comision: svc.proveedor_sin_comision,
            sinComisionProveedor: svc.sinComisionProveedor,
            direccion_exacta: svc.direccion_exacta,
            telefono_proveedor: svc.telefono_proveedor,
            modalidad: svc.modalidad,
          }),
        });
      }),
    );

    const providerError = providerEmails.find((r) => r.error);
    if (providerError?.error) {
      return { error: providerError.error.message };
    }

    return { success: true };
  }

  if (soloCliente) {
    const clienteResult = await resend.emails.send({
      from: FROM,
      to: payload.cliente_email,
      subject: "¡Reserva confirmada! — Home&Heart",
      html: clienteEmailHtml(payload),
    });

    if (clienteResult.error) {
      return { error: clienteResult.error.message };
    }

    return { success: true };
  }

  const legacyRequired = ["proveedor_email", "proveedor_nombre", "servicio_titulo"];
  for (const field of legacyRequired) {
    if (!payload[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const [clienteResult, proveedorResult] = await Promise.all([
    resend.emails.send({
      from: FROM,
      to: payload.cliente_email,
      subject: "¡Reserva confirmada! — Home&Heart",
      html: clienteEmailHtml(payload),
    }),
    resend.emails.send({
      from: FROM,
      to: payload.proveedor_email,
      subject: "Nueva reserva recibida — Home&Heart",
      html: proveedorEmailHtml(payload),
    }),
  ]);

  if (clienteResult.error) {
    return { error: clienteResult.error.message };
  }

  if (proveedorResult.error) {
    return { error: proveedorResult.error.message };
  }

  return { success: true };
}

async function sendReservaSolicitudEmail(data) {
  const payload = { ...data };

  if (payload.cliente_id && !payload.cliente_email) {
    payload.cliente_email = await resolverEmailUsuario(payload.cliente_id);
  }

  if (!payload.cliente_nombre && payload.cliente_id) {
    payload.cliente_nombre =
      (await resolverNombreUsuario(payload.cliente_id)) || "Cliente";
  }

  const required = [
    "cliente_email",
    "cliente_nombre",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
    if (!payload[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const isBundle = Array.isArray(payload.servicios) && payload.servicios.length > 0;

  if (!isBundle) {
    const legacyRequired = ["proveedor_nombre", "servicio_titulo"];
    for (const field of legacyRequired) {
      if (!payload[field]) {
        return { error: `Falta el campo requerido: ${field}` };
      }
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: payload.cliente_email,
    subject: "Hemos recibido tu solicitud — Home&Heart",
    html: reservaSolicitudEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

const AMBER = "#c47d1a";

function solicitudDocumentosEmailHtml(data) {
  const documentos = Array.isArray(data.documentos) ? data.documentos : [];
  const listaHtml = documentos
    .map(
      (doc) =>
        `<li style="margin:6px 0;font-size:14px;color:#222;line-height:1.5;">${doc}</li>`,
    )
    .join("");

  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Mensaje del equipo:</strong> ${data.mensaje}</p>`
    : "";

  const perfilUrl = data.perfil_url || "https://homeandheart.es/ser-proveedor";

  return emailLayout({
    title: "Home&Heart — Necesitamos documentación adicional",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Necesitamos documentación adicional</h1>
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Hola <strong>${data.proveedor_nombre || "proveedor"}</strong>,
      </p>
      <p style="margin:12px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Para completar la revisión de tu perfil en Home&amp;Heart, necesitamos que nos envíes la siguiente documentación:
      </p>
      <ul style="margin:16px 0 0;padding-left:20px;background-color:#fdf3e3;border-radius:8px;padding:16px 20px 16px 36px;">
        ${listaHtml}
      </ul>
      ${mensajeBlock}
      <p style="margin:24px 0 0;text-align:center;">
        <a href="${perfilUrl}" style="display:inline-block;background-color:${AMBER};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
          Actualizar mi perfil
        </a>
      </p>`,
  });
}

async function sendSolicitudDocumentosEmail(data) {
  const destinatarioId =
    data.destinatario_id || data.proveedor_id || data.user_id;
  let destinatario = data.destinatario || data.destinatario_email;

  if (destinatarioId) {
    destinatario = await resolverEmailUsuario(destinatarioId);
  }

  if (!destinatario) {
    return { error: "No se encontró el email del destinatario" };
  }

  if (!data.documentos || data.documentos.length === 0) {
    return { error: "Falta el campo requerido: documentos" };
  }

  let proveedorNombre = data.proveedor_nombre;
  if (!proveedorNombre && destinatarioId) {
    proveedorNombre =
      (await resolverNombreUsuario(destinatarioId)) || "proveedor";
  }

  const payload = {
    ...data,
    destinatario,
    proveedor_nombre: proveedorNombre || data.proveedor_nombre,
  };

  const result = await resend.emails.send({
    from: FROM,
    to: destinatario,
    subject: data.asunto || "Home&Heart — Necesitamos documentación adicional",
    html: solicitudDocumentosEmailHtml(payload),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

function mensajePreview(text, max = 100) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}…`;
}

function mensajeNuevoEmailHtml(data) {
  const chatUrl = data.chat_url || "https://homeandheart.es/chat";
  const preview = mensajePreview(data.mensaje_preview || data.mensaje || "");

  return emailLayout({
    title: "Tienes un mensaje nuevo en Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Tienes un mensaje nuevo</h1>
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        <strong>${data.remitente_nombre || "Alguien"}</strong> te ha enviado un mensaje en Home&amp;Heart:
      </p>
      <div style="margin:16px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
        <p style="margin:0;font-size:14px;color:#222;line-height:1.6;font-style:italic;">"${preview}"</p>
      </div>
      <p style="margin:24px 0 0;text-align:center;">
        <a href="${chatUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
          Ver mensaje
        </a>
      </p>`,
  });
}

function servicioCompletadoEmailHtml(data) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
  const confirmUrl = `${baseUrl}/confirmar-servicio/${data.booking_id}`;
  const tokenParam = data.confirm_token
    ? `&token=${encodeURIComponent(data.confirm_token)}`
    : "";

  return emailLayout({
    title: "¿Cómo fue tu experiencia? — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">¿Cómo fue tu experiencia?</h1>
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;text-align:center;">
        Hola <strong>${data.cliente_nombre || "Cliente"}</strong>, tu servicio en Home&amp;Heart ha finalizado. Cuéntanos cómo fue.
      </p>
      <p style="margin:28px 0 0;text-align:center;">
        <a href="${confirmUrl}?resultado=ok${tokenParam}" style="display:inline-block;width:100%;max-width:280px;background-color:#16a34a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:8px;box-sizing:border-box;">
          ✅ Todo fue bien
        </a>
      </p>
      <p style="margin:16px 0 0;text-align:center;">
        <a href="${confirmUrl}?resultado=problema${tokenParam}" style="display:inline-block;width:100%;max-width:280px;background-color:${AMBER};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:8px;box-sizing:border-box;">
          ⚠️ Hubo un problema
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5;text-align:center;">
        Si confirmas que todo fue bien, liberamos el pago al proveedor. Si no respondes, en unos días se completará y liberará automáticamente.
      </p>`,
  });
}

async function sendServicioCompletadoEmail(data) {
  if (!data.cliente_id) {
    return { error: "Falta el campo requerido: cliente_id" };
  }

  if (!data.booking_id) {
    return { error: "Falta el campo requerido: booking_id" };
  }

  const clienteEmail = await resolverEmailUsuario(data.cliente_id);
  if (!clienteEmail) {
    return { error: "No se encontró el email del cliente" };
  }

  let clienteNombre = data.cliente_nombre;
  if (!clienteNombre) {
    clienteNombre =
      (await resolverNombreUsuario(data.cliente_id)) || "Cliente";
  }

  let paymentIntentId = data.payment_intent_id || null;
  if (!paymentIntentId) {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const { data: bookingRow } = await supabaseAdmin
      .from("bookings")
      .select("payment_intent_id")
      .eq("id", data.booking_id)
      .maybeSingle();
    paymentIntentId = bookingRow?.payment_intent_id || "";
  }

  const confirmToken = firmarTokenConfirmacion(
    data.booking_id,
    paymentIntentId || "",
  );
  if (!confirmToken) {
    return { error: "No se pudo generar el token de confirmación" };
  }

  const result = await resend.emails.send({
    from: FROM,
    to: clienteEmail,
    subject: "¿Cómo fue tu experiencia? — Home&Heart",
    html: servicioCompletadoEmailHtml({
      cliente_nombre: clienteNombre || "Cliente",
      booking_id: data.booking_id,
      confirm_token: confirmToken,
    }),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true, booking_id: data.booking_id };
}

async function sendMensajeNuevoEmail(data) {
  let destinatarioEmail = data.destinatario_email || data.destinatario;

  if (data.destinatario_id) {
    destinatarioEmail = await resolverEmailUsuario(data.destinatario_id);
  }

  if (!destinatarioEmail) {
    return { error: "No se encontró el email del destinatario" };
  }

  if (!data.remitente_nombre) {
    return { error: "Falta el campo requerido: remitente_nombre" };
  }

  const result = await resend.emails.send({
    from: FROM,
    to: destinatarioEmail,
    subject: "Tienes un mensaje nuevo en Home&Heart",
    html: mensajeNuevoEmailHtml(data),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

/**
 * Despacha el envío de un email de plataforma por `tipo`.
 * Server-only: importar solo desde rutas/libs de servidor (nunca desde "use client").
 *
 * @param {{ tipo: string } & Record<string, unknown>} payload
 * @returns {Promise<{ ok: boolean, status: number, error?: string, data?: object }>}
 */
export async function dispatchPlatformEmail(payload = {}) {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.error("[dispatchPlatformEmail] RESEND_API_KEY no está configurada");
      return {
        ok: false,
        status: 500,
        error: "RESEND_API_KEY no está configurada",
      };
    }

    const { tipo, ...data } = payload ?? {};
    if (!tipo || typeof tipo !== "string") {
      return { ok: false, status: 400, error: "Falta tipo de email" };
    }

    if (tipo === "reserva_confirmada") {
      const result = await sendReservaConfirmadaEmails(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "reserva_confirmada_proveedor") {
      const result = await sendReservaConfirmadaProveedorEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "reserva_solicitud") {
      const result = await sendReservaSolicitudEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "reserva_rechazada") {
      const result = await sendReservaRechazadaEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "reserva_nueva") {
      const result = await sendReservaNuevaEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "solicitud_documentos") {
      const result = await sendSolicitudDocumentosEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "mensaje_nuevo") {
      const result = await sendMensajeNuevoEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "servicio_completado") {
      const result = await sendServicioCompletadoEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "solicitud_referencia") {
      const avalUrl = data.aval_url || "#";
      const proveedorNombre = data.proveedor_nombre ?? "Un proveedor";
      const fotoHtml = data.proveedor_foto
        ? `<img src="${data.proveedor_foto}" alt="" width="72" height="72" style="border-radius:50%;object-fit:cover;display:block;margin:0 auto 16px;" />`
        : "";

      const result = await resend.emails.send({
        from: FROM,
        to: data.destinatario_email,
        subject: `${proveedorNombre} te ha pedido que avales su perfil en Home&Heart`,
        html: emailLayout({
          title: "Solicitud de aval",
          bodyHtml: `
            <div style="text-align:center;margin-bottom:20px;">
              ${fotoHtml}
              <p style="margin:0;font-size:18px;font-weight:600;color:${BRAND_PRIMARY};">${proveedorNombre}</p>
            </div>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              Hola ${data.referente_nombre ?? ""}, <strong>${proveedorNombre}</strong> te ha pedido que avales su perfil en Home&amp;Heart.
              Los avales de personas que conocen al proveedor ayudan a las familias a confiar antes de reservar.
            </p>
            <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#444;">En el formulario podrás indicar:</p>
            <ul style="margin:0 0 20px;padding-left:20px;font-size:14px;line-height:1.8;color:#666;">
              <li>¿Cuánto tiempo conoces a ${proveedorNombre.split(" ")[0]}?</li>
              <li>¿Recomendarías sus servicios?</li>
              <li>Un comentario libre sobre tu experiencia</li>
            </ul>
            <p style="margin:0;text-align:center;">
              <a href="${avalUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                Enviar mi aval
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "reserva_cancelada_cliente") {
      const result = await sendReservaCanceladaClienteEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "incidencia_reembolso_cliente") {
      const result = await sendIncidenciaReembolsoClienteEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "incidencia_liberado_proveedor") {
      const result = await sendIncidenciaLiberadoProveedorEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "incidencia_resuelta_cliente") {
      const result = await sendIncidenciaResueltaClienteEmail(data);

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "cancelacion_garantia") {
      const alternativas = Array.isArray(data.alternativas)
        ? data.alternativas.slice(0, 3)
        : [];
      const tieneAlternativas = alternativas.length > 0;
      const precioOriginal =
        data.precio_original != null
          ? `${Number(data.precio_original).toFixed(2)} €`
          : "tu reserva original";
      const clienteNombre = data.cliente_nombre ?? "Cliente";

      const cardsHtml = alternativas
        .map(
          (alt) => `
          <div style="margin:16px 0;padding:16px;border:1px solid #e8e4de;border-radius:12px;background:#f7f5f2;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                ${
                  alt.foto_url
                    ? `<td width="72" valign="top" style="padding-right:12px;">
                    <img src="${alt.foto_url}" alt="" width="64" height="64" style="border-radius:8px;object-fit:cover;display:block;" />
                  </td>`
                    : ""
                }
                <td valign="top">
                  <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#1a1a1a;">${alt.proveedor_nombre ?? "Proveedor"}</p>
                  <p style="margin:0 0 4px;font-size:13px;color:#666;">${alt.titulo ?? "Servicio"}</p>
                  <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:${BRAND_PRIMARY};">${Number(alt.precio || 0).toFixed(2)} € · ${alt.valoracion ?? "—"} ★</p>
                  <a href="${alt.reservar_url || "#"}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;font-weight:600;">
                    Reservar ahora
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:10px 0 0;font-size:11px;color:#888;">* El precio puede variar según la disponibilidad del proveedor</p>
          </div>
        `,
        )
        .join("");

      const introHtml = tieneAlternativas
        ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              Hola ${clienteNombre}, tu proveedor ha cancelado esta reserva. Hemos activado la <strong>Garantía Home&Heart</strong> para ayudarte y te proponemos estas alternativas:
            </p>`
        : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              Hola ${clienteNombre}, tu proveedor ha cancelado esta reserva. Lo sentimos mucho. Hemos activado la <strong>Garantía Home&Heart</strong>: no hemos encontrado alternativas disponibles para tus fechas en este momento.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              El importe que abonaste con tarjeta se devolverá a tu método de pago (suele reflejarse en el extracto en unos días). Además, hemos añadido un <strong>crédito de indemnización</strong> a tu cuenta Home&amp;Heart para que puedas usarlo en tu próxima reserva.
            </p>`;

      const footerHtml = tieneAlternativas
        ? `<p style="margin:20px 0 0;font-size:13px;color:#888;font-style:italic;">
              Tu reserva original costaba ${precioOriginal}. Te ofrecemos estas alternativas; si alguna tiene un precio distinto, se ajustará al reservar.
            </p>`
        : `<p style="margin:20px 0 0;font-size:13px;color:#888;font-style:italic;">
              Tu reserva original era de ${precioOriginal}. Si necesitas ayuda para encontrar otro proveedor, puedes responder a este correo.
            </p>`;

      const result = await resend.emails.send({
        from: FROM,
        to: data.cliente_email,
        subject: "🛡️ Tu reserva fue cancelada — Activando Garantía Home&Heart",
        html: emailLayout({
          title: "Garantía Home&Heart",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">🛡️ Tu reserva fue cancelada</h1>
            ${introHtml}
            ${tieneAlternativas ? cardsHtml : ""}
            ${footerHtml}
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "invitacion_familia_registro") {
      const accionUrl = data.accion_url || "#";
      const result = await resend.emails.send({
        from: FROM,
        to: data.destinatario_email,
        subject: `Te han invitado a ${data.familia_nombre ?? "un grupo familiar"} — Home&Heart`,
        html: emailLayout({
          title: "Invitación a grupo familiar",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Te han invitado a unirte 💛</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              <strong>${data.invitador_nombre ?? "Un miembro"}</strong> te ha invitado a unirte al grupo familiar
              <strong>${data.familia_nombre ?? "Home&Heart"}</strong> en Home&amp;Heart.
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#666;">
              Crea tu cuenta gratis para ver las reservas del grupo y hacer reservas bajo el mismo grupo familiar.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${accionUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                Regístrate para unirte
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "invitacion_familia_login") {
      const accionUrl = data.accion_url || "#";
      const result = await resend.emails.send({
        from: FROM,
        to: data.destinatario_email,
        subject: `Invitación a ${data.familia_nombre ?? "un grupo familiar"} — Home&Heart`,
        html: emailLayout({
          title: "Invitación a grupo familiar",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Tienes una invitación 💛</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              <strong>${data.invitador_nombre ?? "Un miembro"}</strong> te ha invitado a unirte al grupo familiar
              <strong>${data.familia_nombre ?? "Home&Heart"}</strong> en Home&amp;Heart.
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#666;">
              Inicia sesión para ver la invitación y decidir si quieres unirte al grupo.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${accionUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                Inicia sesión para unirte
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "invitacion_familia") {
      const aceptarUrl = data.aceptar_url || "#";
      const result = await resend.emails.send({
        from: FROM,
        to: data.destinatario_email,
        subject: "Invitación a grupo familiar — Home&Heart",
        html: emailLayout({
          title: "Invitación a grupo familiar",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Invitación a grupo familiar</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              <strong>${data.invitador_nombre ?? "Un miembro"}</strong> te ha invitado a unirte al grupo familiar
              <strong>${data.familia_nombre ?? "Home&Heart"}</strong> en Home&amp;Heart.
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#666;">
              Podrás ver las reservas del grupo y hacer reservas bajo el mismo grupo familiar.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${aceptarUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;">
                Aceptar invitación
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "nuevo_proveedor") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const adminUrl = `${baseUrl}/admin`;
      const verticalLabels = {
        alojamiento: "Alojamiento",
        ninos: "Niñera",
        mascotas: "Mascotas",
      };
      const verticales = Array.isArray(data.verticales) ? data.verticales : [];
      const verticalesHtml =
        verticales.map((v) => verticalLabels[v] || v).join(", ") || "—";

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: "Nuevo proveedor pendiente de revisión",
        html: emailLayout({
          title: "Nuevo proveedor pendiente de revisión",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Nuevo proveedor pendiente de revisión</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Nombre:</strong> ${data.nombre ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Email:</strong> ${data.email ?? "—"}</p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;"><strong>Servicios:</strong> ${verticalesHtml}</p>
            <p style="margin:0;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ver en admin →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "admin_dni_pendiente") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const adminUrl = `${baseUrl}/admin?tab=usuarios`;
      const nombre = (data.nombre || "Usuario").replace(/</g, "&lt;");

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `Nuevo DNI pendiente de revisar — ${data.nombre || "Usuario"}`,
        html: emailLayout({
          title: "DNI pendiente de revisar",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">DNI pendiente de revisar</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              <strong>${nombre}</strong> ha subido su documento de identidad y está pendiente de revisión.
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
              La verificación es obligatoria para reservar: conviene revisarlo con agilidad.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Revisar en Usuarios →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "admin_servicio_pendiente") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const adminUrl = `${baseUrl}/admin?tab=servicios-revision`;
      const nombre = (data.nombre || "Proveedor").replace(/</g, "&lt;");
      const titulo = (data.titulo || "Servicio").replace(/</g, "&lt;");

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `Servicio pendiente de revisar — ${data.titulo || "Servicio"}`,
        html: emailLayout({
          title: "Servicio pendiente de revisar",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Servicio pendiente de revisar</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              <strong>${nombre}</strong> ha enviado el servicio <strong>«${titulo}»</strong> a revisión.
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
              Incluye servicios de proveedores ya verificados: conviene revisarlos uno a uno.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Revisar servicios →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "admin_servicios_creacion_masiva") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const adminUrl = `${baseUrl}/admin?tab=servicios-revision`;
      const nombre = (data.nombre || "Proveedor").replace(/</g, "&lt;");
      const count = Number(data.count_24h) || 0;
      const total = Number(data.total_services) || 0;
      const proveedorId = data.proveedor_id || "";

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `Creación masiva de anuncios — ${data.nombre || "Proveedor"}`,
        html: emailLayout({
          title: "Creación masiva de anuncios",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Alerta: muchos anuncios en poco tiempo</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              <strong>${nombre}</strong> ha creado <strong>${count}</strong> servicios en las últimas 24 horas
              (total actual: ${total}).
            </p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;color:#444;">
              Proveedor ID: ${String(proveedorId).replace(/</g, "&lt;") || "—"}
            </p>
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
              Solo es un aviso: no se ha bloqueado nada. Revisa si es uso legítimo o spam.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ver en admin →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "servicio_publicado") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const titulo = (data.titulo || "Tu servicio").replace(/</g, "&lt;");
      const anuncioUrl = data.service_id
        ? `${baseUrl}/anuncio/${data.service_id}`
        : `${baseUrl}/editar-perfil`;
      const pendienteCobros = data.pendiente_cobros === true;

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: pendienteCobros
          ? "¡Tu anuncio está aprobado! · Home&Heart"
          : "¡Tu anuncio ya está activo! · Home&Heart",
        html: emailLayout({
          title: pendienteCobros
            ? "Tu anuncio está aprobado"
            : "Tu anuncio ya está activo",
          bodyHtml: pendienteCobros
            ? `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">¡Tu anuncio está aprobado!</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, hemos aprobado <strong>«${titulo}»</strong>.
              Solo te falta configurar tus cobros para empezar a recibir reservas.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/dashboard?tab=proveedor" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Configurar cobros →
              </a>
            </p>
          `
            : `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">¡Tu anuncio ya está activo!</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, <strong>«${titulo}»</strong> ya está activo.
              Ya puedes recibir reservas.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${anuncioUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ver mi anuncio →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "anuncios_activos_cobros") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const count = Number(data.count) || 1;

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "¡Tu anuncio ya está activo! · Home&Heart",
        html: emailLayout({
          title: "Tu anuncio ya está activo",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">¡Tu anuncio ya está activo!</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, tus cobros ya están configurados
              ${
                count > 1
                  ? `y tus ${count} anuncios elegibles ya están activos.`
                  : "y tu anuncio ya está activo."
              }
              Ya puedes recibir reservas.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil?tab=servicios" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ver mis servicios →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "ninos_documentacion_aprobada") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Documentación de niñera aprobada · Home&Heart",
        html: emailLayout({
          title: "Documentación de niñera aprobada",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Documentación aprobada</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, tu documentación de niñera ha sido revisada y aprobada por el equipo.
              Ya puedes activar tus servicios de cuidado de niños desde tu perfil.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ir a mi perfil →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "dni_verificado" || tipo === "dni_rechazado") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const ok = tipo === "dni_verificado";
      const motivo = (data.motivo || "").replace(/</g, "&lt;").trim();

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: ok
          ? "Tu identidad ha sido verificada · Home&Heart"
          : "Necesitamos que vuelvas a subir tu documento · Home&Heart",
        html: emailLayout({
          title: ok ? "Identidad verificada" : "Documento no verificado",
          bodyHtml: ok
            ? `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Tu identidad ha sido verificada</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, hemos verificado tu documento de identidad
              y tu mayoría de edad. Ya puedes continuar con los siguientes pasos de tu cuenta
              (cobros, contacto y publicación de servicios).
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/dashboard?tab=proveedor" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ir a mi panel →
              </a>
            </p>
          `
            : `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Necesitamos que vuelvas a subir tu documento</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, no hemos podido verificar tu documento de identidad.
              Súbelo de nuevo (DNI, NIE o pasaporte legible) para que el equipo pueda revisarlo.
            </p>
            ${
              motivo
                ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;"><strong>Motivo:</strong> ${motivo}</p>`
                : ""
            }
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/subir-dni" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Subir documento →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "nru_verificado" || tipo === "nru_rechazado") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const titulo = (data.titulo || "Tu alojamiento").replace(/</g, "&lt;");
      const ok = tipo === "nru_verificado";

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: ok
          ? "NRU verificado · Home&Heart"
          : "NRU rechazado · Home&Heart",
        html: emailLayout({
          title: ok ? "NRU verificado" : "NRU rechazado",
          bodyHtml: ok
            ? `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">NRU verificado</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, el número de registro turístico (NRU) de
              <strong>${titulo}</strong> ha sido verificado por el equipo.
              Si el resto de requisitos están listos, ya puedes activar el anuncio.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ir a mi perfil →
              </a>
            </p>
          `
            : `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">NRU rechazado</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, el NRU declarado en
              <strong>${titulo}</strong> no ha podido verificarse.
              Corrige el número en tu perfil y lo revisaremos de nuevo.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Corregir NRU →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "mascotas_documentacion_aprobada") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Documentación de mascotas aprobada · Home&Heart",
        html: emailLayout({
          title: "Documentación de mascotas aprobada",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Documentación aprobada</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, tu documentación de mascotas (identidad y antecedentes penales) ha sido revisada y aprobada por el equipo.
              Ya puedes activar tus servicios de cuidado de mascotas desde tu perfil.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ir a mi perfil →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "servicio_rechazado") {
      const userId = data.user_id || data.proveedor_id;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const titulo = (data.titulo || "Tu servicio").replace(/</g, "&lt;");
      const motivo = (data.motivo || "").replace(/</g, "&lt;").trim();

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu servicio necesita cambios · Home&Heart",
        html: emailLayout({
          title: "Tu servicio necesita cambios",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Tu servicio necesita cambios</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, hemos revisado <strong>«${titulo}»</strong>
              y aún no puede publicarse.
            </p>
            ${
              motivo
                ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;"><strong>Motivo:</strong> ${motivo}</p>`
                : ""
            }
            <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#444;">
              Edita el servicio y guárdalo de nuevo para enviarlo otra vez a revisión.
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${baseUrl}/editar-perfil" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Editar mi servicio →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "pago_liberado_proveedor") {
      const userId = data.user_id || data.proveedor_id;
      const bookingId = data.booking_id || null;
      const email =
        data.email || (userId ? await resolverEmailUsuario(userId) : null);
      if (!email) {
        return {
          ok: false,
          status: 400,
          error: "No se encontró el email del destinatario",
        };
      }

      if (userId && bookingId) {
        const supabaseAdmin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
        );
        const { data: existingLog } = await supabaseAdmin
          .from("email_logs")
          .select("id")
          .eq("user_id", userId)
          .eq("tipo", "pago_liberado_proveedor")
          .eq("booking_id", bookingId)
          .maybeSingle();
        if (existingLog) {
          return {
            ok: true,
            status: 200,
            data: { success: true, already_sent: true },
          };
        }
      }

      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const nombre = (data.nombre || "proveedor").replace(/</g, "&lt;");
      const titulo = (data.titulo || "tu servicio").replace(/</g, "&lt;");
      const importe = String(data.importe || "—").replace(/</g, "&lt;");
      const dashboardUrl = `${baseUrl}/dashboard?tab=proveedor`;

      const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Has recibido un pago de ${data.importe || "—"} · Home&Heart`,
        html: emailLayout({
          title: "Has recibido un pago",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Has recibido un pago</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Hola <strong>${nombre}</strong>, tu pago de <strong>${importe}</strong> por
              <strong>«${titulo}»</strong> está en camino a tu cuenta.
            </p>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              El importe ya está liberado en Home&Heart y se transfiere a tu cuenta de Stripe Connect.
              Desde ahí, Stripe lo enviará a tu cuenta bancaria según su calendario de payouts
              (no es un ingreso inmediato en tu banco).
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${dashboardUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:15px;font-weight:600;">
                Ver mi panel →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      if (userId) {
        await logMarketingEmail(userId, "pago_liberado_proveedor", bookingId);
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "admin_stripe_descuadre") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const esc = (v) =>
        String(v ?? "—")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const bookingIds = Array.isArray(data.booking_ids)
        ? data.booking_ids.filter(Boolean)
        : [];
      const firstBookingId = bookingIds[0] || null;
      const reservaUrl = firstBookingId
        ? `${baseUrl}/reserva/${firstBookingId}`
        : `${baseUrl}/admin`;
      const pi = data.payment_intent_id || null;
      const charge = data.charge_id || null;
      const stripeUrl = pi
        ? `https://dashboard.stripe.com/payments/${encodeURIComponent(pi)}`
        : charge
          ? `https://dashboard.stripe.com/payments/${encodeURIComponent(charge)}`
          : "https://dashboard.stripe.com";
      const details = data.details && typeof data.details === "object"
        ? data.details
        : {};
      const detailRows = Object.entries(details)
        .map(
          ([k, v]) =>
            `<p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:#444;"><strong>${esc(k)}:</strong> ${esc(typeof v === "object" ? JSON.stringify(v) : v)}</p>`,
        )
        .join("");

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `⚠️ Descuadre Stripe — ${data.kind || "anomalia"}`,
        html: emailLayout({
          title: "Descuadre Stripe detectado",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:#b45309;">Descuadre / anomalía Stripe</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              ${esc(data.summary)}
            </p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Tipo:</strong> ${esc(data.kind)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Evento Stripe:</strong> ${esc(data.event_type)} (${esc(data.event_id)})</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>PaymentIntent:</strong> ${esc(pi)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Charge:</strong> ${esc(charge)}</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;"><strong>Reservas:</strong> ${esc(bookingIds.join(", ") || "—")}</p>
            ${detailRows ? `<div style="margin:0 0 20px;padding:12px;background:#fff7ed;border-radius:8px;">${detailRows}</div>` : ""}
            <p style="margin:0 0 12px;text-align:center;">
              <a href="${stripeUrl}" style="display:inline-block;background-color:#635bff;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                Abrir en Stripe →
              </a>
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${reservaUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                Ver reserva / admin →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "admin_suspension_cautelar") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const baseUrl = process.env.NEXT_PUBLIC_URL || "https://homeandheart.es";
      const esc = (v) =>
        String(v ?? "—")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
      const proveedorId = data.proveedor_id || "";
      const adminUrl = `${baseUrl}/admin?tab=reportes`;
      const proveedorUrl = proveedorId
        ? `${baseUrl}/proveedor/${proveedorId}`
        : adminUrl;

      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `🚨 URGENTE — Suspensión cautelar: ${esc(data.proveedor_nombre || "proveedor")}`,
        html: emailLayout({
          title: "Suspensión cautelar automática",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:#b91c1c;">Suspensión cautelar automática</h1>
            <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#444;">
              Un reporte <strong>grave</strong> ha pausado automáticamente los servicios del proveedor.
              Las reservas confirmadas/en curso <strong>no se han cancelado</strong>; están marcadas para revisión.
            </p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Proveedor:</strong> ${esc(data.proveedor_nombre)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>ID:</strong> ${esc(proveedorId)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Motivo:</strong> ${esc(data.motivo)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Reporte:</strong> ${esc(data.report_id)}</p>
            <p style="margin:0 0 6px;font-size:14px;line-height:1.6;"><strong>Servicios pausados:</strong> ${esc(data.servicios_pausados)}</p>
            <p style="margin:0 0 20px;font-size:14px;line-height:1.6;"><strong>Reservas a revisar:</strong> ${esc(data.reservas_marcadas)}</p>
            <p style="margin:0 0 12px;text-align:center;">
              <a href="${adminUrl}" style="display:inline-block;background-color:#b91c1c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                Abrir panel admin →
              </a>
            </p>
            <p style="margin:0;text-align:center;">
              <a href="${proveedorUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:600;">
                Ver perfil público →
              </a>
            </p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "incidencia") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: "Incidencia en reserva — Home&Heart",
        html: emailLayout({
          title: "Incidencia en reserva",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Nueva incidencia reportada</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Reserva:</strong> ${data.booking_id ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Cliente:</strong> ${data.cliente_nombre ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Fechas:</strong> ${data.fecha_inicio ?? "—"}${data.fecha_fin ? ` — ${data.fecha_fin}` : ""}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;"><strong>Descripción:</strong></p>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#444;">${(data.descripcion ?? "").replace(/</g, "&lt;")}</p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "incidencia_reserva") {
      const adminEmail = process.env.ADMIN_EMAIL || FROM;
      const rolLabel =
        data.reporter_rol === "proveedor" ? "Proveedor" : "Cliente";
      const result = await resend.emails.send({
        from: FROM,
        to: adminEmail,
        subject: `Incidencia de reserva (${rolLabel}) — Home&Heart`,
        html: emailLayout({
          title: "Incidencia de reserva",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Nueva incidencia en reserva</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Reserva:</strong> ${data.booking_id ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Reportado por:</strong> ${rolLabel} — ${data.reporter_nombre ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Servicio:</strong> ${data.servicio_titulo ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Proveedor:</strong> ${data.proveedor_nombre ?? "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Fechas:</strong> ${data.fecha_inicio ?? "—"}${data.fecha_fin && data.fecha_fin !== data.fecha_inicio ? ` — ${data.fecha_fin}` : ""}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;"><strong>Motivo:</strong> ${(data.motivo ?? "—").replace(/</g, "&lt;")}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;"><strong>Descripción:</strong></p>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#444;">${(data.descripcion ?? "—").replace(/</g, "&lt;")}</p>
            <p style="margin:20px 0 0;font-size:13px;color:#888;">Gestiona este reporte en el panel de administración → pestaña Reportes.</p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (tipo === "soporte_contacto") {
      // Email dirigido a soporte@ — no es secuencia al usuario.
      const soporteTo = "soporte@homeandheart.es";
      const nombre = (data.nombre || "Usuario").replace(/</g, "&lt;");
      const rol = (data.rol || "usuario").replace(/</g, "&lt;");
      const emailUser = (data.email || "").replace(/</g, "&lt;");
      const userId = (data.user_id || "").replace(/</g, "&lt;");
      const asunto = (data.asunto || "Consulta").replace(/</g, "&lt;");
      const mensaje = (data.mensaje || "").replace(/</g, "&lt;");
      const pageUrl = (data.page_url || "").replace(/</g, "&lt;");
      const replyTo =
        typeof data.reply_to === "string" && data.reply_to.includes("@")
          ? data.reply_to
          : data.email && String(data.email).includes("@")
            ? data.email
            : undefined;

      const result = await resend.emails.send({
        from: FROM,
        to: soporteTo,
        ...(replyTo ? { replyTo } : {}),
        subject: `[Ayuda] ${asunto} · ${rol}`,
        html: emailLayout({
          title: "Consulta de soporte",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">Nueva consulta de ayuda</h1>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Asunto:</strong> ${asunto}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Nombre:</strong> ${nombre}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Rol:</strong> ${rol}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>Email:</strong> ${emailUser || "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>User ID:</strong> ${userId || "—"}</p>
            <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>URL:</strong> ${pageUrl || "—"}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;"><strong>Mensaje:</strong></p>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#444;white-space:pre-wrap;">${mensaje}</p>
          `,
        }),
      });

      if (result.error) {
        return { ok: false, status: 400, error: result.error.message };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    if (MARKETING_HTML_BUILDERS[tipo]) {
      const result = await sendMarketingSequenceEmail({ tipo, ...data });

      if (result.error) {
        return { ok: false, status: 400, error: result.error };
      }

      return { ok: true, status: 200, data: { success: true } };
    }

    return {
      ok: false,
      status: 400,
      error: `Tipo de email no soportado: ${tipo}`,
    };
  } catch (err) {
    console.error("[dispatchPlatformEmail] Error no controlado:", err?.message || err);
    return {
      ok: false,
      status: 500,
      error: err?.message || "Error al enviar los emails",
    };
  }
}
