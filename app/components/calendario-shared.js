export const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const RANGE_HIGHLIGHT = "#e8f0fb";

export function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateStr(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function getHoyStr() {
  const hoy = new Date();
  return toDateStr(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
}

export function isInRange(dateStr, start, end) {
  if (!start || !end) return false;
  const [a, b] = start <= end ? [start, end] : [end, start];
  return dateStr >= a && dateStr <= b;
}

export function buildMonthGrid(viewDate) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < firstWeekday; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDateStr(year, month, day));
  }
  return cells;
}

export function formatShortDate(dateStr) {
  const d = parseDateStr(dateStr);
  const day = d.getDate();
  const month = d
    .toLocaleDateString("es-ES", { month: "short" })
    .replace(/\.$/, "")
    .toLowerCase();
  return `${day} ${month}`;
}

export function handleRangeDayClick(dateStr, fechaInicio, fechaFin) {
  if (!fechaInicio || (fechaInicio && fechaFin)) {
    return { desde: dateStr, hasta: "" };
  }
  if (dateStr < fechaInicio) {
    return { desde: dateStr, hasta: "" };
  }
  return { desde: fechaInicio, hasta: dateStr };
}

export function ChevronIcon({ direction }) {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}
