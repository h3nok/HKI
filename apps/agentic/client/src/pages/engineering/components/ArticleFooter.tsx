import { ArrowUpRight, FileText, Github, Home } from "lucide-react";
import { cn } from "@hki/ui";

export type FooterLink = {
  label: string;
  href: string;
  icon?: "printable" | "source" | "hub";
  external?: boolean;
  onNavigate?: () => void;
};

export function ArticleFooter({
  links,
  className,
}: {
  links: readonly FooterLink[];
  className?: string;
}) {
  return (
    <footer className={cn("mt-24 border-t border-border/50 pt-10", className)}>
      <div className="grid gap-3 sm:grid-cols-3">
        {links.map(l => {
          const Icon =
            l.icon === "printable"
              ? FileText
              : l.icon === "source"
                ? Github
                : l.icon === "hub"
                  ? Home
                  : undefined;
          return (
            <a
              key={l.label}
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              onClick={
                l.onNavigate
                  ? e => {
                      e.preventDefault();
                      l.onNavigate?.();
                    }
                  : undefined
              }
              className="group flex items-center justify-between gap-3 rounded-md border border-border/60 bg-card/40 px-4 py-3 text-sm transition-colors hover:border-border hover:bg-muted/40"
            >
              <span className="flex items-center gap-2.5 font-semibold text-foreground">
                {Icon && (
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                )}
                {l.label}
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
            </a>
          );
        })}
      </div>
    </footer>
  );
}
