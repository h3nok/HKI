import type { ReactNode } from "react";
import { cn } from "@hki/ui";

/**
 * PullQuote — large serif quote, used to elevate an invariant or thesis
 * statement. Sits flush with the prose column, marked by a single accent rule.
 */
export function PullQuote({
  children,
  attribution,
  className,
}: {
  children: ReactNode;
  attribution?: ReactNode;
  className?: string;
}) {
  return (
    <figure
      className={cn(
        "my-14 border-l-2 border-primary/70 pl-6 sm:pl-8",
        className
      )}
    >
      <blockquote
        className="font-serif text-[24px] font-medium leading-[1.35] tracking-[-0.01em] text-foreground sm:text-[28px]"
        style={{ fontFamily: '"Source Serif 4", ui-serif, Georgia, serif' }}
      >
        {children}
      </blockquote>
      {attribution && (
        <figcaption className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {attribution}
        </figcaption>
      )}
    </figure>
  );
}
