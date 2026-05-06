import { Wrench } from "lucide-react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { a } from "../theme";
import { SOFT_BADGE_CLASS } from "../constants";
import { SectionPill, SettingsButton } from "./primitives";

export function DebugSessionCard({
  debugSession,
  isDebugSessionActive,
  isDebugSessionPending,
  onStart,
  onStop,
}: {
  debugSession: {
    active: boolean;
    expiresAt: string | null;
    minutesRemaining: number;
    durationMinutes: number | null;
  } | null;
  isDebugSessionActive: boolean;
  isDebugSessionPending: boolean;
  onStart: (minutes: number) => void;
  onStop: () => void;
}) {
  return (
    <Card className={cn(a.card, "overflow-hidden")}>
      <CardHeader>
        <SectionPill
          label="Debug Session"
          icon={Wrench}
          className={a.pillWarning}
        />
        <CardTitle className="pt-3 text-lg font-semibold text-foreground">
          Timed debug access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={cn(a.inset, "rounded-2xl px-4 py-4")}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  className={cn(
                    isDebugSessionActive ? a.pillPositive : a.pillNeutral,
                    SOFT_BADGE_CLASS
                  )}
                >
                  {isDebugSessionActive ? "Session Active" : "Session Required"}
                </Badge>
                {debugSession?.minutesRemaining ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {debugSession.minutesRemaining} min remaining
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                Deployment flags still decide whether these tools exist. The
                session only unlocks them for the current admin.
              </p>
              {debugSession?.expiresAt ? (
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(debugSession.expiresAt).toLocaleString()}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[15, 30, 60].map(minutes => (
                <SettingsButton
                  key={minutes}
                  type="button"
                  size="sm"
                  variant={
                    debugSession?.durationMinutes === minutes &&
                    isDebugSessionActive
                      ? "default"
                      : "outline"
                  }
                  disabled={isDebugSessionPending}
                  onClick={() => onStart(minutes)}
                >
                  {minutes}m session
                </SettingsButton>
              ))}
              <SettingsButton
                type="button"
                size="sm"
                variant="ghost"
                disabled={!isDebugSessionActive || isDebugSessionPending}
                onClick={onStop}
              >
                End session
              </SettingsButton>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
