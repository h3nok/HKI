import { useMemo, useState, useEffect, useCallback } from "react";
import { skipToken } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import {
  BookOpen,
  ClipboardList,
  FlaskConical,
  Library,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Upload,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  canManageKnowledgeWorkspace,
  canWriteKnowledgeWorkspace,
} from "@/_core/access/knowledge";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { buildChatWorkspaceHref } from "@/_core/workspace-navigation";
import type { FeatureFlagKey } from "@shared/feature-flags";
import {
  type DocumentInventorySummary,
  type IngestionJob,
  type ReviewRecord,
} from "@shared/knowledge-types";
import { type KnowledgeTab } from "../types";
import { type JourneyProgress } from "../hooks/useJourneyProgress";
import { getAvailableValidateSections } from "../feature-gates";
import { useKB } from "../context/KnowledgeContext";
import OnboardingHero from "./OnboardingHero";
import JourneyCompletion from "./JourneyCompletion";
import {
  OverviewPage,
  type OverviewAction,
  type OverviewPageModel,
} from "./overview/OverviewPage";
import { computeMaturity } from "./overview/maturity-model";
import { formatRelativeTime } from "./overview/utils";

interface OverviewTabProps {
  docCount: number;
  chunkCount: number;
  entityCount: number;
  jobCount: number;
  selectedStream?: string;
  streamLabel: string;
  isLoading: boolean;
  onNavigate: (tab: KnowledgeTab, section?: string) => void;
  jobsQ?: any;
  journey: JourneyProgress;
}

function buildChatHref(selectedStream?: string): string {
  return buildChatWorkspaceHref(selectedStream);
}

interface JourneyStep {
  id: string;
  step: number;
  label: string;
  icon: LucideIcon;
  phase: 1 | 2;
  desc: string;
  actionLabel: string;
  action:
    | "guidelines"
    | "gaps"
    | "ingest"
    | "library"
    | "test"
    | "ingest-iterate";
}

const JOURNEY: JourneyStep[] = [
  {
    id: "guidelines",
    step: 1,
    label: "📖 Read the Guide",
    icon: BookOpen,
    phase: 1,
    desc: "Start with the guide before ingesting.",
    actionLabel: "Open Guide",
    action: "guidelines",
  },
  {
    id: "gap-analysis",
    step: 2,
    label: "Find What’s Missing",
    icon: Sparkles,
    phase: 1,
    desc: "Find the highest-value missing content.",
    actionLabel: "Run Analysis",
    action: "gaps",
  },
  {
    id: "first-ingest",
    step: 3,
    label: "📤 Upload Your First Document",
    icon: Upload,
    phase: 1,
    desc: "Upload a first source to validate the flow.",
    actionLabel: "Upload Content",
    action: "ingest",
  },
  {
    id: "verify",
    step: 4,
    label: "✅ Check Your Content",
    icon: Library,
    phase: 2,
    desc: "Review live docs and clear the queue.",
    actionLabel: "Open Library",
    action: "library",
  },
  {
    id: "test",
    step: 5,
    label: "🧪 Try Asking a Question",
    icon: FlaskConical,
    phase: 2,
    desc: "Test the questions your team will ask.",
    actionLabel: "Test Answers",
    action: "test",
  },
  {
    id: "iterate",
    step: 6,
    label: "🚀 Add More & Improve",
    icon: TrendingUp,
    phase: 2,
    desc: "Add more content and keep it current.",
    actionLabel: "Add More Content",
    action: "ingest-iterate",
  },
];

const HERO_COPY: Record<string, { title: string; description: string }> = {
  guidelines: {
    title: "Set the Standard First",
    description:
      "Set the rules and review posture before content starts flowing into the domain.",
  },
  "gap-analysis": {
    title: "Find the Open Space",
    description:
      "See what the domain library still cannot answer and target the next highest-value content.",
  },
  "first-ingest": {
    title: "Signal Your First Document",
    description:
      "Turn the first source into structured, searchable knowledge for the team.",
  },
  verify: {
    title: "Shape What Goes Live",
    description:
      "Curate trusted content, tighten metadata, and approve what people should rely on.",
  },
  test: {
    title: "Try the Answers",
    description:
      "Ask real questions and see where retrieval, coverage, or confidence still needs work.",
  },
  iterate: {
    title: "Keep the Signal Fresh",
    description: "Expand coverage and retire stale material as usage grows.",
  },
};

function stripLeadingJourneyIcon(label: string): string {
  const trimmed = label.trim();
  const firstSpace = trimmed.indexOf(" ");
  if (firstSpace === -1) return trimmed;

  const firstToken = trimmed.slice(0, firstSpace);
  return /[A-Za-z0-9]/.test(firstToken)
    ? trimmed
    : trimmed.slice(firstSpace + 1);
}

const EMPTY_DOCUMENT_INVENTORY_SUMMARY: DocumentInventorySummary = {
  totalDocuments: 0,
  liveCount: 0,
  pendingReviewCount: 0,
  processingCount: 0,
  archivedCount: 0,
  failedCount: 0,
  missingLabelsCount: 0,
  topDepartments: [],
  freshness: {
    currentCount: 0,
    reviewCount: 0,
    staleCount: 0,
    unknownCount: 0,
  },
};

