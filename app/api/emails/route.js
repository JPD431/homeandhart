import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "soporte@homeandheart.es";
const BRAND_PRIMARY = "#1d4f91";
const BRAND_LIGHT = "#e8f0fb";

function emailLayout({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f7f5f2;font-family:Georgia,'Times New Roman',Times,serif;color:#222;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f7f5f2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid #e8e4de;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 8px;text-align:center;">
              <p style="margin:0;font-size:22px;font-weight:600;letter-spacing:-0.02em;">
                <span style="color:#111111;">Home</span><span style="color:${BRAND_PRIMARY};font-style:italic;">&amp;</span><span style="color:#111111;">Heart</span>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              ${bodyHtml}
              <p style="margin:28px 0 0;font-size:13px;color:#666;line-height:1.5;">
                El equipo de Home&amp;Heart · Donde estés, estamos.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatModalidad(modalidad) {
  const labels = {
    domicilio_cliente: "En domicilio del cliente — yo me desplazo",
    domicilio_proveedor: "En mi domicilio — el cliente se desplaza",
    ambas: "Ambas opciones disponibles",
  };
  return labels[modalidad] || modalidad;
}

function proveedorContactBlock(data) {
  const lines = [];

  if (data.direccion_exacta) {
    lines.push(`📍 Dirección: ${data.direccion_exacta}`);
  }
  if (data.telefono_proveedor) {
    lines.push(`📞 Teléfono: ${data.telefono_proveedor}`);
  }
  if (data.modalidad) {
    lines.push(`🏠 Modalidad: ${formatModalidad(data.modalidad)}`);
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
  return `<div style="margin:20px 0 0;background-color:#e8f0fb;border-radius:8px;padding:16px 20px;">
    <p style="margin:0;font-size:14px;font-weight:600;color:${BRAND_PRIMARY};">Datos de contacto del cliente:</p>
    <p style="margin:8px 0 0;font-size:14px;color:#222;line-height:1.6;">📞 Email: ${data.cliente_email}</p>
  </div>`;
}

function bundleDetailsBlock(data) {
  const servicios = Array.isArray(data.servicios) ? data.servicios : [];
  const rowsHtml = servicios
    .map(
      (svc) => `
        <tr>
          <td style="padding:8px 0;font-size:14px;color:#666;vertical-align:top;">${svc.titulo}</td>
          <td style="padding:8px 0;font-size:14px;color:#222;font-weight:600;text-align:right;">${svc.precio} €</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 8px;font-size:12px;color:#888;">Proveedor: ${svc.proveedor_nombre}</td>
        </tr>`,
    )
    .join("");

  const subtotal = data.subtotal ? `${data.subtotal} €` : null;
  const comision = data.comision ? `${data.comision} €` : null;
  const total = data.precio_total ? `${data.precio_total} €` : null;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;background-color:${BRAND_LIGHT};border-radius:8px;padding:16px 20px;">
    <tr>
      <td colspan="2" style="padding:0 0 8px;font-size:12px;font-weight:600;color:${BRAND_PRIMARY};text-transform:uppercase;letter-spacing:0.05em;">Servicios reservados</td>
    </tr>
    ${rowsHtml}
    ${subtotal ? `<tr><td style="padding:8px 0;font-size:14px;color:#666;">Subtotal</td><td style="padding:8px 0;font-size:14px;color:#222;text-align:right;">${subtotal}</td></tr>` : ""}
    ${comision ? `<tr><td style="padding:4px 0;font-size:12px;color:#888;">Gastos de gestión (14%)</td><td style="padding:4px 0;font-size:12px;color:#888;text-align:right;">${comision}</td></tr>` : ""}
    ${total ? `<tr><td style="padding:8px 0;font-size:16px;font-weight:600;color:${BRAND_PRIMARY};">Total</td><td style="padding:8px 0;font-size:16px;font-weight:600;color:${BRAND_PRIMARY};text-align:right;">${total}</td></tr>` : ""}
    <tr>
      <td colspan="2" style="padding:8px 0 0;font-size:12px;color:#888;">Fechas: ${data.fecha_inicio}${data.fecha_fin && data.fecha_fin !== data.fecha_inicio ? ` — ${data.fecha_fin}` : ""}</td>
    </tr>
  </table>`;
}

function detailsBlock({ servicio_titulo, fecha_inicio, fecha_fin, precio_total }) {
  const rows = [
    ["Servicio", servicio_titulo],
    ["Fecha de inicio", fecha_inicio],
    fecha_fin ? ["Fecha de fin", fecha_fin] : null,
    precio_total != null && precio_total !== ""
      ? ["Precio total", `${precio_total} €`]
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

function proveedorEmailHtml(data) {
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Mensaje del cliente:</strong> ${data.mensaje}</p>`
    : "";

  return emailLayout({
    title: "Nueva reserva recibida — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">Has recibido una nueva reserva</h1>
      ${detailsBlock(data)}
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
      ${detailsBlock(data)}
      <p style="margin:24px 0 0;text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;background-color:${BRAND_PRIMARY};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;">
          Ver reserva
        </a>
      </p>`,
  });
}

async function sendReservaNuevaEmail(data) {
  const required = [
    "proveedor_email",
    "cliente_nombre",
    "servicio_titulo",
    "fecha_inicio",
    "precio_total",
    "booking_id",
  ];

  for (const field of required) {
    if (!data[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: data.proveedor_email,
    subject: "Nueva reserva recibida — Home&Heart",
    html: reservaNuevaEmailHtml(data),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true };
}

async function sendReservaConfirmadaEmails(data) {
  const required = [
    "cliente_email",
    "cliente_nombre",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
    if (!data[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const isBundle = Array.isArray(data.servicios) && data.servicios.length > 0;

  if (isBundle) {
    const clienteResult = await resend.emails.send({
      from: FROM,
      to: data.cliente_email,
      subject: "¡Reserva confirmada! — Home&Heart",
      html: clienteEmailHtml(data),
    });

    if (clienteResult.error) {
      return { error: clienteResult.error.message };
    }

    const providerEmails = await Promise.all(
      data.servicios.map((svc) =>
        resend.emails.send({
          from: FROM,
          to: svc.proveedor_email || data.cliente_email,
          subject: "Nueva reserva recibida — Home&Heart",
          html: proveedorEmailHtml({
            ...data,
            servicio_titulo: svc.titulo,
            proveedor_nombre: svc.proveedor_nombre,
            precio_total: svc.precio,
            direccion_exacta: svc.direccion_exacta,
            telefono_proveedor: svc.telefono_proveedor,
            modalidad: svc.modalidad,
          }),
        }),
      ),
    );

    const providerError = providerEmails.find((r) => r.error);
    if (providerError?.error) {
      return { error: providerError.error.message };
    }

    return { success: true };
  }

  const legacyRequired = ["proveedor_email", "proveedor_nombre", "servicio_titulo"];
  for (const field of legacyRequired) {
    if (!data[field]) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const [clienteResult, proveedorResult] = await Promise.all([
    resend.emails.send({
      from: FROM,
      to: data.cliente_email,
      subject: "¡Reserva confirmada! — Home&Heart",
      html: clienteEmailHtml(data),
    }),
    resend.emails.send({
      from: FROM,
      to: data.proveedor_email,
      subject: "Nueva reserva recibida — Home&Heart",
      html: proveedorEmailHtml(data),
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
  const required = ["destinatario", "documentos"];

  for (const field of required) {
    if (!data[field] || (field === "documentos" && data.documentos.length === 0)) {
      return { error: `Falta el campo requerido: ${field}` };
    }
  }

  const result = await resend.emails.send({
    from: FROM,
    to: data.destinatario,
    subject: data.asunto || "Home&Heart — Necesitamos documentación adicional",
    html: solicitudDocumentosEmailHtml(data),
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
  const dashboardUrl =
    data.dashboard_url ||
    `${process.env.NEXT_PUBLIC_URL || "https://homeandheart.es"}/dashboard`;

  return emailLayout({
    title: "¿Cómo fue tu experiencia? — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">¿Cómo fue tu experiencia?</h1>
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;text-align:center;">
        Hola <strong>${data.cliente_nombre || "Cliente"}</strong>, tu servicio en Home&amp;Heart ha finalizado. Cuéntanos cómo fue.
      </p>
      <p style="margin:28px 0 0;text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;width:100%;max-width:280px;background-color:#16a34a;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:8px;box-sizing:border-box;">
          ✅ Todo fue bien
        </a>
      </p>
      <p style="margin:16px 0 0;text-align:center;">
        <a href="${dashboardUrl}" style="display:inline-block;width:100%;max-width:280px;background-color:${AMBER};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:8px;box-sizing:border-box;">
          ⚠️ Hubo un problema
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:13px;color:#888;line-height:1.5;text-align:center;">
        Tienes 24 horas para responder. Si no contestas, el pago se liberará automáticamente.
      </p>`,
  });
}

async function sendServicioCompletadoEmail(data) {
  if (!data.cliente_id) {
    return { error: "Falta el campo requerido: cliente_id" };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: "Supabase no está configurado para este email" };
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("nombre, email_contacto")
    .eq("id", data.cliente_id)
    .single();

  if (profileError || !profile?.email_contacto) {
    return { error: "No se encontró el email del cliente" };
  }

  const result = await resend.emails.send({
    from: FROM,
    to: profile.email_contacto,
    subject: "¿Cómo fue tu experiencia? — Home&Heart",
    html: servicioCompletadoEmailHtml({
      cliente_nombre: profile.nombre,
      dashboard_url: `${process.env.NEXT_PUBLIC_URL || "https://homeandheart.es"}/dashboard`,
    }),
  });

  if (result.error) {
    return { error: result.error.message };
  }

  return { success: true, booking_id: data.booking_id };
}

async function sendMensajeNuevoEmail(data) {
  const destinatarioEmail = data.destinatario_email || data.destinatario;

  if (!destinatarioEmail) {
    return { error: "Falta el campo requerido: destinatario_email" };
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

export async function POST(request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      return Response.json(
        { error: "RESEND_API_KEY no está configurada" },
        { status: 500 },
      );
    }

    const body = await request.json();
    const { tipo, ...data } = body;

    if (tipo === "reserva_confirmada") {
      const result = await sendReservaConfirmadaEmails(data);

      if (result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (tipo === "reserva_nueva") {
      const result = await sendReservaNuevaEmail(data);

      if (result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (tipo === "solicitud_documentos") {
      const result = await sendSolicitudDocumentosEmail(data);

      if (result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (tipo === "mensaje_nuevo") {
      const result = await sendMensajeNuevoEmail(data);

      if (result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (tipo === "servicio_completado") {
      const result = await sendServicioCompletadoEmail(data);

      if (result.error) {
        return Response.json({ error: result.error }, { status: 400 });
      }

      return Response.json({ success: true });
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
        return Response.json({ error: result.error.message }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    if (tipo === "cancelacion_garantia") {
      const alternativas = Array.isArray(data.alternativas)
        ? data.alternativas.slice(0, 3)
        : [];
      const precioOriginal =
        data.precio_original != null
          ? `${Number(data.precio_original).toFixed(2)} €`
          : "tu reserva original";

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
          </div>
        `,
        )
        .join("");

      const result = await resend.emails.send({
        from: FROM,
        to: data.cliente_email,
        subject: "🛡️ Tu reserva fue cancelada — Activando Garantía Home&Heart",
        html: emailLayout({
          title: "Garantía Home&Heart",
          bodyHtml: `
            <h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_PRIMARY};">🛡️ Tu reserva fue cancelada</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#444;">
              Hola ${data.cliente_nombre ?? "Cliente"}, tu proveedor ha cancelado con menos de 24h de antelación.
              Hemos activado la <strong>Garantía Home&Heart</strong> y encontrado estas alternativas para ti:
            </p>
            ${cardsHtml || "<p style='font-size:14px;color:#666;'>No hay alternativas disponibles en este momento.</p>"}
            <p style="margin:20px 0 0;font-size:13px;color:#888;font-style:italic;">
              Precio garantizado igual al de tu reserva original (${precioOriginal}).
            </p>
          `,
        }),
      });

      if (result.error) {
        return Response.json({ error: result.error.message }, { status: 400 });
      }

      return Response.json({ success: true });
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
        return Response.json({ error: result.error.message }, { status: 400 });
      }

      return Response.json({ success: true });
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
        return Response.json({ error: result.error.message }, { status: 400 });
      }

      return Response.json({ success: true });
    }

    return Response.json(
      { error: `Tipo de email no soportado: ${tipo}` },
      { status: 400 },
    );
  } catch (err) {
    return Response.json(
      { error: err.message || "Error al enviar los emails" },
      { status: 500 },
    );
  }
}
