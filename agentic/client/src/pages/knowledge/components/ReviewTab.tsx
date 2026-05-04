import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { motion } from "framer-motion";
import { cn, useNotifications, Button } from "@hki/ui";
import { RefreshCw } from "lucide-react";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { trpc } from "@/lib/trpc";
import type {
  QualityReport,
  ReviewDecision,
  ReviewRecord,
  ShadowRetrievalComparison,
} from "@shared/knowledge-types";
import {
  type DetailView,
  getDefaultQueueView,
  getQueueViewForRecord,
  type QueueView,
} from "./review/review-model";
import {
  ReviewActionPanel,
  ReviewDetailPanel,
  ReviewErrorCard,
  ReviewLoadingCard,
  ReviewQueuePanel,
  ReviewSelectionCard,
} from "./review/review-ui";
import { KBInfoBanner } from "./kb-primitives";

interface ReviewTabProps {
  selectedStream?: string;
  streamLabel?: string;
}

function normalizeShadowQueryText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function buildShadowProbeQuery(
  record: ReviewRecord,
  content?: string | null
): string {
  const title = normalizeShadowQueryText(record.title);
  const normalizedContent = normalizeShadowQueryText(content);
  const sentenceBreak = normalizedContent.search(/[.!?]/);
  const excerpt = normalizedContent
    ? sentenceBreak >= 0
      ? normalizedContent.slice(0, sentenceBreak + 1)
      : normalizedContent.slice(0, 180)
    : "";
  const fallbackTags = record.tags.slice(0, 2).join(" ");
  const query = [title, excerpt || fallbackTags]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (query.length <= 220) {
    return query;
  }

  return `${query.slice(0, 217).trim()}...`;
}

