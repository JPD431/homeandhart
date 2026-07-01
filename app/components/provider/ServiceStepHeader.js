import { SERIF } from "@/app/components/brand";

export default function ServiceStepHeader({ title, color }) {
  return (
    <div
      className="mb-6 rounded-xl px-5 py-4 text-white"
      style={{ backgroundColor: color }}
    >
      <h2 className="text-2xl font-semibold" style={{ fontFamily: SERIF }}>
        {title}
      </h2>
    </div>
  );
}
