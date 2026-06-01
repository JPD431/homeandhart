import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "soporte@homeandheartapp.com";
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
  const mensajeBlock = data.mensaje
    ? `<p style="margin:16px 0 0;font-size:14px;color:#444;line-height:1.6;"><strong>Tu mensaje:</strong> ${data.mensaje}</p>`
    : "";

  return emailLayout({
    title: "¡Reserva confirmada! — Home&Heart",
    bodyHtml: `
      <h1 style="margin:0;font-size:22px;color:${BRAND_PRIMARY};font-weight:600;text-align:center;">¡Tu reserva está confirmada!</h1>
      ${detailsBlock(data)}
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        Proveedor: <strong>${data.proveedor_nombre}</strong>
      </p>
      ${mensajeBlock}
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
      <p style="margin:20px 0 0;font-size:14px;color:#444;line-height:1.6;">
        El cliente recibirá tus datos de contacto para coordinarse.
      </p>`,
  });
}

async function sendReservaConfirmadaEmails(data) {
  const required = [
    "cliente_email",
    "cliente_nombre",
    "proveedor_email",
    "proveedor_nombre",
    "servicio_titulo",
    "fecha_inicio",
    "precio_total",
  ];

  for (const field of required) {
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
