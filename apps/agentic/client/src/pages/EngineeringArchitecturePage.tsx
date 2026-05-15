import { cn, hub } from "@hki/ui";

import { usePageMeta } from "@/hooks/usePageMeta";
import { EngineeringHeader } from "@/pages/engineering/components/EngineeringHeader";
import { ReferenceArchitectureDiagram } from "@/pages/engineering/components/ReferenceArchitectureDiagram";

export default function EngineeringArchitecturePage() {
  usePageMeta("HKI Reference Architecture");

  return (
    <div className={cn(hub.page, "min-h-screen bg-background")}>
      <EngineeringHeader />

      <main className="mx-auto w-full max-w-7xl px-5 py-4 sm:px-8">
        <ReferenceArchitectureDiagram className="min-h-0" />
      </main>
    </div>
  );
}
