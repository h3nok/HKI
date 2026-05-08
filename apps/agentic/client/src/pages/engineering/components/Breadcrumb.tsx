import { ChevronRight } from "lucide-react";
import { cn } from "@hki/ui";

export type Crumb = {
  label: string;
  href?: string;
  onNavigate?: () => void;
};

export function Breadcrumb({
  trail,
  className,
}: {
  trail: readonly Crumb[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center text-sm", className)}
    >
      <ol className="flex items-center gap-1.5">
        {trail.map((c, i) => {
          const last = i === trail.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <ChevronRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50"
                  aria-hidden
                />
              )}
              {last || (!c.href && !c.onNavigate) ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn(
                    "font-semibold",
                    last ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {c.label}
                </span>
              ) : (
                <a
                  href={c.href ?? "#"}
                  onClick={
                    c.onNavigate
                      ? e => {
                          e.preventDefault();
                          c.onNavigate?.();
                        }
                      : undefined
                  }
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
