import { createClient } from "@supabase/supabase-js";
import { resolverEmailUsuario } from "@/app/lib/email-usuario";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export async function GET(request, { params }) {
  const { bookingId } = await params;

  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `
      *,
      profiles!cliente_id (nombre, apellido, email_contacto, ciudad),
      services:service_id (titulo, vertical, precio, profiles!proveedor_id (nombre, apellido))
    `,
    )
    .eq("id", bookingId)
    .single();

  if (!booking) {
    return Response.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const clienteEmail =
    (await resolverEmailUsuario(booking.cliente_id)) ||
    booking.profiles?.email_contacto ||
    "";

  const precioTotal = Number(booking.precio_total) || 0;
  const precioBase = precioTotal / 1.21;
  const iva = precioTotal - precioBase;
  const fecha = new Date(booking.created_at).toLocaleDateString("es-ES");
  const numeroFactura = `HH-${bookingId.slice(0, 8).toUpperCase()}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
        .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
        .logo { font-size: 24px; font-weight: bold; color: #1d4f91; }
        .slogan { font-size: 12px; color: #666; font-style: italic; }
        h2 { color: #1d4f91; border-bottom: 2px solid #e8f0fb; padding-bottom: 8px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .info-box { background: #f7f5f2; padding: 16px; border-radius: 8px; }
        .info-box label { font-size: 11px; color: #888; text-transform: uppercase; }
        .info-box p { margin: 4px 0 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1d4f91; color: white; padding: 10px; text-align: left; font-size: 13px; }
        td { padding: 10px; border-bottom: 1px solid #e8e4de; font-size: 13px; }
        .total-row { font-weight: bold; background: #e8f0fb; }
        .footer { margin-top: 40px; font-size: 11px; color: #888; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">Home&Heart</div>
          <div class="slogan">Donde estés, estamos.</div>
        </div>
        <div style="text-align: right; font-size: 13px; color: #444;">
          <strong>Factura ${numeroFactura}</strong><br>
          Fecha: ${fecha}<br>
          homeandheart.es
        </div>
      </div>

      <h2>Datos del cliente</h2>
      <div class="info-grid">
        <div class="info-box">
          <label>Cliente</label>
          <p>${booking.profiles?.nombre || ""} ${booking.profiles?.apellido || ""}</p>
          <p style="color:#666; font-size:12px;">${clienteEmail}</p>
        </div>
        <div class="info-box">
          <label>Proveedor</label>
          <p>${booking.services?.profiles?.nombre || ""} ${booking.services?.profiles?.apellido || ""}</p>
        </div>
      </div>

      <h2>Detalle del servicio</h2>
      <table>
        <tr>
          <th>Servicio</th>
          <th>Fechas</th>
          <th>Importe base</th>
          <th>IVA (21%)</th>
          <th>Total</th>
        </tr>
        <tr>
          <td>${booking.services?.titulo || "Servicio Home&Heart"}</td>
          <td>${booking.fecha_inicio || ""} ${booking.fecha_fin ? "→ " + booking.fecha_fin : ""}</td>
          <td>${precioBase.toFixed(2)}€</td>
          <td>${iva.toFixed(2)}€</td>
          <td>${precioTotal.toFixed(2)}€</td>
        </tr>
        <tr class="total-row">
          <td colspan="4" style="text-align: right;">Total pagado</td>
          <td>${precioTotal.toFixed(2)}€</td>
        </tr>
      </table>

      <div class="footer">
        Home&Heart · homeandheart.es · soporte@homeandheart.es<br>
        Esta factura ha sido generada automáticamente.
      </div>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="factura-${numeroFactura}.html"`,
    },
  });
}