export default function ReviewTab({
  selectedStream,
  streamLabel,
}: ReviewTabProps) {
  const { canView: canViewFeature } = useFeatureAccess();
  const showReviewAssignments = canViewFeature(
    "release.knowledge.govern.reviewAssignments"
  );
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(
    null
  );
  const [decisionComment, setDecisionComment] = useState("");
  const [qualityReport, setQualityReport] = useState<QualityReport | null>(
    null
  );
  const [reminderMessage, setReminderMessage] = useState("");
  const [assigneeInput, setAssigneeInput] = useState("");
  const [showAssignInput, setShowAssignInput] = useState(false);
  const [queueView, setQueueView] = useState<QueueView>("pending_review");
  const [detailView, setDetailView] = useState<DetailView>("overview");
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [isBulkActing, setIsBulkActing] = useState(false);
  const [shadowComparison, setShadowComparison] =
    useState<ShadowRetrievalComparison | null>(null);
  const [shadowQuery, setShadowQuery] = useState("");

  const utils = trpc.useUtils();
  const { notify } = useNotifications();

  const resolveReviewScope = useCallback(
    (streamId?: string | null) => {
      const candidate = streamId?.trim() || selectedStream?.trim() || "";
      return candidate && candidate !== "global" ? candidate : undefined;
    },
    [selectedStream]
  );
  const selectedReviewScope = resolveReviewScope();
  const detailReviewScope = resolveReviewScope(selectedRecord?.streamId);

  useEffect(() => {
    if (showReviewAssignments) return;
    setReminderMessage("");
    setAssigneeInput("");
    setShowAssignInput(false);
  }, [showReviewAssignments]);

  const invalidateReviewSurface = () => {
    void utils.knowledge.listDocuments.invalidate();
    void utils.knowledge.reviewListPending.invalidate();
    void utils.knowledge.reviewListAll.invalidate();
    void utils.knowledge.reviewGet.invalidate();
  };

  const pendingQ = trpc.knowledge.reviewListPending.useQuery(
    selectedReviewScope
      ? { limit: 100, valueStreamId: selectedReviewScope }
      : { limit: 100 },
    {
      retry: false,
      enabled: Boolean(selectedReviewScope),
    }
  );

  const historyQ = trpc.knowledge.reviewListAll.useQuery(
    selectedReviewScope
      ? { limit: 100, valueStreamId: selectedReviewScope }
      : { limit: 100 },
    {
      retry: false,
      enabled: Boolean(selectedReviewScope),
    }
  );

  const recordDetailQ = trpc.knowledge.reviewGet.useQuery(
    {
      recordId: selectedRecord?.id ?? "",
      valueStreamId: detailReviewScope,
    },
    {
      enabled: !!selectedRecord?.id && !!detailReviewScope,
      retry: false,
    }
  );

  const detail = recordDetailQ.data as ReviewRecord | undefined;

  const docContentQ = trpc.knowledge.getDocumentContent.useQuery(
    {
      documentId: detail?.documentId ?? "",
      valueStreamId: detailReviewScope,
    },
    {
      enabled: !!detail?.documentId && !!detailReviewScope,
      retry: false,
    }
  );

  // Managed stream members for the assign dropdown
  const membersQ = trpc.admin.listManagedUsers.useQuery(
    selectedStream && selectedStream !== "global"
      ? { valueStreamId: selectedStream }
      : undefined,
    {
      retry: false,
      enabled:
        showReviewAssignments &&
        !!selectedStream &&
        selectedStream !== "global",
    }
  );
  const teamMembers = useMemo(() => {
    const members = membersQ.data?.users ?? [];
    return members
      .filter(member => Boolean(member.email) && Boolean(member.isActive))
      .map(member => ({
        name: member.name?.trim() || undefined,
        email: member.email ?? "",
        role: member.role,
      }));
  }, [membersQ.data?.users]);

  const decideMut = trpc.knowledge.reviewDecide.useMutation({
    onSuccess: record => {
      notify({
        title: `Decision applied: ${record.status}`,
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setQueueView(getQueueViewForRecord(record));
      setDetailView("overview");
      setDecisionComment("");
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Review failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const publishMut = trpc.knowledge.reviewPublish.useMutation({
    onSuccess: record => {
      notify({
        title: "Document published",
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setQueueView(getQueueViewForRecord(record));
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Publish failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const archiveMut = trpc.knowledge.reviewArchive.useMutation({
    onSuccess: record => {
      notify({
        title: "Document archived",
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Archive failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const resubmitMut = trpc.knowledge.reviewResubmit.useMutation({
    onSuccess: record => {
      notify({
        title: "Document resubmitted for review",
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setQueueView(getQueueViewForRecord(record));
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Resubmit failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const claimMut = trpc.knowledge.reviewClaim.useMutation({
    onSuccess: record => {
      notify({
        title: "Claimed — this item is now assigned to you",
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setReminderMessage("");
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Claim failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const assignMut = trpc.knowledge.reviewAssign.useMutation({
    onSuccess: record => {
      notify({
        title: `Assigned to ${record.assignedTo}`,
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setAssigneeInput("");
      setReminderMessage("");
      setShowAssignInput(false);
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Assign failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const remindMut = trpc.knowledge.reviewRemind.useMutation({
    onSuccess: record => {
      notify({
        title: record.assignedTo
          ? `Reminder recorded for ${record.assignedTo}`
          : "Reminder recorded",
        severity: "success",
        group: "review",
      });
      setSelectedRecord(record);
      setDetailView("overview");
      setReminderMessage("");
      invalidateReviewSurface();
    },
    onError: error =>
      notify({
        title: "Reminder failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const qualityScoreMut = trpc.knowledge.qualityScore.useMutation({
    onSuccess: report => {
      setQualityReport(report);
      notify({
        title: "Quality check complete",
        severity: "success",
        group: "review",
      });
    },
    onError: error =>
      notify({
        title: "Quality check failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const shadowCompareMut = trpc.knowledge.compareShadowRetrieval.useMutation({
    onSuccess: comparison => {
      setShadowComparison(comparison);
      setDetailView("checks");
      notify({
        title: "Shadow comparison ready",
        severity: "success",
        group: "review",
      });
    },
    onError: error =>
      notify({
        title: "Shadow comparison failed",
        description: error.message,
        severity: "error",
        group: "review",
      }),
  });

  const pending = useMemo(
    () =>
      ((pendingQ.data ?? []) as ReviewRecord[]).filter(
        record =>
          !selectedStream ||
          !record.streamId ||
          record.streamId === selectedStream
      ),
    [pendingQ.data, selectedStream]
  );

  const historyRecords = useMemo(
    () =>
      ((historyQ.data ?? []) as ReviewRecord[]).filter(
        record =>
          !selectedStream ||
          !record.streamId ||
          record.streamId === selectedStream
      ),
    [historyQ.data, selectedStream]
  );

  const approved = useMemo(
    () => historyRecords.filter(record => record.status === "approved"),
    [historyRecords]
  );

  const needsChanges = useMemo(
    () =>
      historyRecords.filter(
        record =>
          record.status === "revision_requested" || record.status === "rejected"
      ),
    [historyRecords]
  );

  const publishedRecords = useMemo(
    () => historyRecords.filter(record => record.status === "published"),
    [historyRecords]
  );

  const allRecords = useMemo(() => {
    const deduped = new Map<string, ReviewRecord>();
    for (const record of [
      ...pending,
      ...approved,
      ...needsChanges,
      ...publishedRecords,
    ]) {
      deduped.set(record.id, record);
    }
    return Array.from(deduped.values());
  }, [approved, needsChanges, pending, publishedRecords]);

  const queueIsLoading =
    queueView === "pending_review" ? pendingQ.isLoading : historyQ.isLoading;
  const queueErrorMessage =
    queueView === "pending_review"
      ? pendingQ.error?.message
      : historyQ.error?.message;

  const isQueueRefreshing =
    queueView === "pending_review" ? pendingQ.isFetching : historyQ.isFetching;

  const queueCounts = useMemo(
    () => ({
      pending_review: pending.length,
      approved: approved.length,
      needs_changes: needsChanges.length,
      published: publishedRecords.length,
    }),
    [
      approved.length,
      needsChanges.length,
      pending.length,
      publishedRecords.length,
    ]
  );

  const recordsByView = useMemo(
    () => ({
      pending_review: pending,
      approved,
      needs_changes: needsChanges,
      published: publishedRecords.slice(0, 8),
    }),
    [approved, needsChanges, pending, publishedRecords]
  );

  useEffect(() => {
    const nextDefault = getDefaultQueueView(recordsByView);
    if (queueCounts[queueView] === 0 && nextDefault !== queueView) {
      setQueueView(nextDefault);
    }
  }, [queueCounts, queueView, recordsByView]);

  useEffect(() => {
    if (
      selectedRecord &&
      (isQueueRefreshing ||
        allRecords.some(record => record.id === selectedRecord.id))
    ) {
      return;
    }

    const fallbackRecord = recordsByView[queueView][0] ?? allRecords[0] ?? null;

    if (fallbackRecord?.id !== selectedRecord?.id) {
      setSelectedRecord(fallbackRecord);
    }
  }, [
    allRecords,
    isQueueRefreshing,
    queueView,
    recordsByView,
    selectedRecord?.id,
  ]);

  useEffect(() => {
    setDecisionComment("");
    setQualityReport(null);
    setReminderMessage("");
    setAssigneeInput("");
    setShowAssignInput(false);
    setShadowComparison(null);
    setShadowQuery("");
  }, [selectedRecord?.id]);

  const displayedQualityReport = qualityReport ?? detail?.qualityReport ?? null;
  const showPersistedQualityNote = Boolean(
    detail?.qualityReport && !qualityReport
  );
  const canManageOwnership =
    showReviewAssignments &&
    (detail?.status === "pending_review" || detail?.status === "approved");

  const isActing =
    decideMut.isPending ||
    publishMut.isPending ||
    archiveMut.isPending ||
    resubmitMut.isPending;

  const actionError =
    decideMut.error?.message ??
    publishMut.error?.message ??
    archiveMut.error?.message ??
    resubmitMut.error?.message ??
    null;

  const handleSelectRecord = (record: ReviewRecord) => {
    setSelectedRecord(record);
    setDetailView("overview");
  };

  const handleDecision = (decision: ReviewDecision) => {
    if (!detail) return;

    decideMut.mutate({
      recordId: detail.id,
      valueStreamId: resolveReviewScope(detail.streamId),
      decision,
      comment: decisionComment.trim() || undefined,
    });
  };

  const handleAssignSubmit = () => {
    if (!detail) return;

    const assignee = assigneeInput.trim();
    if (!assignee) return;

    assignMut.mutate({
      recordId: detail.id,
      valueStreamId: resolveReviewScope(detail.streamId),
      assignee,
    });
  };

  const handleAssignPick = (assignee: string) => {
    if (!detail) return;

    setAssigneeInput(assignee);
    assignMut.mutate({
      recordId: detail.id,
      valueStreamId: resolveReviewScope(detail.streamId),
      assignee,
    });
  };

  const handleAssignKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleAssignSubmit();
    }
  };

  const handleQualityCheck = () => {
    if (!detail) return;

    const content =
      ((docContentQ.data as { content?: string } | undefined)?.content ?? "") ||
      detail.title ||
      "";

    if (!content) {
      notify({
        title: "No document content available for a fresh check",
        severity: "warning",
        group: "review",
      });
      return;
    }

    qualityScoreMut.mutate({
      text: content,
      title: detail.title,
    });
  };

  const handleShadowCompare = () => {
    if (!detail) return;

    const content =
      ((docContentQ.data as { content?: string } | undefined)?.content ?? "") ||
      "";
    const query = buildShadowProbeQuery(detail, content);

    if (!query) {
      notify({
        title: "No content available for a shadow comparison",
        description:
          "Add a title or document content before running this check.",
        severity: "warning",
        group: "review",
      });
      return;
    }

    setShadowQuery(query);
    shadowCompareMut.mutate({
      query,
      valueStreamId: resolveReviewScope(detail.streamId),
      selectedDocumentId: detail.documentId,
      limit: 5,
      mode: "hybrid",
    });
  };

  const refreshReviewSurface = () => {
    void pendingQ.refetch();
    void historyQ.refetch();
    if (selectedRecord?.id) {
      void recordDetailQ.refetch();
    }
  };

  // ── Bulk actions ──
  const toggleBulkSelect = useCallback((id: string) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const current = recordsByView[queueView];
    if (bulkSelected.size === current.length) {
      setBulkSelected(new Set());
    } else {
      setBulkSelected(new Set(current.map(r => r.id)));
    }
  }, [queueView, recordsByView, bulkSelected.size]);

  const handleBulkAction = useCallback(
    async (action: "approve" | "reject" | "publish") => {
      if (bulkSelected.size === 0) return;
      setIsBulkActing(true);
      let successes = 0;
      let failures = 0;

      for (const id of Array.from(bulkSelected)) {
        try {
          if (action === "approve") {
            await decideMut.mutateAsync({
              recordId: id,
              valueStreamId: resolveReviewScope(
                recordsByView[queueView].find(record => record.id === id)
                  ?.streamId
              ),
              decision: "approve" as ReviewDecision,
            });
          } else if (action === "reject") {
            await decideMut.mutateAsync({
              recordId: id,
              valueStreamId: resolveReviewScope(
                recordsByView[queueView].find(record => record.id === id)
                  ?.streamId
              ),
              decision: "reject" as ReviewDecision,
            });
          } else if (action === "publish") {
            await publishMut.mutateAsync({
              recordId: id,
              valueStreamId: resolveReviewScope(
                recordsByView[queueView].find(record => record.id === id)
                  ?.streamId
              ),
            });
          }
          successes++;
        } catch {
          failures++;
        }
      }

      setIsBulkActing(false);
      setBulkSelected(new Set());
      invalidateReviewSurface();
      notify({
        title: `${successes} item${successes !== 1 ? "s" : ""} ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "published"}${failures > 0 ? `, ${failures} failed` : ""}`,
        severity: failures > 0 ? "warning" : "success",
        group: "review",
      });
    },
    [
      bulkSelected,
      decideMut,
      invalidateReviewSurface,
      notify,
      publishMut,
      queueView,
      recordsByView,
      resolveReviewScope,
    ]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="space-y-5"
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <ReviewQueuePanel
          queueView={queueView}
          onQueueViewChange={v => {
            setQueueView(v);
            setBulkSelected(new Set());
          }}
          recordsByView={recordsByView}
          queueCounts={queueCounts}
          selectedRecordId={selectedRecord?.id}
          onSelectRecord={handleSelectRecord}
          isLoading={queueIsLoading}
          errorMessage={queueErrorMessage}
          onRetry={refreshReviewSurface}
          bulkSelected={bulkSelected}
          onToggleBulkSelect={toggleBulkSelect}
          onToggleSelectAll={toggleSelectAll}
          onBulkAction={handleBulkAction}
          isBulkActing={isBulkActing}
        />

        <div className="space-y-4">
          {selectedRecord && recordDetailQ.isLoading ? (
            <ReviewLoadingCard />
          ) : recordDetailQ.error ? (
            <ReviewErrorCard
              title="Could not load this review item"
              description={recordDetailQ.error.message}
              actionLabel="Reload item"
              onRetry={() => void recordDetailQ.refetch()}
            />
          ) : detail ? (
            <>
              <ReviewDetailPanel
                detail={detail}
                detailView={detailView}
                onDetailViewChange={setDetailView}
                displayedQualityReport={displayedQualityReport}
                showPersistedQualityNote={showPersistedQualityNote}
                isQualityLoading={
                  qualityScoreMut.isPending || docContentQ.isLoading
                }
                canManageOwnership={canManageOwnership}
                isAssigning={claimMut.isPending || assignMut.isPending}
                isReminding={remindMut.isPending}
                reminderMessage={reminderMessage}
                showAssignInput={showAssignInput}
                assigneeInput={assigneeInput}
                teamMembers={teamMembers}
                shadowComparison={shadowComparison}
                shadowQuery={shadowQuery}
                isShadowComparing={shadowCompareMut.isPending}
                shadowCompareError={shadowCompareMut.error?.message ?? null}
                onToggleAssignInput={() => setShowAssignInput(value => !value)}
                onReminderMessageChange={setReminderMessage}
                onAssigneeInputChange={setAssigneeInput}
                onAssigneePick={handleAssignPick}
                onAssigneeKeyDown={handleAssignKeyDown}
                onAssigneeSubmit={handleAssignSubmit}
                onClaim={() =>
                  claimMut.mutate({
                    recordId: detail.id,
                    valueStreamId: resolveReviewScope(detail.streamId),
                  })
                }
                onRemind={() =>
                  remindMut.mutate({
                    recordId: detail.id,
                    valueStreamId: resolveReviewScope(detail.streamId),
                    message: reminderMessage.trim() || undefined,
                  })
                }
                onRunQualityCheck={handleQualityCheck}
                onRunShadowCompare={handleShadowCompare}
              />

              <ReviewActionPanel
                detail={detail}
                decisionComment={decisionComment}
                onDecisionCommentChange={setDecisionComment}
                onApprove={() => handleDecision("approve")}
                onRequestChanges={() => handleDecision("request_revision")}
                onReject={() => handleDecision("reject")}
                onPublish={() =>
                  publishMut.mutate({
                    recordId: detail.id,
                    valueStreamId: resolveReviewScope(detail.streamId),
                  })
                }
                onArchive={() =>
                  archiveMut.mutate({
                    recordId: detail.id,
                    valueStreamId: resolveReviewScope(detail.streamId),
                  })
                }
                onResubmit={() =>
                  resubmitMut.mutate({
                    recordId: detail.id,
                    valueStreamId: resolveReviewScope(detail.streamId),
                  })
                }
                isActing={isActing}
                isDeciding={decideMut.isPending}
                isPublishing={publishMut.isPending}
                isArchiving={archiveMut.isPending}
                isResubmitting={resubmitMut.isPending}
                actionError={actionError}
              />
            </>
          ) : (
            <ReviewSelectionCard />
          )}
        </div>
      </div>
    </motion.div>
  );
}
