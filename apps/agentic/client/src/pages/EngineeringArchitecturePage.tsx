import { usePageMeta } from "@/hooks/usePageMeta";
import { EngineeringShell } from "@/pages/engineering/components/EngineeringShell";
import { ReferenceArchitectureDiagram } from "@/pages/engineering/components/ReferenceArchitectureDiagram";

export default function EngineeringArchitecturePage() {
  usePageMeta("HKI Reference Architecture");

  return (
    <EngineeringShell fullViewport contentClassName="p-0">
      <ReferenceArchitectureDiagram className="min-h-0 flex-1" />
    </EngineeringShell>
  );
}
