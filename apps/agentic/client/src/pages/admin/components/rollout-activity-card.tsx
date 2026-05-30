import {
  Clock3,
  Pencil,
  RotateCcw,
  Sparkles,
  ToggleLeft,
  Trash2,
} from "lucide-react";
import { cn } from "@hki/ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { a } from "../theme";
import { TONE_STYLES } from "../constants";
import { formatAuditTimestamp } from "../utils";
import type { FeatureFlagAuditEvent, Tone } from "../types";

function eventIcon(kind: FeatureFlagAuditEvent["kind"]) {
  switch (kind) {
    case "preset-update":
      return Pencil;
    case "preset-delete":
      return Trash2;
    case "preset-apply":
    case "preset-create":
      return Sparkles;
    case "override":
      return ToggleLeft;
    case "reset":
    default:
      return RotateCcw;
  }
}

function eventTone(kind: FeatureFlagAuditEvent["kind"]): Tone {
  switch (kind) {
    case "preset-create":
      return "positive";
    case "preset-delete":
      return "critical";
    case "preset-apply":
    case "preset-update":
      return "primary";
    case "override":
      return "warning";
    case "reset":
    default:
      return "neutral";
  }
}

function eventVerb(kind: FeatureFlagAuditEvent["kind"]) {
  switch (kind) {
    case "preset-create":
      return "created";
    case "preset-update":
      return "updated";
    case "preset-delete":
      return "deleted";
    case "preset-apply":
      return "applied preset";
    case "override":
      return "toggled";
    case "reset":
    default:
      return "reset";
  }
}

export function RolloutActivityCard({
  events,
  isLoading,
  error,
}: {
  events: FeatureFlagAuditEvent[];
  isLoading: boolean;
  error?: string;
}) {
  return (
    <Card className={cn(a.card, "overflow-hidden")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <p className={a.sectionEyebrow}>Activity</p>
          <Clock3 className="h-3.5 w-3.5 text-muted-foreground/50" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-3 text-xs text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="py-3 text-xs text-destructive">{error}</p>
        ) : events.length === 0 ? (
          <p className="py-3 text-xs text-muted-foreground">No activity yet.</p>
        ) : (
          <div className="space-y-0.5">
            {events.map(event => {
              const Icon = eventIcon(event.kind);
              const tone = eventTone(event.kind);
              const styles = TONE_STYLES[tone];
              const actor = event.actorEmail.split("@")[0];

              return (
                <div
                  key={event.id}
                  className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40"
                >
                  <div
                    className={cn(
                      styles.iconClass,
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                    <span className="font-medium">{actor}</span>{" "}
                    <span className="text-muted-foreground">
                      {eventVerb(event.kind)}
                    </span>{" "}
                    <span className="font-medium">{event.title}</span>
                  </span>
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/80">
                    {formatAuditTimestamp(event.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
