import { cn } from "@hki/ui";
import {
  ArrowRight,
  BookOpen,
  Compass,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { getPipelineCoachCopy } from "../../pipelineCopy";

interface PipelineCoachCardsProps {
  status: string | null | undefined;
  failedAtStage?: string | null;
  error?: string | null;
  className?: string;
}

function CoachTile({
  label,
  body,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  body: string;
  icon: LucideIcon;
  tone?: "default" | "critical";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        tone === "critical"
          ? "border-red-500/15 bg-red-500/4"
          : "border-border/30 bg-background/70 dark:bg-background/30"
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-lg",
            tone === "critical" ? "bg-red-500/10" : "bg-primary/8"
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              tone === "critical" ? "text-red-500" : "text-primary"
            )}
          />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
          {label}
        </p>
      </div>
      <p className="mt-2 text-xs leading-5 text-foreground/85">{body}</p>
    </div>
  );
}

export function PipelineCoachCards({
  status,
  failedAtStage,
  error,
  className,
}: PipelineCoachCardsProps) {
  const coach = getPipelineCoachCopy({ status, failedAtStage, error });
  const isFailed = status === "failed";

  return (
    <div
      className={cn(
        "rounded-2xl border px-3 py-3",
        isFailed
          ? "border-red-500/15 bg-red-500/[0.03]"
          : "border-border/30 bg-muted/20 dark:bg-muted/10",
        className
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-xl",
            isFailed ? "bg-red-500/10" : "bg-primary/8"
          )}
        >
          <BookOpen
            className={cn(
              "h-4 w-4",
              isFailed ? "text-red-500" : "text-primary"
            )}
          />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground/70">
            Pipeline Coach
          </p>
          <p className="text-sm font-semibold text-foreground">{coach.title}</p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <CoachTile
          label="What Happened"
          body={coach.whatHappened}
          icon={BookOpen}
          tone={isFailed ? "critical" : "default"}
        />
        <CoachTile
          label="Why It Matters"
          body={coach.whyItMatters}
          icon={ShieldCheck}
          tone={isFailed ? "critical" : "default"}
        />
        <CoachTile
          label="Do Next"
          body={coach.nextStep}
          icon={isFailed ? Compass : ArrowRight}
          tone={isFailed ? "critical" : "default"}
        />
      </div>
    </div>
  );
}
