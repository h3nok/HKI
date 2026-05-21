import { ArrowDown } from "lucide-react";
import { cn } from "@hki/ui";

/**
 * PublicationMasthead — single-screen hero for the HKI standard.
 *
 * Design discipline: one screen, one job. Eyebrow, title, abstract, byline.
 * One affordance: "Begin reading". No metric grids, no jump rails, no chips.
 * Everything else lives in the document itself or the end matter.
 */
export function PublicationMasthead({
  eyebrow,
  title,
  abstract,
  authors,
  publishedOn,
  readingMinutes,
  version,
  beginHref,
  onBegin,
  className,
}: {
  eyebrow: string;
  title: string;
  abstract: string;
  authors: string;
  publishedOn: string;
  readingMinutes: number;
  version: string;
  beginHref: string;
  onBegin: (href: string) => void;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "relative isolate border-b border-border pb-12 pt-12 sm:pt-16",
        className
      )}
    >
      {/* Hairline rule at top, mimicking a printed cover sheet */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="max-w-[68ch]">
        <p className="mb-10 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          <span aria-hidden className="h-px w-8 bg-primary/60" />
          {eyebrow}
        </p>

        <h1
          id="hki-article-title"
          className="font-serif text-[44px] font-semibold leading-[1.03] tracking-[-0.02em] text-foreground sm:text-[60px] md:text-[72px]"
        >
          {title}
        </h1>

        <p className="mt-8 max-w-[60ch] font-serif text-[19px] leading-[1.6] text-foreground/80 sm:text-[21px]">
          {abstract}
        </p>
      </div>

      <div className="mt-10 flex flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:items-end sm:justify-between">
        <dl className="grid grid-cols-2 gap-x-10 gap-y-4 text-[12px] sm:grid-cols-4">
          <div>
            <dt className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Authors
            </dt>
            <dd className="mt-1.5 font-medium text-foreground">{authors}</dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Published
            </dt>
            <dd className="mt-1.5 font-medium text-foreground">
              {publishedOn}
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Reading
            </dt>
            <dd className="mt-1.5 font-medium text-foreground">
              {readingMinutes} min
            </dd>
          </div>
          <div>
            <dt className="font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Version
            </dt>
            <dd className="mt-1.5 font-medium text-foreground">{version}</dd>
          </div>
        </dl>

        <a
          href={beginHref}
          onClick={event => {
            event.preventDefault();
            onBegin(beginHref);
          }}
          className="group inline-flex items-center gap-3 self-start border-b border-border pb-1 text-sm font-semibold tracking-wide text-foreground transition-colors hover:border-foreground hover:text-foreground sm:self-end"
        >
          Begin reading
          <ArrowDown className="h-4 w-4 transition-transform group-hover:translate-y-0.5" />
        </a>
      </div>
    </header>
  );
}
