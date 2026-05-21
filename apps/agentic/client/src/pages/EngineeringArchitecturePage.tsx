import { usePageMeta } from "@/hooks/usePageMeta";
import { EngineeringShell } from "@/pages/engineering/components/EngineeringShell";
import { ReferenceArchitectureDiagram } from "@/pages/engineering/components/ReferenceArchitectureDiagram";

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
        <div className="engineering-topbar border-b">
          <div className="flex min-h-12 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                HKI Reference Architecture
              </p>
              <h1 className="text-sm font-extrabold tracking-tight text-foreground sm:text-base">
                Flow inspector workspace
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]">
              {CONTEXT_PILLS.map(pill => (
                <span
                  key={pill}
                  className="engineering-chip rounded-md px-2.5 py-1 text-muted-foreground"
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
