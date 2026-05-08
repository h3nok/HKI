import { useMemo } from "react";
import { cn } from "@hki/ui";
import type { OutlineNode } from "./useDocumentOutline";

/**
 * Right rail. Shows H3s belonging to the current H2.
 */
export function OnThisPage({
  nodes,
  activeId,
  className,
}: {
  nodes: readonly OutlineNode[];
  activeId: string;
  className?: string;
}) {
  const subs = useMemo(() => {
    if (!nodes.length) return [] as OutlineNode[];
    // Find the section: scan back from activeId to nearest H2; collect H3s
    // until the next H2.
    const idx = nodes.findIndex(n => n.id === activeId);
    if (idx < 0) return [];
    let startH2 = idx;
    while (startH2 >= 0 && nodes[startH2].level !== 2) startH2--;
    if (startH2 < 0) return [];
    const out: OutlineNode[] = [];
    for (let i = startH2 + 1; i < nodes.length; i++) {
      if (nodes[i].level === 2) break;
      if (nodes[i].level === 3) out.push(nodes[i]);
    }
    return out;
  }, [nodes, activeId]);

  if (subs.length === 0) {
    return <aside className={cn("hidden xl:block", className)} aria-hidden />;
  }

  return (
    <aside className={cn("hidden xl:block", className)}>
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
          On this page
        </p>
        <nav aria-label="On this page">
          <ol className="space-y-1 border-l border-border/50">
            {subs.map(s => {
              const active = s.id === activeId;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className={cn(
                      "block border-l py-1 pl-3 -ml-px text-[12px] leading-5 transition-colors",
                      active
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground"
                    )}
                  >
                    {s.text}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </aside>
  );
}