function serviceTone(ok?: boolean) {
  if (ok === undefined) return "neutral" as const;
  return ok ? ("success" as const) : ("danger" as const);
}

export default function OverviewTab({
  docCount,
  chunkCount,
  entityCount,
  jobCount,
  selectedStream,
  streamLabel,
  isLoading,
  onNavigate,
  jobsQ,
  journey,
}: OverviewTabProps) {
  const { role } = usePermissions();
  const { canView: canViewFeature } = useFeatureAccess();
  const { isAttested, isAttestationLoading, onOpenGuide } = useKB();
  const canWriteKnowledge = canWriteKnowledgeWorkspace(role);
  const canManageKnowledge = canManageKnowledgeWorkspace(role);

  // Persist banner dismiss per stream so it doesn't reappear on every visit
  const dismissKey = `kb-journey-dismissed-${selectedStream || "default"}`;
  const [journeyDismissed, setJourneyDismissed] = useState(() => {
    try {
      return localStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });
  const handleDismissJourney = useCallback(() => {
    setJourneyDismissed(true);
    try {
      localStorage.setItem(dismissKey, "1");
    } catch {}
  }, [dismissKey]);

  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const availableValidateSections = useMemo(
    () => getAvailableValidateSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const showContentReadiness = canViewFeature(
    "release.knowledge.overview.contentReadiness"
  );
  const showAnswerTrust = canViewFeature(
    "release.knowledge.overview.answerTrust"
  );
  const showReviewQueue = canViewFeature(
    "release.knowledge.overview.reviewQueue"
  );
  const showConnectedSources = canViewFeature(
    "release.knowledge.overview.connectedSources"
  );
  const showComplianceSafety = canViewFeature(
    "release.knowledge.overview.complianceSafety"
  );
  const showContentCurrency = canViewFeature(
    "release.knowledge.overview.contentCurrency"
  );
  const showTelemetryDeck = canViewFeature(
    "release.knowledge.overview.telemetry"
  );

  const { currentStep: currentStepMeta, doneCount, completeStep } = journey;

  const showGaps = availableValidateSections.includes("gaps");
  const activeJourney = useMemo(
    () => (showGaps ? JOURNEY : JOURNEY.filter(s => s.id !== "gap-analysis")),
    [showGaps]
  );

  const meQ = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 300_000,
  });
  const firstName = useMemo(() => {
    const raw = meQ.data?.name ?? meQ.data?.email ?? "";
    return raw.split(/[\s@]/)[0] ?? "";
  }, [meQ.data]);

  const currentStep = useMemo(() => {
    if (!currentStepMeta) return null;
    return activeJourney.find(step => step.id === currentStepMeta.id) ?? null;
  }, [currentStepMeta, activeJourney]);

  function handleStepAction(step: JourneyStep) {
    switch (step.action) {
      case "guidelines":
        onOpenGuide();
        break;
      case "gaps":
        onNavigate("validate", "gaps");
        break;
      case "ingest":
      case "ingest-iterate":
        onNavigate("ingest");
        break;
      case "library":
        onNavigate("library");
        break;
      case "test":
        onNavigate("validate", "test");
        break;
    }
  }

  const explicitStreamId =
    selectedStream && selectedStream !== "global" ? selectedStream : null;
  const hasExplicitStream = Boolean(explicitStreamId);
  const gapSnapshotsQ = trpc.gemini.listGapSnapshots.useQuery(
    explicitStreamId
      ? { valueStreamId: explicitStreamId, limit: 1 }
      : skipToken,
    { retry: false, enabled: hasExplicitStream }
  );
  const analyticsQ = trpc.knowledge.analyticsMetrics.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : undefined,
    {
      retry: false,
      refetchInterval: 60_000,
    }
  );
  const healthQ = trpc.knowledge.serviceHealth.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const connectorsQ = trpc.connectors.list.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const reviewPendingQ = trpc.knowledge.reviewListPending.useQuery(
    explicitStreamId
      ? { limit: 100, valueStreamId: explicitStreamId }
      : skipToken,
    {
      retry: false,
      staleTime: 15_000,
      refetchInterval: 30_000,
      enabled: hasExplicitStream,
    }
  );
  const reviewAllQ = trpc.knowledge.reviewListAll.useQuery(
    explicitStreamId
      ? { limit: 200, valueStreamId: explicitStreamId }
      : skipToken,
    {
      retry: false,
      staleTime: 15_000,
      refetchInterval: 30_000,
      enabled: hasExplicitStream,
    }
  );
  const documentInventorySummaryQ =
    trpc.knowledge.documentInventorySummary.useQuery(
      explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
      {
        retry: false,
        staleTime: 15_000,
        refetchInterval: 60_000,
        enabled: hasExplicitStream,
      }
    );
  const obsQ = trpc.knowledge.observabilitySummary.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    {
      retry: false,
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: hasExplicitStream,
    }
  );
  const teamAttestationsQ = trpc.knowledge.listAttestations.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    { retry: false, staleTime: 30_000, enabled: hasExplicitStream }
  );
  const launchReadinessQ = trpc.knowledge.launchReadiness.useQuery(
    explicitStreamId ? { valueStreamId: explicitStreamId } : skipToken,
    {
      retry: false,
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: hasExplicitStream,
    }
  );
  const releasesQ = trpc.knowledge.listReleases.useQuery(
    explicitStreamId
      ? { valueStreamId: explicitStreamId, limit: 5 }
      : skipToken,
    {
      retry: false,
      staleTime: 30_000,
      refetchInterval: 60_000,
      enabled: hasExplicitStream,
    }
  );

  const utils = trpc.useUtils();
  const [refreshing, setRefreshing] = useState(false);
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        utils.knowledge.invalidate(),
        utils.connectors.invalidate(),
        utils.gemini.invalidate(),
        jobsQ?.refetch?.(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [jobsQ, utils]);

  const jobs = ((jobsQ?.data?.jobs ?? []) as IngestionJob[]) || [];
  const scopedJobs = useMemo(
    () =>
      hasExplicitStream
        ? jobs.filter(job => job.streamId === selectedStream)
        : [],
    [hasExplicitStream, jobs, selectedStream]
  );
  const pendingReviews = useMemo(() => {
    if (!hasExplicitStream) return [];
    const all = (reviewPendingQ.data as ReviewRecord[]) ?? [];
    return all.filter(review => review.streamId === selectedStream);
  }, [hasExplicitStream, reviewPendingQ.data, selectedStream]);
  const reviewRecords = useMemo(() => {
    if (!hasExplicitStream) return [];
    const all = (reviewAllQ.data as ReviewRecord[]) ?? [];
    return all.filter(
      record =>
        !selectedStream ||
        !record.streamId ||
        record.streamId === selectedStream
    );
  }, [hasExplicitStream, reviewAllQ.data, selectedStream]);
  const approvedReviews = useMemo(
    () => reviewRecords.filter(record => record.status === "approved"),
    [reviewRecords]
  );
  const connectors = useMemo(
    () => (connectorsQ.data as any[]) ?? [],
    [connectorsQ.data]
  );
  const services = healthQ.data?.services ?? [];
  const gapSnapshots = gapSnapshotsQ.data?.snapshots ?? [];
  const latestSnapshot = gapSnapshots[0] ?? null;
  const observability = obsQ.data;
  const launchReadiness = launchReadinessQ.data;
  const launchChecks = launchReadiness?.checks ?? [];
  const launchPassedCount = launchChecks.filter(check => check.passed).length;
  const launchBlockedCount = Math.max(
    launchChecks.length - launchPassedCount,
    0
  );
  const firstFailedLaunchCheck = launchChecks.find(check => !check.passed);
  const latestRelease = releasesQ.data?.[0] ?? null;

  useEffect(() => {
    if (isAttested) completeStep("guidelines");
    if (gapSnapshots.length > 0) completeStep("gap-analysis");
  }, [completeStep, gapSnapshots.length, isAttested]);

  const inventorySummary =
    documentInventorySummaryQ.data ?? EMPTY_DOCUMENT_INVENTORY_SUMMARY;
  const contentSummary = useMemo(() => {
    const pendingReviewCount = reviewPendingQ.isSuccess
      ? pendingReviews.length
      : inventorySummary.pendingReviewCount;
    const readyToPublishCount = reviewAllQ.isSuccess
      ? approvedReviews.length
      : 0;

    return {
      liveCount: inventorySummary.liveCount,
      archivedCount: inventorySummary.archivedCount,
      pendingReviewCount,
      readyToPublishCount,
      processingCount: inventorySummary.processingCount,
      missingLabelsCount: inventorySummary.missingLabelsCount,
      trackedCount: inventorySummary.totalDocuments || docCount,
      currentCount: inventorySummary.freshness.currentCount,
      reviewDueCount: inventorySummary.freshness.reviewCount,
      staleCount: inventorySummary.freshness.staleCount,
      unknownCount: inventorySummary.freshness.unknownCount,
      topDepartments: inventorySummary.topDepartments,
    };
  }, [
    approvedReviews.length,
    docCount,
    inventorySummary,
    pendingReviews.length,
    reviewAllQ.isSuccess,
    reviewPendingQ.isSuccess,
  ]);

  const queueSummary = useMemo(() => {
    const runningCount = scopedJobs.filter(
      job =>
        job.status !== "completed" &&
        job.status !== "failed" &&
        job.status !== "cancelled"
    ).length;
    const failedCount = scopedJobs.filter(
      job => job.status === "failed"
    ).length;
    const oldestPending = [...pendingReviews].sort(
      (a, b) =>
        new Date(a.submittedAt ?? a.createdAt).getTime() -
        new Date(b.submittedAt ?? b.createdAt).getTime()
    )[0];

    return {
      pendingCount: reviewPendingQ.isSuccess
        ? pendingReviews.length
        : contentSummary.pendingReviewCount,
      readyToPublishCount: contentSummary.readyToPublishCount,
      runningCount,
      failedCount,
      oldestPendingLabel: oldestPending
        ? formatRelativeTime(
            oldestPending.submittedAt ?? oldestPending.createdAt
          )
        : contentSummary.pendingReviewCount > 0
          ? `${contentSummary.pendingReviewCount} pending`
          : "Queue clear",
    };
  }, [
    contentSummary.pendingReviewCount,
    contentSummary.readyToPublishCount,
    pendingReviews,
    reviewPendingQ.isSuccess,
    scopedJobs,
  ]);

  const sourceSummary = useMemo(() => {
    const activeCount = connectors.filter(
      connector => connector.status === "active"
    ).length;
    const pausedCount = connectors.filter(
      connector => connector.status === "paused"
    ).length;
    const errorCount = connectors.filter(
      connector =>
        connector.status === "error" || (connector.consecutiveErrors ?? 0) >= 3
    ).length;
    const laggingCount = connectors.filter(connector => {
      if (connector.status !== "active") return false;
      if (!connector.lastSyncAt) return true;
      const minutes = Math.floor(
        (Date.now() - new Date(connector.lastSyncAt).getTime()) / 60_000
      );
      return minutes > connector.syncIntervalMinutes * 2;
    }).length;
    const latestSync = connectors
      .filter(connector => connector.lastSyncAt)
      .sort(
        (a, b) =>
          new Date(b.lastSyncAt as string).getTime() -
          new Date(a.lastSyncAt as string).getTime()
      )[0];

    return {
      total: connectors.length,
      activeCount,
      pausedCount,
      errorCount,
      laggingCount,
      latestSyncLabel: latestSync?.lastSyncAt
        ? formatRelativeTime(latestSync.lastSyncAt)
        : "No sync yet",
    };
  }, [connectors]);

  const answerTrust = useMemo(() => {
    const retrievalScore = Math.round(
      (analyticsQ.data?.avgTopScore ?? 0) * 100
    );
    const coverageScore = latestSnapshot?.coverageScore ?? 0;
    const avgChunksPerSearch = analyticsQ.data?.avgChunksPerSearch ?? 0;
    const derivedTrustScore =
      retrievalScore > 0 || coverageScore > 0
        ? Math.round(retrievalScore * 0.6 + coverageScore * 0.4)
        : null;
    const trustScore =
      launchReadinessQ.data?.latestEvalPassRate ?? derivedTrustScore;
    const lastCheckedAt =
      launchReadinessQ.data?.latestEvalCompletedAt ??
      latestSnapshot?.createdAt ??
      null;

    return {
      trustScore,
      retrievalScore,
      coverageScore,
      avgChunksPerSearch,
      lastCheckedLabel: lastCheckedAt
        ? formatRelativeTime(lastCheckedAt)
        : "Not checked yet",
    };
  }, [analyticsQ.data, latestSnapshot, launchReadinessQ.data]);

  const safetySummary = useMemo(() => {
    const upCount = services.filter(service => service.ok).length;
    const serviceCount = services.length;
    const llmErrorRate =
      observability && observability.totalTraces > 0
        ? (observability.errorCount / observability.totalTraces) * 100
        : null;

    return {
      upCount,
      serviceCount,
      attested: isAttested,
      teamConfirmedCount: teamAttestationsQ.data?.length ?? 0,
      llmErrorRate,
    };
  }, [isAttested, observability, services, teamAttestationsQ.data]);

  const maturity = useMemo(
    () =>
      computeMaturity({
        docCount,
        chunkCount,
        entityCount,
        cmos: analyticsQ.data?.cmos ?? 0,
        avgChunksPerSearch: analyticsQ.data?.avgChunksPerSearch ?? 0,
        avgTopScore: analyticsQ.data?.avgTopScore ?? 0,
        totalIngestJobs: analyticsQ.data?.totalIngestJobs ?? 0,
        ingestSuccessRate: analyticsQ.data?.ingestSuccessRate ?? 0,
        avgIngestDurationMs: analyticsQ.data?.avgIngestDurationMs ?? 0,
        totalEvents: analyticsQ.data?.totalEvents ?? 0,
        uniqueUsers: analyticsQ.data?.uniqueUsers ?? 0,
        journeyDone: doneCount,
        journeyTotal: activeJourney.length,
        servicesUp: services.filter(service => service.ok).length,
        servicesTotal: services.length,
      }),
    [analyticsQ.data, chunkCount, docCount, doneCount, entityCount, services]
  );

  const alreadyAttested = isAttested;
  const attestLoading = isAttestationLoading;
  const showJourneyExperience = canManageKnowledge;
  const overviewMetricsLoading =
    isLoading || documentInventorySummaryQ.isLoading;
  const isFirstTime =
    showJourneyExperience &&
    doneCount === 0 &&
    docCount === 0 &&
    !overviewMetricsLoading &&
    !attestLoading &&
    !alreadyAttested;
  const allDone = showJourneyExperience && doneCount === activeJourney.length;
  const completionValidateSection = useMemo(() => {
    if (availableValidateSections.includes("quality")) return "quality";
    if (availableValidateSections.includes("test")) return "test";
    if (availableValidateSections.includes("gaps")) return "gaps";
    if (availableValidateSections.includes("eval")) return "eval";
    return null;
  }, [availableValidateSections]);

  const roleHero = useMemo(() => {
    if (canManageKnowledge) {
      return {
        title: currentStep
          ? (HERO_COPY[currentStep.id]?.title ??
            stripLeadingJourneyIcon(currentStep.label))
          : "Train an Agent Your Team Can Trust",
        description: currentStep
          ? (HERO_COPY[currentStep.id]?.description ?? currentStep.desc)
          : "Curate the knowledge that powers reliable, trustworthy answers for your team.",
        primaryLabel: currentStep
          ? currentStep.id === "verify" && contentSummary.liveCount > 0
            ? "Open Library"
            : currentStep.actionLabel
          : "Add Content",
        phaseLabel: currentStep
          ? currentStep.phase === 1
            ? "Getting started"
            : "Keeping it sharp"
          : "Ongoing",
        primaryIcon: currentStep?.icon ?? Upload,
      };
    }

    if (canWriteKnowledge) {
      return {
        title:
          contentSummary.liveCount > 0
            ? "Keep Content Current"
            : "Build the First Trusted Sources",
        description:
          contentSummary.liveCount > 0
            ? "Add new sources, monitor processing, and keep the library accurate so reviewers can publish trusted answers."
            : "Seed the domain with documents and connectors so searchable knowledge can start taking shape.",
        primaryLabel:
          contentSummary.processingCount > 0 && contentSummary.liveCount === 0
            ? "View Activity"
            : "Add Content",
        phaseLabel: "Contributor",
        primaryIcon:
          contentSummary.processingCount > 0 && contentSummary.liveCount === 0
            ? Workflow
            : Upload,
      };
    }

    return {
      title:
        contentSummary.liveCount > 0
          ? "Browse Trusted Knowledge"
          : "This Domain Is Still Warming Up",
      description:
        contentSummary.liveCount > 0
          ? "Use the library and agent to explore the published content available for this domain."
          : "Published documents have not appeared yet. You can still open the agent now and return once new content is live.",
      primaryLabel:
        contentSummary.liveCount > 0 ? "Open Library" : "Open Agent",
      phaseLabel: "Read-only access",
      primaryIcon: contentSummary.liveCount > 0 ? Library : Sparkles,
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    contentSummary.liveCount,
    contentSummary.processingCount,
    currentStep,
  ]);

  const heroTitle = roleHero.title;
  const heroDescription = roleHero.description;
  const heroPrimaryActionLabel = roleHero.primaryLabel;
  const heroPhaseLabel = roleHero.phaseLabel;
  const PrimaryHeroIcon = roleHero.primaryIcon;
  const chatHref = buildChatHref(selectedStream);

  const heroPrimaryAction = useMemo<OverviewAction>(() => {
    if (canManageKnowledge && currentStep) {
      return {
        label: heroPrimaryActionLabel,
        onClick: () => handleStepAction(currentStep),
        tone: "primary",
        icon: <PrimaryHeroIcon className="h-3.5 w-3.5" />,
      };
    }

    if (canWriteKnowledge) {
      return {
        label: heroPrimaryActionLabel,
        onClick: () =>
          contentSummary.processingCount > 0 && contentSummary.liveCount === 0
            ? onNavigate("activity")
            : onNavigate("ingest"),
        tone: "primary",
        icon: <PrimaryHeroIcon className="h-3.5 w-3.5" />,
      };
    }

    if (contentSummary.liveCount > 0) {
      return {
        label: heroPrimaryActionLabel,
        onClick: () => onNavigate("library"),
        tone: "primary",
        icon: <PrimaryHeroIcon className="h-3.5 w-3.5" />,
      };
    }

    return {
      label: heroPrimaryActionLabel,
      href: chatHref,
      external: true,
      tone: "primary",
      icon: <PrimaryHeroIcon className="h-3.5 w-3.5" />,
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    contentSummary.liveCount,
    contentSummary.processingCount,
    currentStep,
    heroPrimaryActionLabel,
    onNavigate,
    PrimaryHeroIcon,
    chatHref,
  ]);

  const heroSecondaryAction = useMemo<OverviewAction>(() => {
    if (canManageKnowledge) {
      return contentSummary.liveCount > 0
        ? {
            label: "Open Library",
            onClick: () => onNavigate("library"),
            tone: "secondary",
            icon: <Library className="h-3.5 w-3.5" />,
          }
        : {
            label: "View Activity",
            onClick: () => onNavigate("activity"),
            tone: "secondary",
            icon: <ClipboardList className="h-3.5 w-3.5" />,
          };
    }

    if (canWriteKnowledge) {
      return {
        label: contentSummary.liveCount > 0 ? "Open Library" : "Open Agent",
        onClick:
          contentSummary.liveCount > 0
            ? () => onNavigate("library")
            : undefined,
        href: contentSummary.liveCount > 0 ? undefined : chatHref,
        external: contentSummary.liveCount === 0,
        tone: "secondary",
        icon:
          contentSummary.liveCount > 0 ? (
            <Library className="h-3.5 w-3.5" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          ),
      };
    }

    return {
      label: contentSummary.liveCount > 0 ? "Open Agent" : "View Activity",
      href: contentSummary.liveCount > 0 ? chatHref : undefined,
      onClick:
        contentSummary.liveCount > 0 ? undefined : () => onNavigate("activity"),
      external: contentSummary.liveCount > 0,
      tone: "secondary",
      icon:
        contentSummary.liveCount > 0 ? (
          <Sparkles className="h-3.5 w-3.5" />
        ) : (
          <ClipboardList className="h-3.5 w-3.5" />
        ),
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    contentSummary.liveCount,
    onNavigate,
    chatHref,
  ]);

  const heroTertiaryAction = useMemo<OverviewAction | undefined>(() => {
    if (canManageKnowledge && allDone && showGaps) {
      return {
        label: "Re-run Analysis",
        onClick: () => onNavigate("validate", "gaps"),
        tone: "secondary",
        icon: <RefreshCw className="h-3.5 w-3.5" />,
      };
    }

    if (canWriteKnowledge && contentSummary.processingCount > 0) {
      return {
        label: "View Activity",
        onClick: () => onNavigate("activity"),
        tone: "secondary",
        icon: <ClipboardList className="h-3.5 w-3.5" />,
      };
    }

    return undefined;
  }, [
    allDone,
    canManageKnowledge,
    canWriteKnowledge,
    contentSummary.processingCount,
    onNavigate,
    showGaps,
  ]);

  const totalFreshnessCount =
    contentSummary.currentCount +
    contentSummary.reviewDueCount +
    contentSummary.staleCount +
    contentSummary.unknownCount;
  const currentFreshnessPercent =
    totalFreshnessCount > 0
      ? Math.round((contentSummary.currentCount / totalFreshnessCount) * 100)
      : 0;
  const systemRiskCount =
    safetySummary.serviceCount -
    safetySummary.upCount +
    queueSummary.failedCount;

  const dataUpdatedAt = [
    jobsQ?.dataUpdatedAt,
    documentInventorySummaryQ.dataUpdatedAt,
    analyticsQ.dataUpdatedAt,
    healthQ.dataUpdatedAt,
    connectorsQ.dataUpdatedAt,
    reviewPendingQ.dataUpdatedAt,
    reviewAllQ.dataUpdatedAt,
    obsQ.dataUpdatedAt,
    gapSnapshotsQ.dataUpdatedAt,
    teamAttestationsQ.dataUpdatedAt,
    launchReadinessQ.dataUpdatedAt,
    releasesQ.dataUpdatedAt,
  ].filter((value): value is number => typeof value === "number" && value > 0);
  const lastUpdatedLabel = dataUpdatedAt.length
    ? formatRelativeTime(new Date(Math.max(...dataUpdatedAt)).toISOString())
    : "just now";

  const contentNextAction = useMemo<OverviewAction>(() => {
    if (contentSummary.liveCount > 0) {
      return { label: "Open Library", onClick: () => onNavigate("library") };
    }

    if (
      canManageKnowledge &&
      (contentSummary.pendingReviewCount > 0 ||
        contentSummary.readyToPublishCount > 0)
    ) {
      return {
        label: "Review & Publish",
        onClick: () => onNavigate("govern", "review"),
      };
    }

    if (contentSummary.processingCount > 0) {
      return {
        label: "Processing Status",
        onClick: () => onNavigate("activity"),
      };
    }

    if (canWriteKnowledge) {
      return { label: "Add Content", onClick: () => onNavigate("ingest") };
    }

    return {
      label: "Open Agent",
      href: chatHref,
      external: true,
    };
  }, [
    canManageKnowledge,
    canWriteKnowledge,
    contentSummary.liveCount,
    contentSummary.pendingReviewCount,
    contentSummary.readyToPublishCount,
    contentSummary.processingCount,
    onNavigate,
    chatHref,
  ]);

  const systemItems = useMemo<OverviewPageModel["systemItems"]>(() => {
    const serviceLookup = new Map(
      services.map(service => [service.name, service])
    );
    const knowledgeApi = serviceLookup.get("knowledge-api");
    const pipeline = serviceLookup.get("pipeline");
    const orchestrator = serviceLookup.get("orchestrator");

    return [
      {
        label: "Knowledge API",
        icon: Library,
        value: knowledgeApi
          ? knowledgeApi.ok
            ? `${knowledgeApi.latencyMs}ms`
            : "Down"
          : "Unknown",
        detail: knowledgeApi?.ok
          ? "Semantic retrieval responding"
          : "Service unavailable",
        tone: serviceTone(knowledgeApi?.ok),
      },
      {
        label: "Pipeline",
        icon: Workflow,
        value: pipeline
          ? pipeline.ok
            ? `${pipeline.latencyMs}ms`
            : "Down"
          : "Unknown",
        detail:
          queueSummary.runningCount > 0
            ? `${queueSummary.runningCount} job${queueSummary.runningCount === 1 ? "" : "s"} running`
            : "No active ingestion pressure",
        tone:
          queueSummary.failedCount > 0 ? "warning" : serviceTone(pipeline?.ok),
      },
      {
        label: "Orchestrator",
        icon: Sparkles,
        value: orchestrator
          ? orchestrator.ok
            ? `${orchestrator.latencyMs}ms`
            : "Down"
          : "Unknown",
        detail: orchestrator?.ok
          ? "Chat orchestration healthy"
          : "Needs attention",
        tone: serviceTone(orchestrator?.ok),
      },
      {
        label: "Release",
        icon: TrendingUp,
        value: latestRelease
          ? latestRelease.status === "promoted"
            ? "Promoted"
            : latestRelease.status === "candidate"
              ? "Candidate"
              : "History"
          : "None",
        detail: latestRelease?.label ?? "No release candidate yet",
        tone: latestRelease
          ? latestRelease.status === "promoted"
            ? "success"
            : latestRelease.status === "candidate"
              ? "warning"
              : "neutral"
          : "neutral",
      },
      {
        label: "Jobs",
        icon: ClipboardList,
        value:
          queueSummary.runningCount > 0
            ? `${queueSummary.runningCount} active`
            : queueSummary.failedCount > 0
              ? `${queueSummary.failedCount} failed`
              : "Idle",
        detail:
          queueSummary.pendingCount > 0
            ? `${queueSummary.pendingCount} awaiting review`
            : queueSummary.readyToPublishCount > 0
              ? `${queueSummary.readyToPublishCount} ready to publish`
              : "No queue pressure right now",
        tone:
          queueSummary.failedCount > 0
            ? "danger"
            : queueSummary.pendingCount > 0 || queueSummary.runningCount > 0
              ? "warning"
              : queueSummary.readyToPublishCount > 0
                ? "brand"
                : "neutral",
      },
    ];
  }, [
    latestRelease,
    queueSummary.failedCount,
    queueSummary.pendingCount,
    queueSummary.readyToPublishCount,
    queueSummary.runningCount,
    services,
  ]);

  const reviewInsight = useMemo(() => {
    if (
      contentSummary.pendingReviewCount > 0 &&
      contentSummary.readyToPublishCount > 0
    ) {
      return {
        value: `${contentSummary.pendingReviewCount}/${contentSummary.readyToPublishCount}`,
        label: "pending / ready",
        tone: "warning" as const,
      };
    }

    if (contentSummary.pendingReviewCount > 0) {
      return {
        value: contentSummary.pendingReviewCount.toLocaleString(),
        label: "awaiting review",
        tone: "warning" as const,
      };
    }

    if (contentSummary.readyToPublishCount > 0) {
      return {
        value: contentSummary.readyToPublishCount.toLocaleString(),
        label: "ready to publish",
        tone: "brand" as const,
      };
    }

    return {
      value: "0",
      label: "awaiting review",
      tone: "neutral" as const,
    };
  }, [contentSummary.pendingReviewCount, contentSummary.readyToPublishCount]);

  const overviewModel = useMemo<OverviewPageModel>(
    () => ({
      hero: {
        firstName,
        streamLabel,
        phaseLabel: heroPhaseLabel,
        title: heroTitle,
        description: heroDescription,
        insights: [
          {
            value: contentSummary.liveCount.toLocaleString(),
            label: contentSummary.liveCount === 1 ? "live doc" : "live docs",
            tone: contentSummary.liveCount > 0 ? "brand" : "neutral",
          },
          {
            value: reviewInsight.value,
            label: reviewInsight.label,
            tone: reviewInsight.tone,
          },
          {
            value: contentSummary.missingLabelsCount.toLocaleString(),
            label: "missing labels",
            tone: contentSummary.missingLabelsCount > 0 ? "warning" : "neutral",
          },
        ],
        primaryAction: {
          ...heroPrimaryAction,
        },
        secondaryAction: heroSecondaryAction,
        tertiaryAction: heroTertiaryAction,
        readiness: {
          maturity,
          stepsCompleted: doneCount,
          totalSteps: activeJourney.length,
          chatHref,
          launchStatus: launchReadiness
            ? launchBlockedCount > 0
              ? {
                  label: `${launchBlockedCount} blocked`,
                  tone: "warning",
                  detail: firstFailedLaunchCheck?.detail,
                }
              : launchChecks.length > 0
                ? {
                    label: "Launch ready",
                    tone: "success",
                    detail: `${launchPassedCount}/${launchChecks.length} checks passed`,
                  }
                : {
                    label: "Checks pending",
                    tone: "neutral",
                  }
            : undefined,
        },
      },
      contentReadiness: showContentReadiness
        ? {
            liveCount: contentSummary.liveCount,
            trackedCount: contentSummary.trackedCount,
            pendingReviewCount: contentSummary.pendingReviewCount,
            readyToPublishCount: contentSummary.readyToPublishCount,
            processingCount: contentSummary.processingCount,
            archivedCount: contentSummary.archivedCount,
            missingLabelsCount: contentSummary.missingLabelsCount,
            topDepartments: contentSummary.topDepartments,
            action: contentNextAction,
          }
        : null,
      answerTrust: showAnswerTrust
        ? {
            trustScore: answerTrust.trustScore,
            retrievalScore: answerTrust.retrievalScore,
            coverageScore: answerTrust.coverageScore,
            avgChunksPerSearch: answerTrust.avgChunksPerSearch,
            lastCheckedLabel: answerTrust.lastCheckedLabel,
            action: {
              label: canManageKnowledge
                ? "Test Answers"
                : canWriteKnowledge
                  ? "Add Content"
                  : "Open Agent",
              onClick: canManageKnowledge
                ? () => onNavigate("validate", "quality")
                : canWriteKnowledge
                  ? () => onNavigate("ingest")
                  : undefined,
              href:
                canManageKnowledge || canWriteKnowledge ? undefined : chatHref,
              external: !canManageKnowledge && !canWriteKnowledge,
            },
          }
        : null,
      reviewQueue: showReviewQueue
        ? {
            pendingCount: queueSummary.pendingCount,
            readyToPublishCount: queueSummary.readyToPublishCount,
            failedCount: queueSummary.failedCount,
            runningCount: queueSummary.runningCount,
            oldestPendingLabel: queueSummary.oldestPendingLabel,
            action: {
              label: canManageKnowledge
                ? queueSummary.pendingCount > 0
                  ? "Review Content"
                  : queueSummary.readyToPublishCount > 0
                    ? "Publish Content"
                    : "Review Content"
                : canWriteKnowledge
                  ? "View Activity"
                  : "Open Library",
              onClick: canManageKnowledge
                ? () => onNavigate("govern", "review")
                : canWriteKnowledge
                  ? () => onNavigate("activity")
                  : () => onNavigate("library"),
            },
          }
        : null,
      connectedSources: showConnectedSources
        ? {
            total: sourceSummary.total,
            activeCount: sourceSummary.activeCount,
            pausedCount: sourceSummary.pausedCount,
            laggingCount: sourceSummary.laggingCount,
            errorCount: sourceSummary.errorCount,
            latestSyncLabel: sourceSummary.latestSyncLabel,
            action: {
              label: canWriteKnowledge ? "Add Content" : "Open Library",
              onClick: canWriteKnowledge
                ? () => onNavigate("ingest")
                : () => onNavigate("library"),
            },
          }
        : null,
      complianceSafety: showComplianceSafety
        ? {
            upCount: safetySummary.upCount,
            serviceCount: safetySummary.serviceCount,
            attested: safetySummary.attested,
            teamConfirmedCount: safetySummary.teamConfirmedCount,
            llmErrorRate: safetySummary.llmErrorRate,
            action: {
              label: canManageKnowledge
                ? "View Compliance"
                : canWriteKnowledge
                  ? "View Activity"
                  : "Open Library",
              onClick: canManageKnowledge
                ? () => onNavigate("govern", "compliance")
                : canWriteKnowledge
                  ? () => onNavigate("activity")
                  : () => onNavigate("library"),
            },
          }
        : null,
      contentCurrency: showContentCurrency
        ? {
            currentCount: contentSummary.currentCount,
            reviewCount: contentSummary.reviewDueCount,
            staleCount: contentSummary.staleCount,
            unknownCount: contentSummary.unknownCount,
            action: {
              label: canManageKnowledge ? "View Freshness" : "Open Library",
              onClick: canManageKnowledge
                ? () => onNavigate("validate", "quality")
                : () => onNavigate("library"),
            },
          }
        : null,
      systemItems: showTelemetryDeck ? systemItems : [],
      lastUpdatedLabel,
      refreshing,
      onRefresh: refreshAll,
    }),
    [
      allDone,
      answerTrust.avgChunksPerSearch,
      answerTrust.coverageScore,
      answerTrust.lastCheckedLabel,
      answerTrust.retrievalScore,
      answerTrust.trustScore,
      canManageKnowledge,
      canWriteKnowledge,
      contentSummary.archivedCount,
      contentSummary.currentCount,
      contentSummary.liveCount,
      contentSummary.missingLabelsCount,
      contentSummary.pendingReviewCount,
      contentSummary.readyToPublishCount,
      contentSummary.processingCount,
      contentNextAction,
      contentSummary.reviewDueCount,
      contentSummary.staleCount,
      contentSummary.topDepartments,
      contentSummary.trackedCount,
      contentSummary.unknownCount,
      currentStep,
      doneCount,
      documentInventorySummaryQ.dataUpdatedAt,
      firstName,
      heroPrimaryAction,
      heroSecondaryAction,
      heroTertiaryAction,
      heroDescription,
      heroPhaseLabel,
      heroTitle,
      lastUpdatedLabel,
      launchReadiness,
      maturity,
      onNavigate,
      queueSummary.failedCount,
      queueSummary.oldestPendingLabel,
      queueSummary.pendingCount,
      queueSummary.readyToPublishCount,
      queueSummary.runningCount,
      reviewAllQ.dataUpdatedAt,
      refreshAll,
      reviewInsight.label,
      reviewInsight.tone,
      reviewInsight.value,
      refreshing,
      safetySummary.attested,
      safetySummary.llmErrorRate,
      safetySummary.serviceCount,
      safetySummary.teamConfirmedCount,
      safetySummary.upCount,
      showAnswerTrust,
      showComplianceSafety,
      showConnectedSources,
      showContentCurrency,
      showContentReadiness,
      showReviewQueue,
      showTelemetryDeck,
      selectedStream,
      latestRelease,
      firstFailedLaunchCheck?.detail,
      sourceSummary.activeCount,
      sourceSummary.errorCount,
      sourceSummary.laggingCount,
      sourceSummary.latestSyncLabel,
      sourceSummary.pausedCount,
      sourceSummary.total,
      streamLabel,
      systemItems,
    ]
  );

  return (
    <AnimatePresence mode="wait">
      {isFirstTime ? (
        <OnboardingHero
          key="hero"
          streamLabel={streamLabel}
          onGetStarted={onOpenGuide}
        />
      ) : (
        <div key="mission-control" className="w-full">
          {canManageKnowledge && allDone && !journeyDismissed && (
            <div className="pb-4">
              <JourneyCompletion
                docCount={docCount}
                chunkCount={chunkCount}
                entityCount={entityCount}
                healthScore={maturity.overall}
                streamLabel={streamLabel}
                onDismiss={handleDismissJourney}
                primaryActionLabel={
                  completionValidateSection
                    ? "Explore Advanced Features"
                    : undefined
                }
                onExploreAdvanced={
                  completionValidateSection
                    ? () => onNavigate("validate", completionValidateSection)
                    : undefined
                }
              />
            </div>
          )}
          <OverviewPage model={overviewModel} />
        </div>
      )}
    </AnimatePresence>
  );
}
