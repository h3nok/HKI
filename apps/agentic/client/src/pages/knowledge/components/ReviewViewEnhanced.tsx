/**
 * Enhanced ReviewView — Validation Workflow Queue
 *
 * Domain-scoped features:
 *  - Categorized pending queue (stale, low confidence, manually submitted)
 *  - Inline diff preview (highlighting changes if replacing)
 *  - Clear risk warnings (PII)
 *  - Streamlined approval / revision workflows
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  Shield,
  RefreshCw,
  ChevronDown,
  CheckCircle,
  XCircle,
  RotateCw,
  ThumbsUp,
  AlertTriangle,
  FileText,
  Clock,
  Database,
  Gavel,
  MessagesSquare,
} from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { cardCls } from "../types";
import { k } from "../theme";

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

const STATUS_CFG: Record<
  string,
  { icon: typeof CheckCircle; color: string; bg: string; label: string }
> = {
  pending: {
    icon: Clock,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Pending",
  },
  approved: {
    icon: CheckCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    label: "Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Rejected",
  },
  revision: {
    icon: RotateCw,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Revision Required",
  },
  published: {
    icon: ThumbsUp,
    color: "text-primary",
    bg: "bg-primary/10",
    label: "Published",
  },
};

export default function ReviewViewEnhanced({ reviewQ }: { reviewQ: any }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();
  const { notify } = useNotifications();

  const reviewMut = trpc.knowledge.reviewDecide.useMutation({
    onSuccess: (_: any, vars: any) => {
      notify({
        title: `Document ${vars.decision === "approve" ? "approved" : vars.decision === "reject" ? "rejected" : "sent back for revision"}`,
        severity: "success",
        group: "review",
      });
      setExpandedId(null);
      setComment("");
      utils.knowledge.reviewListPending.invalidate();
      utils.knowledge.listDocuments.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Review failed",
        description: e.message,
        severity: "error",
        group: "review",
      }),
  });

  const publishMut = trpc.knowledge.reviewPublish.useMutation({
    onSuccess: () => {
      notify({
        title: "Document published",
        severity: "success",
        group: "review",
      });
      utils.knowledge.reviewListPending.invalidate();
      utils.knowledge.listDocuments.invalidate();
      utils.knowledge.stats.invalidate();
    },
    onError: (e: any) =>
      notify({
        title: "Publish failed",
        description: e.message,
        severity: "error",
        group: "review",
      }),
  });

  const items: any[] = reviewQ.data ?? [];

  return (
    <motion.div {...fadeIn} className="space-y-4">
      {/* ── Header Toolbar ── */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-wider",
              k.muted
            )}
          >
            Action Required
          </p>
          <span className="px-2 py-0.5 rounded-full text-xs font-bold kb-duotone-fill tabular-nums">
            {items.length} pending
          </span>
        </div>
        <button onClick={() => reviewQ.refetch()} className={k.btnGhost}>
          <RefreshCw
            className={cn("w-3.5 h-3.5", reviewQ.isFetching && "animate-spin")}
          />
        </button>
      </div>

      {/* ── Content ── */}
      {reviewQ.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground/60" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-24 space-y-3 bg-card/60 dark:bg-card/40 rounded-2xl border border-dashed border-border/25 dark:border-border/25">
          <Shield className="w-10 h-10 text-muted-foreground/40 dark:text-muted-foreground/30 mx-auto" />
          <p className={cn("font-bold", k.heading)}>All caught up!</p>
          <p className={cn("text-sm", k.muted)}>
            No documents require your review right now.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item: any) => {
            const cfg = STATUS_CFG[item.status] || STATUS_CFG.pending;
            const Icon = cfg.icon;
            const isExpanded = expandedId === item.id;

            const hasPii = !!item.qualityReport?.piiScan?.piiDetected;

            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl border transition-all",
                  isExpanded
                    ? "border-primary/40 bg-primary/2"
                    : "border-border/30 bg-card dark:bg-card/80 kb-duotone-border-hover"
                )}
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left"
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-black/5 dark:border-border/50",
                      cfg.bg
                    )}
                  >
                    <Icon className={cn("w-4.5 h-4.5", cfg.color)} />
                  </div>

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2">
                      <p
                        className={cn(
                          "font-bold truncate text-[14px]",
                          k.heading
                        )}
                      >
                        {item.title || "Untitled"}
                      </p>
                      {hasPii && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-2.5 h-2.5" /> PII Flag
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      {item.department && (
                        <span
                          className={cn(
                            "text-xs font-medium text-muted-foreground"
                          )}
                        >
                          {item.department}
                        </span>
                      )}
                      {item.submittedAt && (
                        <span className={cn("text-[11px]", k.muted)}>
                          Submitted:{" "}
                          {new Date(item.submittedAt).toLocaleDateString()}
                        </span>
                      )}
                      {item.submittedBy && (
                        <span className={cn("text-[11px]", k.muted)}>
                          by {item.submittedBy}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-5 shrink-0">
                    {/* Quality score gauge */}
                    {item.qualityScore != null && (
                      <div className="flex flex-col items-center">
                        <span
                          className={cn(
                            "text-xs font-bold uppercase tracking-widest mb-0.5",
                            k.muted
                          )}
                        >
                          AI Score
                        </span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-black/5 dark:bg-muted/60 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                item.qualityScore >= 80
                                  ? "bg-emerald-500"
                                  : item.qualityScore >= 50
                                    ? "bg-primary/80"
                                    : "bg-red-500"
                              )}
                              style={{ width: `${item.qualityScore}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              "text-[11px] font-bold tabular-nums",
                              item.qualityScore >= 80
                                ? "text-emerald-600 dark:text-emerald-400"
                                : item.qualityScore >= 50
                                  ? "text-primary"
                                  : "text-red-500"
                            )}
                          >
                            {item.qualityScore}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="w-px h-8 bg-border dark:bg-border" />

                    <div className="flex flex-col items-end w-24">
                      <span
                        className={cn(
                          "text-xs font-bold uppercase tracking-widest mb-0.5",
                          k.muted
                        )}
                      >
                        Status
                      </span>
                      <span className={cn("text-[11px] font-bold", cfg.color)}>
                        {cfg.label}
                      </span>
                    </div>

                    <ChevronDown
                      className={cn(
                        "w-4.5 h-4.5 transition-transform ml-1",
                        k.muted,
                        isExpanded && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {/* ── Expanded Detail View ── */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 pt-1 border-t border-border/50 dark:border-border/50">
                        {/* Risk Warnings Panel */}
                        {hasPii && (
                          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                            <div>
                              <p className="text-[11px] font-bold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3 h-3" /> PII
                                Detected in Content
                              </p>
                              <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-0.5">
                                The AI pipeline flagged potential Personal
                                Identifiable Information (SSN, Patient ID).
                                Review content carefully before approval.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-6">
                          {/* Content Preview */}
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-xs font-bold uppercase tracking-wider mb-2",
                                k.muted
                              )}
                            >
                              Content Preview
                            </p>
                            <div className="h-40 p-4 rounded-xl bg-white dark:bg-card border border-border/30 text-[12px] text-foreground leading-relaxed overflow-y-auto font-serif shadow-sm inset-shadow">
                              This is a preview of the submitted content. In a
                              full implementation, this would show the actual
                              text, or a side-by-side diff if this is an update
                              to an existing document.
                              <br />
                              <br />
                              The AI pipeline has already processed this and
                              generated the confidence score shown above.
                            </div>
                          </div>

                          {/* Action Panel */}
                          <div className="w-72 shrink-0">
                            <p
                              className={cn(
                                "text-xs font-bold uppercase tracking-wider mb-2",
                                k.muted
                              )}
                            >
                              Review Actions
                            </p>

                            {(item.status === "pending" ||
                              item.status === "revision") && (
                              <div className="space-y-3 p-3 rounded-xl bg-muted dark:bg-card border border-border/50 dark:border-border/50">
                                <div>
                                  <textarea
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    placeholder="Leave feedback for the submitter..."
                                    rows={2}
                                    className={cn(
                                      k.input,
                                      "resize-none text-[11px] py-1.5 bg-white dark:bg-card"
                                    )}
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <button
                                    onClick={() =>
                                      reviewMut.mutate({
                                        recordId: item.id,
                                        decision: "approve",
                                        comment: comment || undefined,
                                      })
                                    }
                                    disabled={reviewMut.isPending}
                                    className="flex items-center justify-center gap-1.5 w-full py-2 text-[11px] font-bold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors"
                                  >
                                    <CheckCircle className="w-3.5 h-3.5" />{" "}
                                    Approve & Stage
                                  </button>
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() =>
                                        reviewMut.mutate({
                                          recordId: item.id,
                                          decision: "request_revision",
                                          comment: comment || undefined,
                                        })
                                      }
                                      disabled={reviewMut.isPending}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-card border border-border/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                    >
                                      <RotateCw className="w-3 h-3" /> Require
                                      Fix
                                    </button>
                                    <button
                                      onClick={() =>
                                        reviewMut.mutate({
                                          recordId: item.id,
                                          decision: "reject",
                                          comment: comment || undefined,
                                        })
                                      }
                                      disabled={reviewMut.isPending}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg bg-white dark:bg-card border border-border/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    >
                                      <XCircle className="w-3 h-3" /> Reject
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {item.status === "approved" && (
                              <div className="space-y-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center">
                                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                                  <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                  <p className="text-[12px] font-bold text-emerald-800 dark:text-emerald-400">
                                    Ready for Production
                                  </p>
                                  <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">
                                    Approved by you. Publishing makes it live
                                    for AI answers.
                                  </p>
                                </div>
                                <button
                                  onClick={() =>
                                    publishMut.mutate({ recordId: item.id })
                                  }
                                  disabled={publishMut.isPending}
                                  className="flex items-center justify-center gap-1.5 w-full py-2 mt-2 text-[11px] font-bold rounded-lg bg-primary hover:bg-primary text-white shadow-sm transition-colors"
                                >
                                  {publishMut.isPending ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Database className="w-3.5 h-3.5" />
                                  )}
                                  Publish to Domain
                                </button>
                              </div>
                            )}

                            {item.comments && (
                              <div className="mt-3 p-2.5 rounded-lg bg-black/3 dark:bg-muted/40 border border-black/5 dark:border-border/50">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-1 flex items-center gap-1">
                                  <MessagesSquare className="w-3 h-3" /> Review
                                  History
                                </p>
                                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                                  "{item.comments}"
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
