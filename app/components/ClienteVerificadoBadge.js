/**
 * Badge de cliente con DNI aprobado por admin.
 * Visualmente alineado con el "Verificado ✓" de proveedores
 * (profiles.verificado), pero texto propio — no mezclar conceptos.
 */
export default function ClienteVerificadoBadge({ className = "", compact = false }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-semibold ${
        compact ? "text-[9px]" : "text-[10px]"
      } ${className}`}
      style={{ backgroundColor: "#e8f0fb", color: "#163a6b" }}
    >
      Cliente verificado ✓
    </span>
  );
}
