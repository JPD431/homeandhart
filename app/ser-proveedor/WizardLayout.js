"use client";

import { BRAND, SERIF } from "@/app/components/brand";
import {
  getProgressPosition,
  getStepIndex,
  STEP_KEY,
  VERTICAL_COLORS,
} from "@/app/ser-proveedor/onboarding-steps";

const PRIMARY = "#1d4f91";
const GREEN = "#0e7a5c";

function StepDot({ vertical }) {
  if (!vertical) return null;
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: VERTICAL_COLORS[vertical] || PRIMARY }}
      aria-hidden
    />
  );
}

function SidebarStepItem({ step, status, isConfirm, stepNumber }) {
  const isCompleted = status === "completed";
  const isCurrent = status === "current";

  return (
    <li
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
      style={{
        backgroundColor: isCurrent ? "#e8f0fb" : "transparent",
        color: isCurrent ? PRIMARY : isCompleted ? "#444" : "#999",
        fontWeight: isCurrent ? 600 : 400,
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          backgroundColor: isCompleted ? GREEN : isCurrent ? PRIMARY : "#eee",
          color: isCompleted || isCurrent ? "#fff" : "#aaa",
        }}
      >
        {isCompleted ? "✓" : isConfirm ? "🎉" : stepNumber}
      </span>
      <StepDot vertical={step.vertical} />
      <span className="min-w-0 truncate">{step.label}</span>
    </li>
  );
}

export default function WizardLayout({
  visibleSteps,
  currentStepKey,
  verticales,
  children,
  footer,
}) {
  const isConfirm = currentStepKey === STEP_KEY.CONFIRMACION;
  const currentIdx = isConfirm
    ? visibleSteps.length
    : getStepIndex(visibleSteps, currentStepKey);
  const { current: progressCurrent, total: progressTotal } = getProgressPosition(
    currentStepKey,
    verticales,
  );
  const progressPct =
    progressTotal > 0 ? Math.round((progressCurrent / progressTotal) * 100) : 0;

  const sidebarSteps = isConfirm
    ? [...visibleSteps, { key: STEP_KEY.CONFIRMACION, label: "Confirmación", vertical: null }]
    : visibleSteps;

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: BRAND.warm, color: "#1a1a1a" }}>
      {/* Móvil: barra de progreso horizontal */}
      <div
        className="border-b bg-white px-4 py-3 lg:hidden"
        style={{ borderColor: BRAND.border }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold" style={{ color: PRIMARY, fontFamily: SERIF }}>
            Home&Heart
          </p>
          <p className="text-xs text-[#666]">
            Paso {progressCurrent} de {progressTotal}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#eee]">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPct}%`, backgroundColor: PRIMARY }}
          />
        </div>
        {!isConfirm && currentStepKey && (
          <p className="mt-2 truncate text-xs font-medium text-[#444]">
            {visibleSteps.find((s) => s.key === currentStepKey)?.label}
          </p>
        )}
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-0px)] max-w-6xl flex-col lg:flex-row">
        {/* Barra lateral — desktop */}
        <aside
          className="hidden w-64 shrink-0 flex-col border-r bg-white lg:flex"
          style={{ borderColor: BRAND.border }}
        >
          <div className="border-b px-5 py-6" style={{ borderColor: BRAND.border }}>
            <p
              className="text-lg font-semibold"
              style={{ color: PRIMARY, fontFamily: SERIF }}
            >
              Home&Heart
            </p>
            <p className="mt-1 text-xs text-[#888]">Crea tu perfil de proveedor</p>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="flex flex-col gap-0.5">
              {sidebarSteps.map((step, idx) => {
                let status = "pending";
                if (isConfirm) {
                  status = idx < sidebarSteps.length - 1 ? "completed" : "current";
                } else if (idx < currentIdx) {
                  status = "completed";
                } else if (idx === currentIdx) {
                  status = "current";
                }
                return (
                  <SidebarStepItem
                    key={step.key}
                    step={step}
                    status={status}
                    stepNumber={idx + 1}
                    isConfirm={isConfirm && idx === sidebarSteps.length - 1}
                  />
                );
              })}
            </ul>
          </nav>

          <div className="border-t px-5 py-4" style={{ borderColor: BRAND.border }}>
            <p className="text-xs font-medium text-[#666]">
              Paso {progressCurrent} de {progressTotal}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eee]">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${progressPct}%`, backgroundColor: PRIMARY }}
              />
            </div>
          </div>
        </aside>

        {/* Contenido del paso */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</div>
          {footer ? (
            <div
              className="border-t bg-white px-4 py-4 sm:px-8"
              style={{ borderColor: BRAND.border }}
            >
              {footer}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
