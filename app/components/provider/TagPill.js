import { BRAND } from "@/app/components/brand";
import { PRIMARY } from "@/app/lib/provider-verticals";

export default function TagPill({ label, selected, onClick, color = PRIMARY }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors"
      style={{
        borderColor: selected ? color : BRAND.border,
        backgroundColor: selected ? `${color}14` : "#fff",
        color: selected ? color : "#666",
      }}
    >
      {label}
    </button>
  );
}
