const LEGACY_CANCEL_POLICIES = {
  "24h": "flexible",
  "48h": "moderada",
  "7d": "estricta",
};

export function normalizeCancelPolicy(policy) {
  return LEGACY_CANCEL_POLICIES[policy] ?? policy;
}

export function getServiceStartDateTime(vertical, fechaInicio, hora) {
  if (!fechaInicio) return null;
  if (vertical === "ninos" && !hora) return null;
  const [y, m, d] = fechaInicio.split("-").map(Number);
  if (vertical === "ninos") {
    const [hh, mm] = hora.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm, 0, 0);
  }
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Porcentaje de reembolso (0–100) si se cancela en cancelAt. */
export function getRefundPercent(policy, cancelAt, serviceStartAt) {
  if (!serviceStartAt || cancelAt >= serviceStartAt) return 0;

  const policyKey = normalizeCancelPolicy(policy);
  if (policyKey === "none") return 0;

  const hoursUntil =
    (serviceStartAt.getTime() - cancelAt.getTime()) / (1000 * 60 * 60);
  const daysUntil = hoursUntil / 24;

  switch (policyKey) {
    case "flexible":
      if (hoursUntil > 24) return 100;
      return 50;
    case "moderada":
      if (daysUntil > 3) return 100;
      if (hoursUntil > 24) return 50;
      return 0;
    case "estricta":
      if (daysUntil > 7) return 100;
      if (daysUntil > 3) return 50;
      return 0;
    default:
      return 0;
  }
}
