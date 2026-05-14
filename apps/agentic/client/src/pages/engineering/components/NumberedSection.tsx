import type { ReactNode } from "react";
import { cn } from "@hki/ui";

/**
 * NumberedSection — chapter-style header for the publication.
 *
 *   ── 01 ──────────────────────────────
 *   Executive Brief
 *   Autonomy changes the threat model.
 *
 *   <lede paragraph>
 */
export function NumberedSection({
  id,
  number,
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  id?: string;
  number: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cn("scroll-mt-24", className)}
    >
      <div className="mb-10 flex items-center gap-5">
        <span
          aria-hidden
          className="font-mono text-[11px] font-semibold tracking-[0.2em] text-muted-foreground/70"
        >
          {number}
        </span>
        <span aria-hidden className="h-px flex-1 bg-border/70" />
        {eyebrow && (
          <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            {eyebrow}
          </span>
        )}
      </div>

      <header className="max-w-[34ch]">
        <h2
          id={id ? `${id}-title` : undefined}
          className="font-serif text-[34px] font-semibold leading-[1.1] tracking-[-0.015em] text-foreground sm:text-[40px]"
          style={{ fontFamily: '"Source Serif 4", ui-serif, Georgia, serif' }}
        >
          {title}
        </h2>
      </header>

      {lede && (
        <p
          className="mt-6 max-w-[60ch] text-[18px] leading-[1.65] text-foreground/75"
          style={{ fontFamily: '"Source Serif 4", ui-serif, Georgia, serif' }}
        >
          {lede}
        </p>
      )}

      {children && <div className="mt-10">{children}</div>}
    </section>
  );
}
