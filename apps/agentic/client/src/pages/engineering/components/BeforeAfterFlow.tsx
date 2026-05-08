import { cn } from "@hki/ui";

export type FlowStep = {
  label: string;
  caption?: string;
};

export type FlowRail = {
  title: string;
  tone: "risk" | "safe";
  tag?: string;
  steps: readonly FlowStep[];
};

export function BeforeAfterFlow({
  rails,
  className,
}: {
  rails: readonly [FlowRail, FlowRail];
  className?: string;
}) {
  const rowCount = Math.max(rails[0].steps.length, rails[1].steps.length);

  return (
    <div
      className={cn("grid gap-x-5 gap-y-4 sm:grid-cols-2", className)}
      role="group"
      aria-label="Before and after comparison"
    >
      {rails.map(rail => (
        <div key={rail.title} className="min-w-0">
          {/* Rail header */}
          <div
            className={cn(
              "mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-2",
              rail.tone === "risk"
                ? "border-destructive/30 bg-destructive/6"
                : "border-success/30 bg-success/6"
            )}
          >
            <p
              className={cn(
                "text-[11px] font-bold uppercase tracking-[0.14em]",
                rail.tone === "risk" ? "text-destructive" : "text-success"
              )}
            >
              {rail.title}
            </p>
            {rail.tag && (
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                  rail.tone === "risk"
                    ? "border-destructive/40 text-destructive"
                    : "border-success/40 text-success"
                )}
              >
                {rail.tag}
              </span>
            )}
          </div>

          {/* Steps with visible vertical track */}
          <div className="relative">
            <div
              aria-hidden
              className={cn(
                "absolute left-4.5 top-6 bottom-6 w-px",
                rail.tone === "risk" ? "bg-destructive/25" : "bg-success/25"
              )}
            />
            <ol className="space-y-2.5">
              {Array.from({ length: rowCount }).map((_, i) => {
                const step = rail.steps[i];

                if (!step) {
                  return (
                    <li
                      key={`spacer-${i}`}
                      aria-hidden
                      className="h-11 rounded-md border border-dashed border-border/25"
                    />
                  );
                }

                return (
                  <li
                    key={step.label}
                    className={cn(
                      "relative overflow-hidden rounded-md border",
                      rail.tone === "risk"
                        ? "border-destructive/25 bg-destructive/5"
                        : "border-success/25 bg-success/5"
                    )}
                  >
                    {/* Left accent bar */}
                    <div
                      aria-hidden
                      className={cn(
                        "absolute inset-y-0 left-0 w-0.5",
                        rail.tone === "risk"
                          ? "bg-destructive/50"
                          : "bg-success/55"
                      )}
                    />
                    <div className="flex min-h-11 items-center gap-3 pl-4 pr-3 py-2.5">
                      <span
                        className={cn(
                          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          rail.tone === "risk"
                            ? "bg-destructive/15 text-destructive"
                            : "bg-success/15 text-success"
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold leading-5 text-foreground">
                          {step.label}
                        </p>
                        {step.caption && (
                          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                            {step.caption}
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
