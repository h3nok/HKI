/**
 * Activities Tab — Pipeline jobs timeline + notification/alert history
 *
 * Two sections:
 *   1. Pipeline Activity — live job tracker with status, progress, timestamps
 *   2. Alert History — all notifications from the notification store
 *
 * Light/dark compatible. Uses k.* theme tokens.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  Bell,
  Inbox,
  FileText,
  Globe,
  Upload,
  Plug,
  Activity,
} from "lucide-react";
import { cn, useNotifications, type NotificationSeverity } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { JOB_STATUS_META } from "../types";
import { k, JOB_POLL_INTERVAL_MS, hasActiveJobs } from "../theme";
import { KBTopBar } from "./kb-primitives";
import type { ActivitySection } from "../types";
import { getAvailableActivitySections } from "../feature-gates";

const stagger = { animate: { transition: { staggerChildren: 0.04 } } };
const child = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

// ── Status filter chips ──────────────────────────────────────────────────────

type StatusFilter = "all" | "active" | "completed" | "failed";
const STATUS_FILTERS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "" },
  { key: "active", label: "Active", color: "text-blue-500" },
  { key: "completed", label: "Completed", color: "text-primary" },
  { key: "failed", label: "Failed", color: "text-red-500" },
];

// ── Severity config for alert history ────────────────────────────────────────

const SEV_META: Record<
  NotificationSeverity,
  { color: string; bg: string; label: string }
> = {
  success: {
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
    label: "Success",
  },
  info: {
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    label: "Info",
  },
  warning: {
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
    label: "Warning",
  },
  error: {
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500/10",
    label: "Error",
  },
};

// ── Source icon mapping ──────────────────────────────────────────────────────

function sourceIcon(source: string) {
  if (source?.includes("url") || source?.includes("http")) return Globe;
  if (source?.includes("drive") || source?.includes("connector")) return Plug;
  if (source?.includes("text")) return FileText;
  return Upload;
}

// ── Time formatting ──────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ActivitiesTab({
  selectedStream,
}: {
  selectedStream?: string;
}) {
  const { canView: canViewFeature } = useFeatureAccess();
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const availableSections = useMemo(
    () => getAvailableActivitySections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const [section, setSection] = useState<ActivitySection>(
    availableSections[0] ?? "pipeline"
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sevFilter, setSevFilter] = useState<NotificationSeverity | null>(null);

  useEffect(() => {
    if (!availableSections.includes(section) && availableSections[0]) {
      setSection(availableSections[0]);
    }
  }, [availableSections, section]);

  // Pipeline jobs
  const jobsQ = trpc.knowledge.listJobs.useQuery(
    selectedStream ? { limit: 50, valueStreamId: selectedStream } : undefined,
    {
      retry: false,
      enabled:
        availableSections.includes("pipeline") && Boolean(selectedStream),
      refetchInterval: query => {
        const jobs = query.state.data?.jobs;
        if (Array.isArray(jobs) && hasActiveJobs(jobs)) {
          return JOB_POLL_INTERVAL_MS;
        }

        return 15_000;
      },
      refetchOnWindowFocus: false,
    }
  );
  const allJobs = jobsQ.data?.jobs ?? [];

  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return allJobs;
    if (statusFilter === "active")
      return allJobs.filter(
        (j: any) => j.status !== "completed" && j.status !== "failed"
      );
    return allJobs.filter((j: any) => j.status === statusFilter);
  }, [allJobs, statusFilter]);

  const jobStats = useMemo(() => {
    let activeCount = 0;
    let failedCount = 0;

    for (const job of allJobs as any[]) {
      if (job.status === "failed") {
        failedCount += 1;
        continue;
      }

      if (job.status !== "completed") {
        activeCount += 1;
      }
    }

    return {
      totalCount: allJobs.length,
      activeCount,
      failedCount,
      completedCount: Math.max(allJobs.length - activeCount - failedCount, 0),
    };
  }, [allJobs]);

  // Notifications / alerts
  const { notifications, dismiss, markRead, markAllRead, dismissAll } =
    useNotifications();
  const filteredNotifs = useMemo(
    () =>
      sevFilter
        ? notifications.filter(n => n.severity === sevFilter)
        : notifications,
    [notifications, sevFilter]
  );
  const hasUnreadNotifications = useMemo(
    () => notifications.some(notification => !notification.read),
    [notifications]
  );

  const sevCounts = useMemo(() => {
    const c: Record<NotificationSeverity, number> = {
      success: 0,
      info: 0,
      warning: 0,
      error: 0,
    };
    for (const n of notifications) c[n.severity]++;
    return c;
  }, [notifications]);

  // Group jobs by date
  const jobsByDate = useMemo(() => {
    const groups: Record<string, typeof filteredJobs> = {};
    for (const job of filteredJobs) {
      const key = formatDate(
        (job as any).createdAt || new Date().toISOString()
      );
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(job);
    }
    return groups;
  }, [filteredJobs]);
  const groupedJobs = useMemo(() => Object.entries(jobsByDate), [jobsByDate]);

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="w-full space-y-5"
      data-tour="activity-feed"
    >
      {/* ── Unified top bar ── */}
      <KBTopBar
        tabs={[
          {
            key: "pipeline" as const,
            label: "⚙️ Pipeline Jobs",
            icon: Loader2,
            badge: jobStats.activeCount > 0 ? jobStats.activeCount : undefined,
          },
          {
            key: "alerts" as const,
            label: "🔔 Alert History",
            icon: Bell,
            badge: notifications.length > 0 ? notifications.length : undefined,
          },
        ].filter(item => availableSections.includes(item.key))}
        activeTab={section}
        onTabChange={setSection}
        tabsAriaLabel="Activity sections"
      />

      <AnimatePresence mode="wait">
        {section === "pipeline" ? (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* ── Stats strip ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Total Jobs",
                  value: jobStats.totalCount,
                  icon: Clock,
                  color: "text-muted-foreground",
                  bg: "bg-black/3 dark:bg-muted/40",
                },
                {
                  label: "Active",
                  value: jobStats.activeCount,
                  icon: Loader2,
                  color: "text-blue-500",
                  bg: "bg-blue-500/8",
                },
                {
                  label: "Completed",
                  value: jobStats.completedCount,
                  icon: CheckCircle,
                  color: "text-primary",
                  bg: "bg-primary/8",
                },
                {
                  label: "Failed",
                  value: jobStats.failedCount,
                  icon: AlertTriangle,
                  color:
                    jobStats.failedCount > 0
                      ? "text-red-500"
                      : "text-muted-foreground/60",
                  bg:
                    jobStats.failedCount > 0
                      ? "bg-red-500/8"
                      : "bg-black/3 dark:bg-muted/40",
                },
              ].map(s => (
                <div
                  key={s.label}
                  className={cn(k.card, "px-4 py-3 flex items-center gap-3")}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                      s.bg
                    )}
                  >
                    <s.icon className={cn("w-4 h-4", s.color)} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none">
                      {s.value}
                    </p>
                    <p className={cn("text-xs mt-0.5", k.muted)}>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Filter bar ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
                {STATUS_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                      statusFilter === f.key
                        ? "kb-duotone-fill"
                        : "text-muted-foreground hover:bg-black/3 dark:hover:bg-white/3"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => jobsQ.refetch()}
                className={cn(k.btnGhost, "gap-1")}
                disabled={jobsQ.isFetching}
              >
                <RefreshCw
                  className={cn("w-3 h-3", jobsQ.isFetching && "animate-spin")}
                />
                Refresh
              </button>
            </div>

            {/* ── Job timeline ── */}
            <div className={cn(k.card, "overflow-hidden")}>
              {filteredJobs.length === 0 ? (
                <div className="py-16 text-center">
                  <Clock className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                  <p className={cn("text-sm font-medium", k.muted)}>
                    {statusFilter !== "all"
                      ? `No ${statusFilter} jobs`
                      : "No pipeline activity yet"}
                  </p>
                  <p className={cn("text-xs mt-1", k.muted)}>
                    {statusFilter !== "all"
                      ? "Try a different filter"
                      : "Upload content on the Ingest tab to get started"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30 dark:divide-border/20">
                  {groupedJobs.map(([dateLabel, jobs]) => (
                    <div key={dateLabel}>
                      <div className="px-5 py-2 bg-muted dark:bg-card">
                        <p className={cn(k.label)}>{dateLabel}</p>
                      </div>
                      {jobs.map((job: any) => {
                        const meta =
                          JOB_STATUS_META[job.status] || JOB_STATUS_META.queued;
                        const isActive =
                          job.status !== "completed" && job.status !== "failed";
                        const isFailed = job.status === "failed";
                        const SrcIcon = sourceIcon(job.source || "");
                        return (
                          <div
                            key={job.id}
                            className={cn(
                              "flex items-center gap-3 px-5 py-3 transition-colors",
                              isFailed
                                ? "bg-red-500/3 hover:bg-red-500/6"
                                : "hover:bg-black/1.5 dark:hover:bg-white/1.5"
                            )}
                          >
                            {/* Status icon */}
                            <div
                              className={cn(
                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                isFailed
                                  ? "bg-red-500/10"
                                  : isActive
                                    ? "bg-blue-500/10"
                                    : "bg-primary/8"
                              )}
                            >
                              <meta.Icon
                                className={cn(
                                  "w-4 h-4",
                                  meta.color,
                                  isActive && "animate-spin"
                                )}
                              />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-semibold truncate text-foreground">
                                  {job.title ||
                                    job.source ||
                                    "Untitled document"}
                                </p>
                                {isActive && (
                                  <span className="shrink-0 px-1.5 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-pulse">
                                    {job.status}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <SrcIcon className="w-3 h-3 text-muted-foreground/60" />
                                <span
                                  className={cn(
                                    "text-xs",
                                    isFailed ? "text-red-500" : k.muted
                                  )}
                                >
                                  {job.status}
                                  {job.chunkCount
                                    ? ` · ${job.chunkCount} chunks`
                                    : ""}
                                  {job.error ? ` — ${job.error}` : ""}
                                </span>
                              </div>
                            </div>

                            {/* Timestamp */}
                            <div className="shrink-0 text-right">
                              <p className="text-xs tabular-nums text-muted-foreground/60">
                                {formatTime(
                                  job.createdAt || new Date().toISOString()
                                )}
                              </p>
                              <p className="text-xs tabular-nums text-muted-foreground dark:text-muted-foreground">
                                {timeAgo(
                                  job.createdAt || new Date().toISOString()
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="space-y-4"
          >
            {/* ── Alert stats + controls ── */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-muted-foreground/60" />
                <button
                  onClick={() => setSevFilter(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                    sevFilter === null
                      ? "kb-duotone-fill"
                      : "text-muted-foreground hover:bg-black/3 dark:hover:bg-white/3"
                  )}
                >
                  All ({notifications.length})
                </button>
                {(
                  [
                    "error",
                    "warning",
                    "info",
                    "success",
                  ] as NotificationSeverity[]
                ).map(
                  s =>
                    sevCounts[s] > 0 && (
                      <button
                        key={s}
                        onClick={() => setSevFilter(sevFilter === s ? null : s)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                          sevFilter === s
                            ? cn(SEV_META[s].bg, SEV_META[s].color)
                            : "text-muted-foreground hover:bg-black/3 dark:hover:bg-white/3"
                        )}
                      >
                        {SEV_META[s].label} ({sevCounts[s]})
                      </button>
                    )
                )}
              </div>
              <div className="flex items-center gap-2">
                {hasUnreadNotifications && (
                  <button
                    onClick={markAllRead}
                    className={cn(k.btnGhost, "gap-1")}
                  >
                    <CheckCircle className="w-3 h-3" /> Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={dismissAll}
                    className={cn(
                      k.btnGhost,
                      "gap-1 text-red-500 hover:text-red-600"
                    )}
                  >
                    <XCircle className="w-3 h-3" /> Clear all
                  </button>
                )}
              </div>
            </div>

            {/* ── Alert list ── */}
            <div className={cn(k.card, "overflow-hidden")}>
              {filteredNotifs.length === 0 ? (
                <div className="py-16 text-center">
                  <Inbox className="w-8 h-8 mx-auto mb-3 text-muted-foreground/30" />
                  <p className={cn("text-sm font-medium", k.muted)}>
                    {sevFilter ? "No matching alerts" : "No alerts"}
                  </p>
                  <p className={cn("text-xs mt-1", k.muted)}>
                    {sevFilter
                      ? "Try a different filter"
                      : "System alerts and notifications will appear here"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/30 dark:divide-border/20">
                  {filteredNotifs.map(n => {
                    const sev = SEV_META[n.severity];
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "flex items-start gap-3 px-5 py-3.5 transition-colors group",
                          n.read
                            ? "opacity-55 hover:opacity-75"
                            : "hover:bg-black/1.5 dark:hover:bg-white/1.5"
                        )}
                      >
                        {/* Severity icon */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                            sev.bg
                          )}
                        >
                          {n.severity === "error" ? (
                            <XCircle className={cn("w-4 h-4", sev.color)} />
                          ) : n.severity === "warning" ? (
                            <AlertTriangle
                              className={cn("w-4 h-4", sev.color)}
                            />
                          ) : n.severity === "success" ? (
                            <CheckCircle className={cn("w-4 h-4", sev.color)} />
                          ) : (
                            <Bell className={cn("w-4 h-4", sev.color)} />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p
                              className={cn(
                                "text-[13px] leading-snug",
                                n.read
                                  ? "text-muted-foreground"
                                  : "font-semibold text-foreground"
                              )}
                            >
                              {n.title}
                            </p>
                            <span className="text-xs tabular-nums text-muted-foreground/60 shrink-0 pt-0.5">
                              {timeAgo(n.timestamp)}
                            </span>
                          </div>
                          {n.description && (
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                              {n.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-bold",
                                sev.bg,
                                sev.color
                              )}
                            >
                              {sev.label}
                            </span>
                            {n.group && (
                              <span className="bg-black/3 px-1.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider text-muted-foreground/60 dark:bg-muted/40">
                                {n.group}
                              </span>
                            )}
                            <span className="text-xs tabular-nums text-muted-foreground dark:text-muted-foreground">
                              {formatTime(n.timestamp)}
                            </span>
                          </div>
                          {n.action && (
                            <button
                              onClick={() => {
                                n.action?.onClick?.();
                                markRead(n.id);
                              }}
                              className={cn(
                                k.btnSecondary,
                                "mt-1 text-xs px-2.5 py-1"
                              )}
                            >
                              {n.action.label}
                            </button>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="shrink-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={() => markRead(n.id)}
                              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5"
                              title="Mark read"
                            >
                              <CheckCircle className="w-3 h-3 text-muted-foreground/60" />
                            </button>
                          )}
                          <button
                            onClick={() => dismiss(n.id)}
                            className="p-1 rounded hover:bg-red-500/10"
                            title="Dismiss"
                          >
                            <XCircle className="w-3 h-3 text-muted-foreground/60 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
