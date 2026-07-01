import { BRAND } from "@/app/components/brand";

export default function CounterField({ label, value, onChange, min = 0 }) {
  return (
    <div className="rounded-xl border p-3 text-center" style={{ borderColor: BRAND.border }}>
      <p className="text-xs text-[#666]">{label}</p>
      <div className="mt-2 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg"
          style={{ borderColor: BRAND.border }}
        >
          −
        </button>
        <span className="w-6 text-center text-lg font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border text-lg"
          style={{ borderColor: BRAND.border }}
        >
          +
        </button>
      </div>
    </div>
  );
}
