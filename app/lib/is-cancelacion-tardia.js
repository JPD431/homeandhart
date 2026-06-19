/** Cancelación a menos de 24 h del inicio del servicio (misma lógica que garantía). */
export function isCancelacionTardia(fechaInicio) {
  if (!fechaInicio) return false;
  const start = new Date(`${fechaInicio}T12:00:00`);
  const hoursUntil = (start.getTime() - Date.now()) / (1000 * 60 * 60);
  return hoursUntil < 24;
}
