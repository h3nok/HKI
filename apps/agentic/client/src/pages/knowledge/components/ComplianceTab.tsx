/**
 * Compliance & Audit — Attestation tracking, PII scan status,
 * review audit trail, and LLM observability.
 *
 * Data sources:
 *  - knowledge.listAttestations  → playbook attestation tracking
 *  - knowledge.reviewListAll     → review workflow audit trail
 *  - knowledge.observabilitySummary → LLM usage / error stats
 *  - knowledge.observabilityTraces  → recent LLM trace log
 */

import { useMemo, useState } from "react";
import { skipToken } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck,
  ShieldCheck,
  AlertTriangle,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Zap,
  ChevronDown,
  BarChart3,
  Users,
  ExternalLink,
} from "lucide-react";

const OBSERVABILITY_URL = import.meta.env.VITE_OBSERVABILITY_URL || "";
import { cn } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { k } from "../theme";

// ── Animation ───────────────────────────────────────────────────────────────
const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ── Types ───────────────────────────────────────────────────────────────────
interface ComplianceTabProps {
  selectedStream: string;
  streamLabel: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

export default function ComplianceTab({
  selectedStream,
  streamLabel,
}: ComplianceTabProps) {
  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  // ── Data queries ────────────────────────────────────────────────────────
  const attestationsQ = trpc.knowledge.listAttestations.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );
  const reviewQ = trpc.knowledge.reviewListAll.useQuery(
    explicitStreamId
      ? { limit: 20, valueStreamId: explicitStreamId }
      : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );
  const obsQ = trpc.knowledge.observabilitySummary.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );
  const tracesQ = trpc.knowledge.observabilityTraces.useQuery(
    explicitStreamId
      ? { limit: 20, valueStreamId: explicitStreamId }
      : skipToken,
    { retry: false, enabled: Boolean(explicitStreamId) }
  );

  const attestations = attestationsQ.data ?? [];
  const reviewRecords = reviewQ.data ?? [];
  const pendingCount = reviewRecords.filter(
    r => r.status === "pending_review"
  ).length;
  const obs = obsQ.data;
  const traces = tracesQ.data?.traces ?? [];

  // ── Derived metrics ─────────────────────────────────────────────────────
  const errorRate = obs
    ? obs.totalTraces > 0
      ? ((obs.errorCount / obs.totalTraces) * 100).toFixed(1)
      : "0.0"
    : null;

  // ── Sections ────────────────────────────────────────────────────────────
  return (
    <motion.div {...fadeIn} className="space-y-5">
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={ShieldCheck}
          label="Playbook Attestations"
          value={attestations.length}
          color="text-emerald-500"
          bg="bg-emerald-500/10"
          emoji="✅"
        />
        <SummaryCard
          icon={Clock}
          label="Pending Reviews"
          value={pendingCount}
          color="text-primary"
          bg="bg-primary/10"
          alert={pendingCount > 5}
          emoji="⏳"
        />
        <SummaryCard
          icon={Activity}
          label="LLM Operations"
          value={obs?.totalTraces ?? 0}
          color="text-blue-500"
          bg="bg-blue-500/10"
          emoji="⚡"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Error Rate"
          value={errorRate ? `${errorRate}%` : "—"}
          color={
            obs && obs.errorCount > 0 ? "text-red-500" : "text-emerald-500"
          }
          bg={obs && obs.errorCount > 0 ? "bg-red-500/10" : "bg-emerald-500/10"}
          emoji={obs && obs.errorCount > 0 ? "⚠️" : "🟢"}
        />
      </div>

      {/* ── Attestation tracking ── */}
      <AttestationSection
        attestations={attestations}
        streamLabel={streamLabel}
        isLoading={attestationsQ.isLoading}
      />

      {/* ── Review audit trail ── */}
      <ReviewAuditSection
        reviews={reviewRecords}
        isLoading={reviewQ.isLoading}
      />

      {/* ── LLM Observability ── */}
      <ObservabilitySection
        obs={obs}
        traces={traces}
        isLoading={obsQ.isLoading || tracesQ.isLoading}
      />
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY CARD
// ══════════════════════════════════════════════════════════════════════════════

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
  bg,
  alert,
  emoji,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number | string;
  color: string;
  bg: string;
  alert?: boolean;
  emoji?: string;
}) {
  return (
    <div className={cn(k.card, "p-4")}>
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
            bg,
            bg.replace("/10", "/15")
          )}
        >
          {emoji ? (
            <span className="text-base">{emoji}</span>
          ) : (
            <Icon className={cn("w-4.5 h-4.5", color)} />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-lg font-black tabular-nums leading-none text-foreground",
              alert && "text-primary"
            )}
          >
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <p className={cn(k.muted, "mt-0.5")}>{label}</p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ATTESTATION SECTION
// ══════════════════════════════════════════════════════════════════════════════

