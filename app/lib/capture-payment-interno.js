/**
 * Invoca /api/stripe/capture-payment con CRON_SECRET (misma vía que el cron).
 */
export async function invocarCapturePaymentInterno({ paymentIntentId, bookingId }) {
  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_URL no configurada");
  }

  if (!paymentIntentId) {
    return {
      ok: false,
      status: 400,
      data: { error: "Falta paymentIntentId" },
    };
  }

  const res = await fetch(`${baseUrl}/api/stripe/capture-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CRON_SECRET}`,
    },
    body: JSON.stringify({ paymentIntentId, bookingId }),
  });

  const data = await res.json().catch(() => ({}));

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}
