import { getPrecioConDescuento, isOfertaActiva } from "@/app/lib/ofertas";

export function normalizeDescuentosDuracion(raw) {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((t) => ({
      minDias: Number(t?.minDias),
      descuento: Number(t?.descuento),
    }))
    .filter((t) => t.minDias > 0 && t.descuento >= 1 && t.descuento <= 50)
    .sort((a, b) => a.minDias - b.minDias);
}

export function getDuracionUnitLabel(vertical, count) {
  const n = Number(count);
  if (vertical === "alojamiento") return n === 1 ? "noche" : "noches";
  if (vertical === "ninos") return n === 1 ? "hora" : "horas";
  return n === 1 ? "día" : "días";
}

export function getDescuentoDuracionPercent(service, duration) {
  const tiers = normalizeDescuentosDuracion(service?.descuentos_duracion);
  if (!tiers.length || !duration) return 0;

  let best = 0;
  for (const tier of tiers) {
    if (duration >= tier.minDias && tier.descuento > best) {
      best = tier.descuento;
    }
  }
  return best;
}

export function getBestDiscountPercent(service, duration) {
  const ofertaPct = isOfertaActiva(service)
    ? Number(service.oferta_descuento) || 0
    : 0;
  const duracionPct = getDescuentoDuracionPercent(service, duration);

  if (duracionPct >= ofertaPct && duracionPct > 0) {
    return { pct: duracionPct, source: "duration" };
  }
  if (ofertaPct > 0) {
    return { pct: ofertaPct, source: "offer" };
  }
  return { pct: 0, source: null };
}

export function applyBestDiscountToBase(base, service, duration) {
  const { pct, source } = getBestDiscountPercent(service, duration);
  if (!pct || !base) return { total: base, pct: 0, source: null };
  return {
    total: getPrecioConDescuento(base, pct),
    pct,
    source,
  };
}

export function formatDescuentosDuracionList(service) {
  const tiers = normalizeDescuentosDuracion(service?.descuentos_duracion);
  if (!tiers.length) return null;

  return tiers
    .map(
      (t) =>
        `${t.descuento}% desc. a partir de ${t.minDias} ${getDuracionUnitLabel(service.vertical, t.minDias)}`,
    )
    .join(" · ");
}

export function serializeDescuentosDuracionForDb(details) {
  if (!details.descuentos_duracion_activa) return null;

  const tiers = (details.descuentos_duracion || [])
    .map((t) => ({
      minDias: Number(t.minDias),
      descuento: Math.min(50, Math.max(1, Number(t.descuento))),
    }))
    .filter((t) => t.minDias > 0 && t.descuento >= 1)
    .sort((a, b) => a.minDias - b.minDias)
    .slice(0, 3);

  return tiers.length > 0 ? tiers : null;
}
