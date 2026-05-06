/**
 * Knowledge Sidebar Widgets — Stats pills & Gamification mini-widget.
 *
 * Extracted from index.tsx for single-responsibility modularity.
 */

import { Activity, FileText, Hash } from "lucide-react";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useKB } from "../context/KnowledgeContext";
import { k } from "../theme";

// ── Mini stats pills in sidebar ──────────────────────────────────────────────

export function KnowledgeStatsPills() {
  const { selectedStream } = useKB();
  const scopedInput = selectedStream
    ? { valueStreamId: selectedStream }
    : undefined;
  const statsQ = trpc.knowledge.stats.useQuery(scopedInput, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const docCount = statsQ.data?.totalDocuments ?? 0;
  const chunkCount = statsQ.data?.totalChunks ?? 0;

  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        {
          label: "Docs",
          value: docCount,
          icon: FileText,
          color: "text-primary",
        },
        {
          label: "Chunks",
          value: chunkCount,
          icon: Hash,
          color: "text-violet-500",
        },
      ].map(s => (
        <div
          key={s.label}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-muted"
        >
          <s.icon className={cn("w-3 h-3", s.color)} />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground tabular-nums leading-none">
              {statsQ.isLoading ? "\u2014" : s.value}
            </p>
            <p className={cn(k.label, "leading-none mt-0.5")}>{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Gamification mini-widget in sidebar ──────────────────────────────────────

export function GamificationWidget() {
  const profileQ = trpc.gamification.getProfile.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const profile = profileQ.data;
  if (!profile || profileQ.isLoading) return null;

  const streak = profile.streak.current;
  const multiplier = profile.streak.multiplier;

  return (
    <div className="px-4 py-1.5">
      <div className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-2">
        {/* Streak */}
        <div className="flex items-center gap-1.5">
          {streak > 0 ? (
            <>
              <Activity className="h-3.5 w-3.5 text-primary" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground tabular-nums leading-none">
                  {streak}d
                </p>
                <p className={cn(k.label, "leading-none mt-0.5")}>Streak</p>
              </div>
            </>
          ) : (
            <>
              <Activity className="h-3.5 w-3.5 text-muted-foreground/45" />
              <p className="text-xs text-muted-foreground">Start a streak!</p>
            </>
          )}
        </div>

        {/* Multiplier */}
        {multiplier > 1 && (
          <span className="px-1.5 py-0.5 text-xs font-bold rounded-md bg-primary/10 text-primary tabular-nums">
            {multiplier}×
          </span>
        )}

        {/* Points */}
        <div className="text-right min-w-0">
          <p className="text-xs font-bold text-primary tabular-nums leading-none">
            {profile.totalPoints.toLocaleString()}
          </p>
          <p className={cn(k.label, "leading-none mt-0.5")}>Points</p>
        </div>
      </div>
    </div>
  );
}
