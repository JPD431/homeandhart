export function getHoyDateStr() {
  const hoy = new Date();
  return hoy.toISOString().split("T")[0];
}

export function isOfertaActiva(service) {
  if (!service?.oferta_descuento || !service?.oferta_valida_hasta) {
    return false;
  }
  return service.oferta_valida_hasta >= getHoyDateStr();
}

export function getPrecioConDescuento(precio, descuentoPct) {
  const base = Number(precio);
  const descuento = Number(descuentoPct);
  if (!base || !descuento) return base;
  return Math.round(base * (1 - descuento / 100) * 100) / 100;
}

export function getPrecioEfectivo(service) {
  const precio = Number(service?.precio) || 0;
  if (!isOfertaActiva(service)) return precio;
  return getPrecioConDescuento(precio, service.oferta_descuento);
}

export function formatOfertaValidaHasta(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
