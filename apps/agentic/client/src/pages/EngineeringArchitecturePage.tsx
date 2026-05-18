import { usePageMeta } from "@/hooks/usePageMeta";
import { EngineeringShell } from "@/pages/engineering/components/EngineeringShell";
import { ReferenceArchitectureDiagram } from "@/pages/engineering/components/ReferenceArchitectureDiagram";
import { ARCHITECTURE_COLORS } from "@/pages/engineering/components/architecture/planes";

const CONTEXT_PILLS: readonly string[] = [
  "Runtime path",
  "Publication plane",
  "Admin control",
];

export default function EngineeringArchitecturePage() {
  usePageMeta("HKI Reference Architecture");

  return (
    <EngineeringShell
      fullViewport
      contentClassName="px-3 py-3 sm:px-4 sm:py-4"
      contextStrip={
        <div
          className="border-b backdrop-blur-xl"
          style={{
            background: ARCHITECTURE_COLORS.surface.panel,
            borderColor: ARCHITECTURE_COLORS.surface.border,
          }}
        >
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <div>
              <p
                className="text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: ARCHITECTURE_COLORS.surface.textSubtle }}
              >
                HKI Reference Architecture
              </p>
              <h1
                className="text-sm font-extrabold tracking-tight sm:text-base"
                style={{ color: ARCHITECTURE_COLORS.surface.text }}
              >
                Flow inspector workspace
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              {CONTEXT_PILLS.map(pill => (
                <span
                  key={pill}
                  className="rounded-md border px-2.5 py-1"
                  style={{
                    background: ARCHITECTURE_COLORS.surface.panelRaised,
                    borderColor: ARCHITECTURE_COLORS.surface.border,
                    color: ARCHITECTURE_COLORS.surface.textMuted,
                  }}
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <ReferenceArchitectureDiagram className="min-h-0 flex-1" />
    </EngineeringShell>
  );
}
