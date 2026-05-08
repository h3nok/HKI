import type { ReactNode } from "react";
import { cn } from "@hki/ui";

export function SectionLede({
  id,
  eyebrow,
  title,
  takeaway,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  takeaway?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("scroll-mt-28 max-w-prose", className)}>
      {eyebrow && (
        <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <span className="h-1 w-4 rounded-full bg-primary/60" aria-hidden />
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className="scroll-mt-24 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
      >
        {title}
      </h2>
      {takeaway && (
        <p className="mt-3 text-base leading-7 text-muted-foreground">
          {takeaway}
        </p>
      )}
    </header>
  );
}
