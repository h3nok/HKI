import type { KeyboardEvent, ReactNode } from "react";
import {
  AlertCircle,
  Archive,
  BellRing,
  CheckCircle,
  CheckSquare,
  ClipboardCheck,
  Info,
  Loader2,
  MessageSquare,
  RotateCcw,
  Send,
  Shield,
  Square,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  cn,
  HermeticCard,
  HermeticEmptyState,
  Input,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@hki/ui";
import type {
  QualityReport,
  ReviewRecord,
  ShadowRetrievalComparison,
} from "@shared/knowledge-types";
import QualityReportCard from "../validation/QualityReportCard";
import ShadowRetrievalPanel from "../ShadowRetrievalPanel";
import { k } from "../../theme";
import {
  buildDetailMeta,
  type DetailView,
  formatDateTime,
  formatRecordMeta,
  getQueueViewForRecord,
  QUEUE_VIEW_META,
  type QueueView,
  type ReviewDetailMetaField,
  type ReviewQueueCounts,
  STATUS_META,
} from "./review-model";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const Icon = meta.icon;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] shadow-none",
        meta.color,
        meta.bg,
        meta.border,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

function MetaField({ label, value }: ReviewDetailMetaField) {
  return (
    <div className="rounded-lg bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

interface QueueItemCardProps {
  record: ReviewRecord;
  selected: boolean;
  bulkChecked: boolean;
  showBulkCheckbox: boolean;
  onSelect: (record: ReviewRecord) => void;
  onToggleBulk: (id: string) => void;
}

function QueueItemCard({
  record,
  selected,
  bulkChecked,
  showBulkCheckbox,
  onSelect,
  onToggleBulk,
}: QueueItemCardProps) {
  const statusMeta = STATUS_META[record.status] ?? STATUS_META.draft;
  const reviewIntelligence = record.reviewIntelligence ?? null;
  const duplicateCount = reviewIntelligence?.duplicates.length ?? 0;
  const contradictionCount = reviewIntelligence?.contradictions.length ?? 0;

  return (
    <div className="flex items-start gap-1.5">
      {showBulkCheckbox && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onToggleBulk(record.id);
          }}
          className="mt-2.5 shrink-0 text-muted-foreground kb-duotone-text-hover transition-colors"
          aria-label={bulkChecked ? "Deselect" : "Select"}
        >
          {bulkChecked ? (
            <CheckSquare className="h-4 w-4 text-primary" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(record)}
        className={cn(
          "group w-full rounded-xl border px-3 py-2.5 text-left transition-all",
          selected
            ? "border-primary/25 bg-primary/5 ring-1 ring-primary/15 dark:bg-primary/10"
            : "border-border/30 bg-card hover:bg-muted/40 hover:border-border/50"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className={cn(
                "mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                statusMeta.bg,
                statusMeta.border
              )}
            >
              <statusMeta.icon
                className={cn("h-3.5 w-3.5", statusMeta.color)}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {record.title || "Untitled document"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatRecordMeta(record)}
              </p>
              {duplicateCount > 0 || contradictionCount > 0 ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {duplicateCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-primary/25 bg-primary/8 px-2 py-0.5 text-[11px] text-primary dark:text-primary"
                    >
                      {duplicateCount} duplicate
                      {duplicateCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {contradictionCount > 0 ? (
                    <Badge
                      variant="outline"
                      className="rounded-full border-red-500/25 bg-red-500/8 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300"
                    >
                      {contradictionCount} contradiction
                      {contradictionCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <StatusBadge status={record.status} className="shrink-0" />
        </div>
      </button>
    </div>
  );
}

interface ReviewQueuePanelProps {
  queueView: QueueView;
  onQueueViewChange: (view: QueueView) => void;
  recordsByView: Record<QueueView, ReviewRecord[]>;
  queueCounts: ReviewQueueCounts;
  selectedRecordId?: string | null;
  onSelectRecord: (record: ReviewRecord) => void;
  isLoading: boolean;
  errorMessage?: string;
  onRetry: () => void;
  bulkSelected?: Set<string>;
  onToggleBulkSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
  onBulkAction?: (action: "approve" | "reject" | "publish") => void;
  isBulkActing?: boolean;
}

export function ReviewQueuePanel({
  queueView,
  onQueueViewChange,
  recordsByView,
  queueCounts,
  selectedRecordId,
  onSelectRecord,
  isLoading,
  errorMessage,
  onRetry,
  bulkSelected,
  onToggleBulkSelect,
  onToggleSelectAll,
  onBulkAction,
  isBulkActing,
}: ReviewQueuePanelProps) {
  const hasBulk = bulkSelected && onToggleBulkSelect && onBulkAction;
  const currentRecords = recordsByView[queueView];
  const bulkCount = bulkSelected?.size ?? 0;
  const allSelected =
    hasBulk && currentRecords.length > 0 && bulkCount === currentRecords.length;
  return (
    <HermeticCard interactive={false} className="overflow-hidden">
      <div className="p-4 pb-0">
        <Tabs
          value={queueView}
          onValueChange={value => onQueueViewChange(value as QueueView)}
        >
          <TabsList className="w-full justify-start gap-1 rounded-lg bg-muted/40 p-1">
            {(
              Object.entries(QUEUE_VIEW_META) as Array<
                [QueueView, (typeof QUEUE_VIEW_META)[QueueView]]
              >
            ).map(([value, meta]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex-1 gap-1.5 rounded-md px-2 py-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
              >
                {meta.label}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium leading-none text-muted-foreground data-[state=active]:bg-muted/80">
                  {queueCounts[value]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* ── Bulk action bar ── */}
          {hasBulk && currentRecords.length > 0 && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5">
              <button
                type="button"
                onClick={onToggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {allSelected ? (
                  <CheckSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                {allSelected ? "Deselect all" : "Select all"}
              </button>
              {bulkCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">
                    {bulkCount} selected
                  </span>
                  {queueView === "pending_review" && (
                    <>
                      <Button
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => onBulkAction("approve")}
                        disabled={isBulkActing}
                      >
                        {isBulkActing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-6 gap-1 px-2 text-[11px]"
                        onClick={() => onBulkAction("reject")}
                        disabled={isBulkActing}
                      >
                        <XCircle className="h-3 w-3" />
                        Reject
                      </Button>
                    </>
                  )}
                  {queueView === "approved" && (
                    <Button
                      size="sm"
                      className="h-6 gap-1 px-2 text-[11px]"
                      onClick={() => onBulkAction("publish")}
                      disabled={isBulkActing}
                    >
                      {isBulkActing ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Send className="h-3 w-3" />
                      )}
                      Publish all
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {(
            Object.entries(recordsByView) as Array<[QueueView, ReviewRecord[]]>
          ).map(([value, records]) => (
            <TabsContent key={value} value={value} className="mt-3 pb-4">
              {/* ── Contextual helper tip ── */}
              {records.length > 0 && (
                <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/10 bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                  <span className="shrink-0">
                    {QUEUE_VIEW_META[value].emoji}
                  </span>
                  <span>{QUEUE_VIEW_META[value].helper}</span>
                </div>
              )}
              {isLoading ? (
                <div
                  className="flex items-center justify-center py-16"
                  role="status"
                >
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/60" />
                </div>
              ) : errorMessage ? (
                <HermeticEmptyState
                  icon={<XCircle className="h-8 w-8 text-red-500/70" />}
                  title="Could not load the review queue"
                  description={errorMessage}
                  action={
                    <Button size="sm" variant="outline" onClick={onRetry}>
                      Try again
                    </Button>
                  }
                />
              ) : records.length === 0 ? (
                <HermeticEmptyState
                  icon={<ClipboardCheck className="h-8 w-8 text-primary/50" />}
                  title={QUEUE_VIEW_META[value].emptyTitle}
                  description={QUEUE_VIEW_META[value].emptyDescription}
                />
              ) : (
                <ScrollArea
                  className="pr-1"
                  style={{ height: records.length > 5 ? 480 : undefined }}
                >
                  <div className="space-y-1.5 pr-3">
                    {records.map(record => (
                      <QueueItemCard
                        key={record.id}
                        record={record}
                        selected={selectedRecordId === record.id}
                        bulkChecked={bulkSelected?.has(record.id) ?? false}
                        showBulkCheckbox={!!hasBulk}
                        onToggleBulk={onToggleBulkSelect!}
                        onSelect={selectedRecord => {
                          onQueueViewChange(
                            getQueueViewForRecord(selectedRecord)
                          );
                          onSelectRecord(selectedRecord);
                        }}
                      />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </HermeticCard>
  );
}

interface ReviewInfoStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

function ReviewInfoStateCard({
  icon,
  title,
  description,
  action,
}: ReviewInfoStateCardProps) {
  return (
    <HermeticCard interactive={false} className="overflow-hidden">
      <HermeticEmptyState
        icon={icon}
        title={title}
        description={description}
        action={action}
      />
    </HermeticCard>
  );
}

export function ReviewLoadingCard() {
  return (
    <HermeticCard interactive={false} className="overflow-hidden">
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-primary/60" />
        <p className="text-xs text-muted-foreground">Loading review details…</p>
      </div>
    </HermeticCard>
  );
}

interface ReviewErrorCardProps {
  title: string;
  description: string;
  actionLabel?: string;
  onRetry: () => void;
}

export function ReviewErrorCard({
  title,
  description,
  actionLabel = "Try again",
  onRetry,
}: ReviewErrorCardProps) {
  return (
    <ReviewInfoStateCard
      icon={<span className="text-2xl">⚠️</span>}
      title={title}
      description={description}
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          {actionLabel}
        </Button>
      }
    />
  );
}

export function ReviewSelectionCard() {
  return (
    <ReviewInfoStateCard
      icon={<span className="text-3xl">👈</span>}
      title="Select an item to review"
      description="Pick any item from the queue to inspect the details, run a quality check, and make a decision."
    />
  );
}

interface ReviewDetailPanelProps {
  detail: ReviewRecord;
  detailView: DetailView;
  onDetailViewChange: (view: DetailView) => void;
  displayedQualityReport: QualityReport | null;
  showPersistedQualityNote: boolean;
  isQualityLoading: boolean;
  canManageOwnership: boolean;
  isAssigning: boolean;
  isReminding: boolean;
  reminderMessage: string;
  showAssignInput: boolean;
  assigneeInput: string;
  teamMembers?: Array<{ name?: string; email: string; role: string }>;
  shadowComparison: ShadowRetrievalComparison | null;
  shadowQuery: string;
  isShadowComparing: boolean;
  shadowCompareError?: string | null;
  onToggleAssignInput: () => void;
  onReminderMessageChange: (value: string) => void;
  onAssigneeInputChange: (value: string) => void;
  onAssigneePick: (value: string) => void;
  onAssigneeKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onAssigneeSubmit: () => void;
  onClaim: () => void;
  onRemind: () => void;
  onRunQualityCheck: () => void;
  onRunShadowCompare: () => void;
}

export function ReviewDetailPanel({
  detail,
  detailView,
  onDetailViewChange,
  displayedQualityReport,
  showPersistedQualityNote,
  isQualityLoading,
  canManageOwnership,
  isAssigning,
  isReminding,
  reminderMessage,
  showAssignInput,
  assigneeInput,
  teamMembers,
  shadowComparison,
  shadowQuery,
  isShadowComparing,
  shadowCompareError,
  onToggleAssignInput,
  onReminderMessageChange,
  onAssigneeInputChange,
  onAssigneePick,
  onAssigneeKeyDown,
  onAssigneeSubmit,
  onClaim,
  onRemind,
  onRunQualityCheck,
  onRunShadowCompare,
}: ReviewDetailPanelProps) {
  const detailMeta = buildDetailMeta(detail);
  const reviewIntelligence = detail.reviewIntelligence ?? null;
  const duplicateCount = reviewIntelligence?.duplicates.length ?? 0;
  const contradictionCount = reviewIntelligence?.contradictions.length ?? 0;
  const filteredMembers = (teamMembers ?? []).filter(
    m =>
      !assigneeInput.trim() ||
      m.email.toLowerCase().includes(assigneeInput.toLowerCase()) ||
      (m.name ?? "").toLowerCase().includes(assigneeInput.toLowerCase())
  );

  return (
    <HermeticCard interactive={false} className="overflow-hidden">
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base shrink-0">📄</span>
            <p className="truncate text-sm font-semibold text-foreground">
              {detail.title || "Untitled document"}
            </p>
          </div>
          <StatusBadge status={detail.status} className="shrink-0" />
        </div>
        {detail.autoApproved ? (
          <p className="mt-0.5 ml-7 text-xs text-muted-foreground">
            ⚡ Auto-approved by {detail.autoApproveRule}
          </p>
        ) : null}
      </div>

      <div className="p-4 pb-0">
        <Tabs
          value={detailView}
          onValueChange={value => onDetailViewChange(value as DetailView)}
        >
          <TabsList className="w-full justify-start gap-1 rounded-lg bg-muted/40 p-1">
            <TabsTrigger
              value="overview"
              className="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              📋 Overview
            </TabsTrigger>
            <TabsTrigger
              value="checks"
              className="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              🔍 Checks
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="rounded-md px-3 py-1.5 text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm"
            >
              💬 Notes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4 pb-4">
            {canManageOwnership ? (
              <div className="space-y-2 rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/10 border border-purple-500/15 shrink-0">
                      <Users className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      {detail.assignedTo
                        ? `Owner: ${detail.assignedTo}`
                        : "Unassigned - claim it or pick a reviewer"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {detail.assignedTo ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onRemind}
                        disabled={isAssigning || isReminding}
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        {isReminding ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <BellRing className="h-3 w-3" />
                        )}
                        Remind
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onClaim}
                      disabled={isAssigning || isReminding}
                      className="h-7 gap-1 px-2 text-xs"
                    >
                      {isAssigning ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <UserCheck className="h-3 w-3" />
                      )}
                      Claim
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={onToggleAssignInput}
                      disabled={isReminding}
                    >
                      Assign
                    </Button>
                  </div>
                </div>
                {detail.assignedTo ? (
                  <div className="space-y-2 pl-9">
                    <p className="text-[11px] text-muted-foreground">
                      {detail.lastRemindedAt
                        ? `Last reminder ${formatDateTime(detail.lastRemindedAt, "recently")}`
                        : "No reminder recorded yet."}
                    </p>
                    <div className="space-y-1.5 rounded-lg border border-border/30 bg-background/70 p-2.5">
                      <Textarea
                        value={reminderMessage}
                        onChange={event =>
                          onReminderMessageChange(event.target.value)
                        }
                        placeholder="Optional note for the assignee"
                        rows={2}
                        maxLength={500}
                        disabled={isAssigning || isReminding}
                        className="min-h-18 text-sm"
                      />
                      <p className="text-[11px] text-muted-foreground/80">
                        This note is added to the review activity log when the
                        reminder is sent.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {showAssignInput ? (
              <div className="space-y-2 rounded-lg border border-border/30 bg-muted/30 p-3">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={assigneeInput}
                    onChange={event =>
                      onAssigneeInputChange(event.target.value)
                    }
                    placeholder="Type a name or email"
                    className="h-8 flex-1 text-sm"
                    onKeyDown={onAssigneeKeyDown}
                  />
                  <Button
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={onAssigneeSubmit}
                    disabled={!assigneeInput.trim() || isAssigning}
                  >
                    {isAssigning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : null}
                    Assign
                  </Button>
                </div>
                {filteredMembers.length > 0 ? (
                  <div className="space-y-0.5">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                      Team members
                    </p>
                    <div className="max-h-32 space-y-0.5 overflow-y-auto">
                      {filteredMembers.slice(0, 8).map(member => (
                        <button
                          key={member.email}
                          type="button"
                          onClick={() => onAssigneePick(member.email)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-foreground">
                              {member.name || member.email}
                            </p>
                            {member.name ? (
                              <p className="truncate text-[11px] text-muted-foreground/70">
                                {member.email}
                              </p>
                            ) : null}
                          </div>
                          <span className="ml-2 shrink-0 text-muted-foreground/60">
                            {member.role}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : teamMembers && teamMembers.length === 0 ? (
                  <p className="text-xs text-muted-foreground/60">
                    No stream members yet — add someone from Users & Access.
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {detailMeta.map(field => (
                <MetaField
                  key={field.label}
                  label={field.label}
                  value={field.value}
                />
              ))}
            </div>

            {detail.tags.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {detail.tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="rounded-full border-border/50 px-2.5 py-0.5 text-xs text-muted-foreground"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="checks" className="mt-4 space-y-3 pb-4">
            <div className="flex items-center justify-between">
              <p className={k.muted}>Quality scan</p>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={onRunQualityCheck}
                disabled={isQualityLoading}
              >
                {isQualityLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Shield className="h-3 w-3" />
                )}
                {isQualityLoading
                  ? "Checking"
                  : displayedQualityReport
                    ? "Re-run"
                    : "Run"}
              </Button>
            </div>

            {displayedQualityReport ? (
              <>
                {showPersistedQualityNote ? (
                  <p className={k.muted}>
                    From intake — re-run for a fresh result.
                  </p>
                ) : null}
                <QualityReportCard report={displayedQualityReport} />
              </>
            ) : (
              <HermeticEmptyState
                icon={<Shield className="h-7 w-7 text-primary/50" />}
                title="No quality report yet"
                description="Run a scan to see results here."
              />
            )}

            <div className="space-y-3 rounded-xl border border-border/30 bg-muted/20 px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      Review intelligence
                    </p>
                  </div>
                  <p className={cn("mt-1", k.muted)}>
                    {reviewIntelligence
                      ? reviewIntelligence.summary
                      : "No duplicate or contradiction scan has been captured for this item yet."}
                  </p>
                </div>
                {reviewIntelligence ? (
                  <div className="flex flex-wrap gap-1.5">
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/40 bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {duplicateCount} duplicate
                      {duplicateCount === 1 ? "" : "s"}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/40 bg-background/70 px-2 py-0.5 text-[11px] text-muted-foreground"
                    >
                      {contradictionCount} contradiction
                      {contradictionCount === 1 ? "" : "s"}
                    </Badge>
                  </div>
                ) : null}
              </div>

              {reviewIntelligence ? (
                <>
                  {duplicateCount > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                        Likely duplicates
                      </p>
                      <div className="space-y-2">
                        {reviewIntelligence.duplicates.map(match => (
                          <div
                            key={`${match.documentId}-${match.title}`}
                            className="rounded-lg border border-primary/20 bg-primary/6 px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {match.title}
                              </p>
                              <Badge
                                variant="outline"
                                className="rounded-full border-primary/25 bg-background/70 px-2 py-0.5 text-[11px] text-primary dark:text-primary"
                              >
                                {match.matchType === "exact"
                                  ? "Exact"
                                  : `${Math.round(match.similarity * 100)}% match`}
                              </Badge>
                            </div>
                            <p className={cn("mt-1", k.muted)}>
                              {match.chunkPreview}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {contradictionCount > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
                        Potential contradictions
                      </p>
                      <div className="space-y-2">
                        {reviewIntelligence.contradictions.map(match => (
                          <div
                            key={`${match.documentId}-${match.candidateClaim}`}
                            className="rounded-lg border border-red-500/20 bg-red-500/6 px-3 py-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground">
                                {match.title}
                              </p>
                              <Badge
                                variant="outline"
                                className="rounded-full border-red-500/25 bg-background/70 px-2 py-0.5 text-[11px] text-red-700 dark:text-red-300"
                              >
                                {Math.round(match.confidence * 100)}% confidence
                              </Badge>
                            </div>
                            <div className="mt-2 space-y-2 text-sm">
                              <div className="rounded-md border border-border/30 bg-background/70 px-2.5 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  Candidate claim
                                </p>
                                <p className="mt-1 text-foreground/85">
                                  {match.candidateClaim}
                                </p>
                              </div>
                              <div className="rounded-md border border-border/30 bg-background/70 px-2.5 py-2">
                                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
                                  Existing claim
                                </p>
                                <p className="mt-1 text-foreground/85">
                                  {match.conflictingClaim}
                                </p>
                              </div>
                            </div>
                            {match.rationale ? (
                              <p className={cn("mt-2", k.muted)}>
                                {match.rationale}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {duplicateCount === 0 && contradictionCount === 0 ? (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/6 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
                      No duplicate or contradiction risks were detected when
                      this item entered the review queue.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>

            <ShadowRetrievalPanel
              comparison={shadowComparison}
              query={shadowQuery}
              isLoading={isShadowComparing}
              errorMessage={shadowCompareError}
              onRun={onRunShadowCompare}
              emptyDescription="Run a compare to see whether this review item changes retrieval or answer quality before publish."
            />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 pb-4">
            {detail.comments.length > 0 ? (
              <ScrollArea
                style={{ height: detail.comments.length > 3 ? 280 : undefined }}
              >
                <div className="space-y-1.5 pr-3">
                  {detail.comments.map(comment => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border bg-muted/40 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={k.caption}>{comment.author}</p>
                        <p className={k.muted}>
                          {formatDateTime(comment.createdAt, "")}
                        </p>
                      </div>
                      <p className={cn("mt-1", k.muted)}>
                        {comment.text || "No comment provided."}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <HermeticEmptyState
                icon={<MessageSquare className="h-7 w-7 text-primary/50" />}
                title="No notes yet"
                description="Review decisions and comments will appear here."
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </HermeticCard>
  );
}

interface ReviewActionPanelProps {
  detail: ReviewRecord;
  decisionComment: string;
  onDecisionCommentChange: (value: string) => void;
  onApprove: () => void;
  onRequestChanges: () => void;
  onReject: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onResubmit: () => void;
  isActing: boolean;
  isDeciding: boolean;
  isPublishing: boolean;
  isArchiving: boolean;
  isResubmitting: boolean;
  actionError?: string | null;
}

export function ReviewActionPanel({
  detail,
  decisionComment,
  onDecisionCommentChange,
  onApprove,
  onRequestChanges,
  onReject,
  onPublish,
  onArchive,
  onResubmit,
  isActing,
  isDeciding,
  isPublishing,
  isArchiving,
  isResubmitting,
  actionError,
}: ReviewActionPanelProps) {
  const errorBanner = actionError ? (
    <Alert variant="destructive" className="py-2 px-3">
      <AlertCircle className="h-3.5 w-3.5" />
      <AlertDescription className="text-xs">{actionError}</AlertDescription>
    </Alert>
  ) : null;

  if (detail.status === "pending_review") {
    return (
      <HermeticCard interactive={false} className="overflow-hidden">
        <div className="space-y-3 p-4">
          {errorBanner}
          <Textarea
            value={decisionComment}
            onChange={event => onDecisionCommentChange(event.target.value)}
            placeholder="Optional: note explaining the decision"
            rows={3}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onApprove}
              disabled={isActing}
              size="sm"
              className="gap-1.5"
            >
              {isDeciding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              variant="outline"
              onClick={onRequestChanges}
              disabled={isActing}
              size="sm"
              className="gap-1.5 border-primary/35 text-primary hover:bg-primary/10 dark:text-primary"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Request changes
            </Button>
            <Button
              variant="destructive"
              onClick={onReject}
              disabled={isActing}
              size="sm"
              className="gap-1.5"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </HermeticCard>
    );
  }

  if (detail.status === "approved") {
    return (
      <HermeticCard interactive={false} className="overflow-hidden">
        <div className="space-y-3 p-4">
          {errorBanner}
          <Button
            onClick={onPublish}
            disabled={isActing}
            size="sm"
            className="gap-1.5"
          >
            {isPublishing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Publish to domain library
          </Button>
        </div>
      </HermeticCard>
    );
  }

  if (detail.status === "published") {
    return (
      <HermeticCard interactive={false} className="overflow-hidden">
        <div className="space-y-3 p-4">
          {errorBanner}
          <Button
            variant="secondary"
            onClick={onArchive}
            disabled={isActing}
            size="sm"
            className="gap-1.5"
          >
            {isArchiving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
            Archive document
          </Button>
        </div>
      </HermeticCard>
    );
  }

  if (detail.status === "rejected" || detail.status === "revision_requested") {
    return (
      <HermeticCard interactive={false} className="overflow-hidden">
        <div className="space-y-3 p-4">
          {errorBanner}
          <Button
            variant="outline"
            onClick={onResubmit}
            disabled={isActing}
            size="sm"
            className="gap-1.5"
          >
            {isResubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Resubmit for review
          </Button>
        </div>
      </HermeticCard>
    );
  }

  return null;
}
