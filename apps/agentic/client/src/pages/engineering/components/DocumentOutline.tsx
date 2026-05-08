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
    <aside className={cn("hidden lg:block", className)}>
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
          Contents
        </p>
        <nav aria-label="Document outline">
          <ol className="space-y-0.5">
            {tops.map((n, i) => {
              const active = n.id === activeId;
              return (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    className={cn(
                      "group flex items-baseline gap-2.5 rounded-md py-1.5 pl-2 pr-2 text-[13px] leading-5 transition-colors",
                      active
                        ? "font-semibold text-primary"
                        : "font-medium text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 shrink-0 font-mono text-[10px] tabular-nums",
                        active ? "text-primary/70" : "text-muted-foreground/40"
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="truncate">{n.text}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="mt-6 border-t border-border/50 pt-5">
          <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            The Contract
          </p>
          <ul className="space-y-1.5">
            {HKI_CONTRACT.map(p => (
              <li
                key={p.label}
                className="flex items-start gap-2 text-[12px] leading-5 text-foreground/80"
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