function AttestationSection({
  attestations,
  streamLabel,
  isLoading,
}: {
  attestations: any[];
  streamLabel: string;
  isLoading: boolean;
}) {
  return (
    <div className={cn(k.card, "overflow-hidden")}>
      <div className="px-5 py-3.5 flex items-center justify-between">
        <h3 className={cn(k.heading, "flex items-center gap-2")}>
          🛡️ Playbook Attestations
          <span className={cn(k.muted, "font-normal")}>
            — {streamLabel || "All domains"}
          </span>
        </h3>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 tabular-nums">
          {attestations.length} attested
        </span>
      </div>

      <div className="px-5 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Activity className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : attestations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
            <Users className="w-6 h-6 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground mb-1">
              No attestations yet
            </p>
            <p className={cn(k.muted)}>
              Team members should read and acknowledge the Agent Success
              Playbook before contributing content.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {attestations.map((a: any, i: number) => (
              <div
                key={a.userId ?? i}
                className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {a.userName || a.userEmail || `User #${a.userId}`}
                  </p>
                  {a.userEmail && a.userName && (
                    <p className={cn(k.muted, "truncate")}>{a.userEmail}</p>
                  )}
                </div>
                <span className={cn(k.muted, "shrink-0")}>
                  {timeAgo(a.attestedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REVIEW AUDIT SECTION
// ══════════════════════════════════════════════════════════════════════════════

function ReviewAuditSection({
  reviews,
  isLoading,
}: {
  reviews: any[];
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const statusIcon = (status: string) => {
    switch (status) {
      case "approved":
      case "published":
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      case "rejected":
      case "revision_requested":
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-primary" />;
    }
  };

  return (
    <div className={cn(k.card, "overflow-hidden")}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer text-left"
      >
        <h3 className={cn(k.heading, "flex items-center gap-2")}>
          📋 Review Audit Trail
          {reviews.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary tabular-nums">
              {reviews.length} pending
            </span>
          )}
        </h3>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-200",
            !expanded && "-rotate-90"
          )}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Activity className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                  <p className="text-sm font-medium text-foreground mb-1">
                    All clear
                  </p>
                  <p className={cn(k.muted)}>
                    No pending reviews. All submitted content has been
                    processed.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {reviews.map((r: any) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      {statusIcon(r.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {r.title || `Document ${r.documentId?.slice(0, 8)}`}
                        </p>
                        <p className={cn(k.muted)}>
                          {r.department || "General"} ·{" "}
                          <span className="capitalize">
                            {r.status?.replace(/_/g, " ")}
                          </span>
                          {r.submittedBy ? ` by ${r.submittedBy}` : ""}
                        </p>
                      </div>
                      <span className={cn(k.muted, "shrink-0")}>
                        {timeAgo(r.submittedAt || r.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// OBSERVABILITY SECTION
// ══════════════════════════════════════════════════════════════════════════════

function ObservabilitySection({
  obs,
  traces,
  isLoading,
}: {
  obs: any;
  traces: any[];
  isLoading: boolean;
}) {
  const [showTraces, setShowTraces] = useState(false);

  const operationEntries = useMemo(() => {
    if (!obs?.operations) return [];
    return Object.entries(obs.operations as Record<string, number>).sort(
      (a, b) => b[1] - a[1]
    );
  }, [obs]);

  return (
    <div className={cn(k.card, "overflow-hidden")}>
      <div className="px-5 py-3.5 flex items-center justify-between">
        <h3 className={cn(k.heading, "flex items-center gap-2")}>
          📊 LLM Observability
        </h3>
        <div className="flex items-center gap-2">
          <a
            href={OBSERVABILITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-primary kb-duotone-bg-hover transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open Cloud Observability
          </a>
          {traces.length > 0 && (
            <button
              onClick={() => setShowTraces(t => !t)}
              className={cn(
                "text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors",
                showTraces
                  ? "kb-duotone-fill"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <Eye className="w-3 h-3 inline mr-1" />
              {showTraces ? "Hide Traces" : "View Traces"}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Activity className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : !obs ? (
          <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
            <BarChart3 className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground mb-1">
              No observability data
            </p>
            <p className={cn(k.muted)}>
              LLM operation traces will appear here as the system processes
              queries.
            </p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MiniStat
                label="Avg Latency"
                value={formatDuration(obs.avgDurationMs ?? 0)}
              />
              <MiniStat
                label="P95 Latency"
                value={formatDuration(obs.p95DurationMs ?? 0)}
              />
              <MiniStat
                label="Input Tokens"
                value={(obs.totalInputTokens ?? 0).toLocaleString()}
              />
              <MiniStat
                label="Output Tokens"
                value={(obs.totalOutputTokens ?? 0).toLocaleString()}
              />
            </div>

            {/* Operation breakdown */}
            {operationEntries.length > 0 && (
              <div>
                <p className={cn("text-xs font-semibold mb-2 text-foreground")}>
                  Operations by type
                </p>
                <div className="space-y-1.5">
                  {operationEntries.map(([op, count]) => {
                    const pct =
                      obs.totalTraces > 0 ? (count / obs.totalTraces) * 100 : 0;
                    return (
                      <div key={op} className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground w-28 truncate capitalize">
                          {op.replace(/_/g, " ")}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all"
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span
                          className={cn(
                            k.muted,
                            "tabular-nums w-10 text-right"
                          )}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Trace log */}
            <AnimatePresence>
              {showTraces && traces.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <p
                    className={cn("text-xs font-semibold mb-2 text-foreground")}
                  >
                    Recent Traces
                  </p>
                  <div className="space-y-1 max-h-72 overflow-y-auto">
                    {traces.map((t: any) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        {t.status === "error" ? (
                          <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate capitalize">
                            {t.operation?.replace(/_/g, " ") || "unknown"}
                          </p>
                          {t.error && (
                            <p className="text-xs text-red-500 truncate">
                              {t.error}
                            </p>
                          )}
                        </div>
                        <span className={cn(k.muted, "tabular-nums shrink-0")}>
                          {formatDuration(t.durationMs ?? 0)}
                        </span>
                        <span className={cn(k.muted, "shrink-0")}>
                          {timeAgo(t.timestamp)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ── Mini stat ───────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-2.5 rounded-xl bg-muted/30 border border-border/50">
      <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      <p className={cn(k.muted)}>{label}</p>
    </div>
  );
}
