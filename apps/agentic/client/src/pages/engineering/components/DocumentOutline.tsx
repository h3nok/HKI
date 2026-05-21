import { cn } from "@hki/ui";
import type { OutlineNode } from "./useDocumentOutline";
import { ContractPills, HKI_CONTRACT } from "./ContractPills";

export function DocumentOutline({
  nodes,
  activeId,
  className,
}: {
  nodes: readonly OutlineNode[];
  activeId: string;
  className?: string;
}) {
  // Only top-level H2s in the left rail; H3s live in the right rail.
  const tops = nodes.filter(n => n.level === 2);

  return (
    <aside className={cn("hidden xl:block", className)}>
      <div className="engineering-panel sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto p-3">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Contents
        </p>
        <nav aria-label="Document outline">
          <ol className="space-y-0.5 border-l border-border pl-2">
            {tops.map((n, i) => {
              const active = n.id === activeId;
              return (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    aria-current={active ? "location" : undefined}
                    className={cn(
                      "group -ml-2.75 flex items-baseline gap-2 rounded-md border-l-2 py-1.5 pl-2.5 pr-2 text-[12px] leading-5 outline-none transition-[background-color,border-color,color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active
                        ? "border-primary bg-primary/8 font-semibold text-primary"
                        : "border-transparent font-medium text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "relative w-5 shrink-0 font-mono text-[10px] tabular-nums",
                        active ? "text-primary/80" : "text-muted-foreground"
                      )}
                    >
                      {active && (
                        <span className="absolute -left-3.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary" />
                      )}
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="wrap-break-word">{n.text}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            The Contract
          </p>
          <ul className="space-y-1.5">
            {HKI_CONTRACT.map(p => (
              <li
                key={p.label}
                className="flex items-start gap-2 text-[12px] leading-5 text-foreground"
              >
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                <span>
                  <span className="font-semibold text-foreground">
                    {p.label}
                  </span>
                  {p.detail && (
                    <span className="text-muted-foreground"> · {p.detail}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

// Re-export for convenience, though some callers will prefer importing from
// ContractPills directly.
export { ContractPills };
