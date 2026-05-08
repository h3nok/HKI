import type { ReactNode } from "react";
import { Clock } from "lucide-react";
import { Badge, cn } from "@hki/ui";
import { ContractPills, HKI_CONTRACT } from "./ContractPills";

export function Hero({
  eyebrow,
  title,
  lede,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede: ReactNode;
  meta?: {
    version?: string;
    readingTimeMin?: number;
    sectionCount?: number;
    status?: string;
  };
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-12 border-b border-border/45 pb-10", className)}>
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        {meta?.status && (
          <Badge
            variant="outline"
            className="rounded-full border-success/40 bg-success/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-success"
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success align-middle" />
            {meta.status}
          </Badge>
        )}
        {meta?.version && (
          <span className="font-mono text-muted-foreground/70">
            {meta.version}
          </span>
        )}
        {eyebrow && (
          <span className="font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </span>
        )}
        <span className="ml-auto flex items-center gap-4 text-muted-foreground/70">
          {meta?.readingTimeMin !== undefined && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />~{meta.readingTimeMin} min
            </span>
          )}
          {meta?.sectionCount !== undefined && (
            <span>{meta.sectionCount} sections</span>
          )}
        </span>
      </div>

      <h1 className="max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
        {title}
      </h1>
      <p className="mt-5 max-w-prose text-lg leading-8 text-muted-foreground">
        {lede}
      </p>

      <ContractPills className="mt-6" pills={HKI_CONTRACT} />

      {actions && (
        <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>
      )}
    </section>
  );
}
