/**
 * Knowledge Content Area — SidebarInset with breadcrumb, data queries,
 * AI assistant context, tab routing, and banner logic.
 *
 * Extracted from index.tsx for single-responsibility modularity.
 */

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  lazy,
  Suspense,
} from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn, useNotifications } from "@hki/ui";
import { useSearch } from "wouter";
import { SidebarInset } from "@/components/ui/sidebar";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { extractKnowledgeNavigationFromSearch } from "@/_core/workspace-navigation";
import {
  canManageKnowledgeWorkspace,
  getAllowedKnowledgeTabs,
  getDefaultKnowledgeTab,
  isKnowledgeTabAllowed,
} from "@/_core/access/knowledge";
import { trpc } from "@/lib/trpc";
import type { FeatureFlagKey } from "@shared/feature-flags";
import type { GovernSection, KnowledgeTab, ValidateSection } from "../types";
import { humanizePipelineError } from "../types";
import { k, hasActiveJobs, JOB_POLL_INTERVAL_MS } from "../theme";
import {
  getAvailableGovernSections,
  getAvailableKnowledgeTabs,
  getAvailableValidateSections,
} from "../feature-gates";
import { useKB } from "../context/KnowledgeContext";
import { useJourneyProgress } from "../hooks/useJourneyProgress";
import { useKnowledgeJobsSocket } from "../hooks/useKnowledgeJobsSocket";
import KnowledgeBreadcrumb from "./KnowledgeBreadcrumb";
import KnowledgeLoader from "../components/KnowledgeLoader";
import NextStepBanner, {
  BANNERS,
  type BannerConfig,
} from "../components/NextStepBanner";

// ── Tab imports ──────────────────────────────────────────────────────────────
const OverviewTab = lazy(() => import("../components/OverviewTab"));
const IngestTab = lazy(() => import("../components/IngestTab"));
const LibraryTab = lazy(() => import("../components/LibraryTab"));
const ValidateTab = lazy(() => import("../components/ValidateTab"));
const GovernTab = lazy(() => import("../components/GovernTab"));
const ActivitiesTab = lazy(() => import("../components/ActivitiesTab"));
const PipelinesTab = lazy(() => import("../components/PipelinesTab"));
import KBErrorBoundary from "../components/KBErrorBoundary";

type GuidedStep = {
  title: string;
  description: string;
  outcome: string;
  action: string;
  tab: KnowledgeTab;
  targetSelector?: string;
};

const UNSELECTED_STREAM_KEY = "unselected";

function TabContentLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center py-16">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        Loading view
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTENT AREA — SidebarInset with page header + tab content
// ═══════════════════════════════════════════════════════════════════════════════

export default function KnowledgeContent() {
  const utils = trpc.useUtils();
  const { role } = usePermissions();
  const { canView: canViewFeature } = useFeatureAccess();
  const searchString = useSearch();
  const {
    tab,
    setTab,
    selectedStream,
    streamLabel,
    governSection,
    setGovernSection,
    isAttested,
    isAttestationLoading,
    onOpenGuide,
  } = useKB();
  const requestedKnowledgeNavigation = useMemo(
    () => extractKnowledgeNavigationFromSearch(searchString),
    [searchString]
  );
  const lastHandledKnowledgeNavigationRef = useRef("");
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const availableTabs = useMemo(
    () =>
      getAvailableKnowledgeTabs({
        allowedTabs: getAllowedKnowledgeTabs(role),
        canManageKnowledge,
        isEnabled: isFeatureEnabled,
      }),
    [canManageKnowledge, isFeatureEnabled, role]
  );
  const availableValidateSections = useMemo(
    () => getAvailableValidateSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const availableGovernSections = useMemo(
    () => getAvailableGovernSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const defaultTab = useMemo(
    () => availableTabs[0] ?? getDefaultKnowledgeTab(role),
    [availableTabs, role]
  );
  const hasExplicitStream = Boolean(
    selectedStream && selectedStream !== "global"
  );
  const streamKey = hasExplicitStream ? selectedStream : UNSELECTED_STREAM_KEY;
  const dismissKey = `kb:onboarding:dismissed:${streamKey}`;
  const tourStepKey = `kb:onboarding:tour-step:${streamKey}`;
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(dismissKey) === "1";
      } catch {
        return false;
      }
    }
  );
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStepIdx, setTourStepIdx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(tourStepKey);
      const idx = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(idx) ? Math.max(0, idx) : 0;
    } catch {
      return 0;
    }
  });
  const [validateSection, setValidateSection] =
    useState<ValidateSection>("test");
  const [focusDocumentId, setFocusDocumentId] = useState<string | undefined>();

  const navigateTo = useCallback(
    (t: KnowledgeTab, section?: string) => {
      const nextTab =
        isKnowledgeTabAllowed(role, t) && availableTabs.includes(t)
          ? t
          : t === "pipelines" && isKnowledgeTabAllowed(role, "activity")
            ? availableTabs.includes("activity")
              ? "activity"
              : defaultTab
            : ["ingest", "validate", "govern"].includes(t) &&
                isKnowledgeTabAllowed(role, "library") &&
                availableTabs.includes("library")
              ? "library"
              : defaultTab;

      if (nextTab === "validate") {
        const requestedSection = section as ValidateSection | undefined;
        const nextSection =
          requestedSection &&
          availableValidateSections.includes(requestedSection)
            ? requestedSection
            : (availableValidateSections[0] ?? "test");
        setValidateSection(nextSection);
      }
      if (
        nextTab === "govern" &&
        (section === "review" || section === "team" || section === "compliance")
      ) {
        const requestedSection = section as GovernSection;
        setGovernSection(
          availableGovernSections.includes(requestedSection)
            ? requestedSection
            : (availableGovernSections[0] ?? "review")
        );
      }
      // If navigating to library with a non-subsection string, treat it as a document ID
      if (
        nextTab === "library" &&
        section &&
        !["documents", "collections", "taxonomy", "graph"].includes(section)
      ) {
        setFocusDocumentId(section);
      } else if (nextTab !== "library") {
        setFocusDocumentId(undefined);
      }
      setTab(nextTab);
    },
    [
      availableGovernSections,
      availableTabs,
      availableValidateSections,
      defaultTab,
      role,
      setTab,
      setGovernSection,
    ]
  );

  // ── Cross-component navigation via custom event ──
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const target = typeof detail === "string" ? detail : detail?.tab;
      const section = typeof detail === "object" ? detail?.section : undefined;
      if (target) navigateTo(target as KnowledgeTab, section);
    };
    window.addEventListener("kb-navigate", handler);
    return () => window.removeEventListener("kb-navigate", handler);
  }, [navigateTo]);

  useEffect(() => {
    if (!requestedKnowledgeNavigation.tab) {
      return;
    }

    const navigationKey = [
      selectedStream,
      requestedKnowledgeNavigation.tab,
      requestedKnowledgeNavigation.documentId,
    ].join(":");

    if (navigationKey === lastHandledKnowledgeNavigationRef.current) {
      return;
    }

    lastHandledKnowledgeNavigationRef.current = navigationKey;
    navigateTo(
      requestedKnowledgeNavigation.tab as KnowledgeTab,
      requestedKnowledgeNavigation.documentId ?? undefined
    );

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      params.delete("tab");
      params.delete("doc");
      const nextSearch = params.toString();
      const nextHref = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, [
    navigateTo,
    requestedKnowledgeNavigation.documentId,
    requestedKnowledgeNavigation.tab,
    selectedStream,
  ]);

  // ── Queries ──
  const scopedMetricsInput = hasExplicitStream
    ? { valueStreamId: selectedStream }
    : undefined;
  const scopedJobsInput = hasExplicitStream
    ? { valueStreamId: selectedStream }
    : undefined;
  const shouldFetchWorkspaceDocuments =
    tab === "library" || tab === "validate" || tab === "ingest";
  const statsQ = trpc.knowledge.stats.useQuery(scopedMetricsInput, {
    retry: false,
    staleTime: 10_000,
    enabled: hasExplicitStream,
  });
  const graphStatsQ = trpc.knowledge.graphStats.useQuery(scopedMetricsInput, {
    retry: false,
    staleTime: 15_000,
    enabled: hasExplicitStream,
  });
  const jobsQ = trpc.knowledge.listJobs.useQuery(scopedJobsInput, {
    retry: false,
    // Safety-net poll: keep a slower fallback behind the WebSocket channel.
    refetchInterval: query => {
      const jobs = query.state.data?.jobs;
      if (Array.isArray(jobs) && hasActiveJobs(jobs)) return 30_000;
      return 60_000;
    },
    refetchOnWindowFocus: false,
    enabled: hasExplicitStream,
  });

  // ── WebSocket job status subscription ────────────────────────────────────
  // Live updates via /ws/jobs with exponential backoff + visibility-aware
  // reconnect. Falls back silently to query-level polling if WS is unavailable.
  useKnowledgeJobsSocket(utils);
  const docsQ = trpc.knowledge.listDocuments.useQuery(
    hasExplicitStream
      ? { valueStreamId: selectedStream, limit: 100 }
      : undefined,
    {
      retry: false,
      staleTime: 10_000,
      enabled: shouldFetchWorkspaceDocuments && hasExplicitStream,
    }
  );

  const docCount = statsQ.data?.totalDocuments ?? docsQ.data?.total ?? 0;
  const chunkCount = statsQ.data?.totalChunks ?? 0;
  const entityCount =
    graphStatsQ.data?.totalEntities ?? graphStatsQ.data?.entityCount ?? 0;
  const jobCount = jobsQ.data?.total ?? 0;
  const guidedSteps: GuidedStep[] = useMemo(
    () => [
      {
        title: "Add content",
        description:
          docCount > 0
            ? `You already have ${docCount} document${docCount === 1 ? "" : "s"}. Add missing SOPs, policy updates, or high-volume FAQs.`
            : "Upload files, paste text, or connect a source to seed your domain library.",
        outcome:
          "Outcome: Core domain content is indexed and available for retrieval.",
        action:
          "Click the upload area or paste text below to add your first document.",
        tab: "ingest",
        targetSelector: "[data-tour='ingest-upload']",
      },
      {
        title: "Test answers",
        description:
          chunkCount > 0
            ? `Run realistic prompts against ${chunkCount.toLocaleString()} indexed chunks to verify grounding and confidence.`
            : "Run retrieval tests as soon as your first documents finish indexing.",
        outcome:
          "Outcome: You know whether responses are accurate, grounded, and complete.",
        action:
          "Type a question your team would ask and check the retrieved sources.",
        tab: "validate",
        targetSelector: "[data-tour='validate-input']",
      },
      {
        title: "Review and publish",
        description:
          "Apply governance checks before broad rollout: reviewer sign-off, policy alignment, and release readiness.",
        outcome:
          "Outcome: Content quality and compliance are approved for production usage.",
        action: "Review pending documents and approve or request revisions.",
        tab: "govern",
        targetSelector: "[data-tour='govern-queue']",
      },
      {
        title: "Monitor activity",
        description:
          jobCount > 0
            ? `Track ${jobCount} recent pipeline job${jobCount === 1 ? "" : "s"}, failures, and throughput trends.`
            : "Monitor ingestion jobs, failures, and refresh cadence over time.",
        outcome:
          "Outcome: You maintain ongoing quality, freshness, and operational reliability.",
        action: "Check pipeline status and review any failed jobs below.",
        tab: "activity",
        targetSelector: "[data-tour='activity-feed']",
      },
    ],
    [chunkCount, docCount, jobCount]
  );
  const totalTourSteps = guidedSteps.length;
  const hasTourProgress = tourStepIdx > 0 && tourStepIdx < totalTourSteps - 1;
  const showPlaybookPrompt =
    canManageKnowledge &&
    hasExplicitStream &&
    !onboardingDismissed &&
    !isAttestationLoading &&
    !isAttested;
  const showOnboardingCard =
    canManageKnowledge &&
    tab === "overview" &&
    !onboardingDismissed &&
    !showPlaybookPrompt;

  useEffect(() => {
    try {
      setOnboardingDismissed(localStorage.getItem(dismissKey) === "1");
    } catch {
      setOnboardingDismissed(false);
    }
  }, [dismissKey]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(tourStepKey);
      const idx = raw ? parseInt(raw, 10) : 0;
      setTourStepIdx(
        Number.isFinite(idx)
          ? Math.max(0, Math.min(totalTourSteps - 1, idx))
          : 0
      );
    } catch {
      setTourStepIdx(0);
    }
  }, [totalTourSteps, tourStepKey]);
  useEffect(() => {
    try {
      localStorage.setItem(tourStepKey, String(tourStepIdx));
    } catch {
      /* noop */
    }
  }, [tourStepIdx, tourStepKey]);

  // ── Journey progress (centralized, persistent) ──
  const journey = useJourneyProgress(streamKey, {
    docCount,
    chunkCount,
    entityCount,
  });

  // ── Pipeline failure notifications ──
  const { notify } = useNotifications();
  const notifiedJobsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const jobs = jobsQ.data?.jobs ?? [];
    for (const job of jobs as any[]) {
      if (job.status === "failed" && !notifiedJobsRef.current.has(job.id)) {
        notifiedJobsRef.current.add(job.id);
        notify({
          title: `Pipeline failed: ${job.title || job.sourceRef || "Untitled"}`,
          description:
            humanizePipelineError(job.error, job.failedAtStage) ||
            "Processing failed — open Processing Status for details.",
          severity: "error",
          group: "pipeline",
          action: {
            label: "Open Processing Status",
            onClick: () => navigateTo("pipelines"),
          },
        });
      }
    }
  }, [jobsQ.data?.jobs, notify, navigateTo]);

  // ── Tour spotlight — scroll + highlight current step's target element ──────
  useEffect(() => {
    if (!tourOpen) return;
    const step = guidedSteps[tourStepIdx];
    const sel = step?.targetSelector;
    const el = sel ? document.querySelector<HTMLElement>(sel) : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("tour-spotlight");
    }
    return () => {
      document
        .querySelector(".tour-spotlight")
        ?.classList.remove("tour-spotlight");
    };
  }, [tourOpen, tourStepIdx, guidedSteps]);

  const PAGE_META: Record<KnowledgeTab, { title: string; desc: string }> = {
    overview: {
      title: "Overview",
      desc: "",
    },
    ingest: {
      title: "Add",
      desc: "Add files, text, links, or connected sources to your domain library.",
    },
    library: {
      title: "Content",
      desc: "Browse, organize, and add content to your domain.",
    },
    validate: {
      title: "Validate",
      desc: "Test retrieval, analyze gaps, and monitor quality.",
    },
    govern: {
      title: "Govern",
      desc: "Review workflow, team access, and compliance.",
    },
    pipelines: {
      title: "Processing",
      desc: "Track content as it is prepared, retry failures, and confirm readiness.",
    },
    activity: {
      title: "Activity",
      desc: "Pipeline jobs, system alerts, and notification history.",
    },
  };

  const meta = useMemo(() => {
    if (tab !== "govern") return PAGE_META[tab];

    if (governSection === "team") {
      return {
        title: "Users & Access",
        desc: "Invite stream members and manage who can curate, review, and publish.",
      };
    }

    if (governSection === "compliance") {
      return {
        title: "Compliance",
        desc: "Track attestations, audit history, and rollout safeguards.",
      };
    }

    return {
      title: "Review & Publish",
      desc: "Review content, assign owners, and publish trusted answers.",
    };
  }, [governSection, tab]);

  // ── Contextual next-step banner (data-driven) ──
  const activeBanner = useMemo((): BannerConfig | null => {
    if (tab === "overview") return null; // Overview has its own guidance

    if (tab === "ingest") return null;

    if (tab === "library") return null;

    // Validate tab: surface coverage score after enough chunks are indexed
    if (tab === "validate") {
      if (chunkCount >= 50)
        return BANNERS.afterGapAnalysis(
          Math.min(100, Math.round((docCount / 50) * 100))
        );
      return null;
    }

    return null;
  }, [tab, docCount, chunkCount]);

  // ── Initial loading screen — delay showing to avoid a loader flash ────────
  const shouldShowInitialLoader =
    tab === "overview" && statsQ.isLoading && !statsQ.data;
  const [showInitialLoader, setShowInitialLoader] = useState(false);
  useEffect(() => {
    if (!shouldShowInitialLoader) {
      setShowInitialLoader(false);
      return;
    }

    const t = setTimeout(() => setShowInitialLoader(true), 150);
    return () => clearTimeout(t);
  }, [shouldShowInitialLoader]);

  if (showInitialLoader && shouldShowInitialLoader) {
    return (
      <SidebarInset
        className={cn(
          "dashboard-shell dashboard-shell--knowledge min-h-svh",
          k.ground,
          "text-foreground",
          "transition-colors"
        )}
      >
        <div className="flex min-h-svh items-center justify-center px-6 py-10">
          <TabContentLoader />
        </div>
      </SidebarInset>
    );
  }

  return (
    <SidebarInset
      className={cn(
        "dashboard-shell dashboard-shell--knowledge min-h-svh",
        k.ground,
        "text-foreground",
        "transition-colors"
      )}
    >
      <KnowledgeBreadcrumb
        tab={tab}
        setTab={setTab}
        groupLabel=""
        groupFirstTab="overview"
        metaTitle={meta.title}
        metaDesc={meta.desc}
        selectedStream={selectedStream}
        streamLabel={streamLabel}
      />

      {(showPlaybookPrompt || showOnboardingCard) && (
        <div className="px-6 sm:px-10 pt-2">
          <div className="w-full mx-auto max-w-350 rounded-xl border border-primary/35 bg-primary/10 shadow-sm ring-1 ring-primary/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary tracking-wide">
                  {showPlaybookPrompt ? "Start here" : "Guided setup"}
                </p>
                {showPlaybookPrompt ? (
                  <div className="mt-0.5 space-y-1">
                    <p className="text-sm text-foreground">
                      Read the playbook for {streamLabel} before you upload or
                      approve anything.
                    </p>
                    <p className="text-sm text-muted-foreground">
                      It shows what belongs in this domain, how to keep answers
                      safe, and what to do first. You can reopen it anytime from
                      the top bar.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {docCount > 0
                      ? `You already have ${docCount} indexed document${docCount === 1 ? "" : "s"}. Take the short tour to check quality and fill any gaps.`
                      : "New here? Take the short tour to see what to add first and where to go next."}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {showPlaybookPrompt ? (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-semibold",
                      k.duoToneAccentSolid,
                      k.duoToneAccentSolidHover
                    )}
                  >
                    Read playbook
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const startIdx = hasTourProgress ? tourStepIdx : 0;
                        setTourStepIdx(startIdx);
                        setTourOpen(true);
                        navigateTo(guidedSteps[startIdx]!.tab);
                      }}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold",
                        k.duoToneAccentSolid,
                        k.duoToneAccentSolidHover
                      )}
                    >
                      {hasTourProgress ? "Resume tour" : "Start tour"}
                    </button>
                    {hasTourProgress && (
                      <button
                        type="button"
                        onClick={() => {
                          setTourStepIdx(0);
                          setTourOpen(true);
                          navigateTo(guidedSteps[0]!.tab);
                        }}
                        className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-background/70 transition-colors"
                      >
                        Restart
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(dismissKey, "1");
                    } catch {
                      /* noop */
                    }
                    setOnboardingDismissed(true);
                  }}
                  className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-background/70 transition-colors"
                >
                  {showPlaybookPrompt ? "Hide for now" : "Dismiss"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content — shrinks when assistant is open */}
        <div className="flex-1 overflow-y-auto">
          <div
            className={cn(
              "w-full mx-auto py-6 sm:py-8",
              tab === "overview"
                ? "max-w-none px-5 sm:px-6 xl:px-8 2xl:px-10"
                : "max-w-350 px-6 sm:px-10"
            )}
          >
            {/* Contextual next-step banner (appears above tab content) */}
            <NextStepBanner banner={activeBanner} onNavigate={navigateTo} />

            <AnimatePresence mode="wait">
              {tab === "overview" && (
                <Suspense key="overview" fallback={<TabContentLoader />}>
                  <KBErrorBoundary
                    tab="overview"
                    onNavigateHome={() => navigateTo("overview")}
                  >
                    <OverviewTab
                      key="overview"
                      docCount={docCount}
                      chunkCount={chunkCount}
                      entityCount={entityCount}
                      jobCount={jobCount}
                      selectedStream={selectedStream}
                      streamLabel={streamLabel}
                      isLoading={statsQ.isLoading}
                      onNavigate={navigateTo}
                      jobsQ={jobsQ}
                      journey={journey}
                    />
                  </KBErrorBoundary>
                </Suspense>
              )}
              {(tab === "library" || tab === "ingest") && (
                <div key="content-area" className="relative overflow-hidden">
                  <Suspense fallback={<TabContentLoader />}>
                    <KBErrorBoundary
                      tab="library"
                      onNavigateHome={() => navigateTo("overview")}
                    >
                      <LibraryTab
                        key="library"
                        docsQ={docsQ}
                        selectedStream={selectedStream}
                        streamLabel={streamLabel}
                        onStepComplete={journey.completeStep}
                        focusDocumentId={focusDocumentId}
                        onFocusHandled={() => setFocusDocumentId(undefined)}
                        onNavigate={navigateTo}
                        onAdd={() => navigateTo("ingest")}
                      />
                    </KBErrorBoundary>
                  </Suspense>
                  {/* IngestTab slide-over — stays mounted via CSS transform so
                      file data and upload progress survive tab switches. Keyed
                      by stream so state cannot carry across stream changes. */}
                  <div
                    className={cn(
                      "absolute inset-0 bg-background z-10 overflow-y-auto",
                      "transition-transform duration-300",
                      tab === "ingest" ? "translate-x-0" : "translate-x-full"
                    )}
                  >
                    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/95 backdrop-blur-sm px-6 py-3">
                      <button
                        type="button"
                        onClick={() => navigateTo("library")}
                        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Content
                      </button>
                    </div>
                    <Suspense fallback={<TabContentLoader />}>
                      <KBErrorBoundary
                        tab="ingest"
                        onNavigateHome={() => navigateTo("overview")}
                      >
                        <IngestTab
                          key={`ingest-${streamKey}`}
                          streamName={streamLabel}
                          streamId={selectedStream || undefined}
                          onStepComplete={journey.completeStep}
                          onNavigate={navigateTo}
                        />
                      </KBErrorBoundary>
                    </Suspense>
                  </div>
                </div>
              )}
              {tab === "govern" && (
                <Suspense
                  key={`govern-${governSection}`}
                  fallback={<TabContentLoader />}
                >
                  <KBErrorBoundary
                    tab="govern"
                    onNavigateHome={() => navigateTo("overview")}
                  >
                    <GovernTab
                      key={`govern-${governSection}`}
                      selectedStream={selectedStream}
                      streamLabel={streamLabel}
                      initialView={governSection}
                      onNavigate={navigateTo}
                    />
                  </KBErrorBoundary>
                </Suspense>
              )}
              {tab === "activity" && (
                <Suspense key="activity" fallback={<TabContentLoader />}>
                  <KBErrorBoundary
                    tab="activity"
                    onNavigateHome={() => navigateTo("overview")}
                  >
                    <ActivitiesTab
                      key="activity"
                      selectedStream={selectedStream}
                    />
                  </KBErrorBoundary>
                </Suspense>
              )}
              {tab === "pipelines" && (
                <Suspense key="pipelines" fallback={<TabContentLoader />}>
                  <KBErrorBoundary
                    tab="pipelines"
                    onNavigateHome={() => navigateTo("overview")}
                  >
                    <PipelinesTab
                      key="pipelines"
                      selectedStream={selectedStream}
                      onNavigate={navigateTo}
                    />
                  </KBErrorBoundary>
                </Suspense>
              )}
              {tab === "validate" && (
                <Suspense
                  key={`validate-${validateSection}`}
                  fallback={<TabContentLoader />}
                >
                  <KBErrorBoundary
                    tab="validate"
                    onNavigateHome={() => navigateTo("overview")}
                  >
                    <ValidateTab
                      key={`validate-${validateSection}`}
                      docsQ={docsQ}
                      statsQ={statsQ}
                      streamName={streamLabel}
                      streamDescription={
                        selectedStream
                          ? `Business domain: ${streamLabel}`
                          : undefined
                      }
                      valueStreamId={selectedStream || undefined}
                      initialSection={validateSection}
                      onStepComplete={journey.completeStep}
                      onNavigate={navigateTo}
                    />
                  </KBErrorBoundary>
                </Suspense>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Spotlight is applied via useEffect below */}

      {tourOpen && (
        <div className="fixed bottom-5 right-5 z-40 w-85 max-w-[calc(100vw-2rem)] rounded-xl border border-primary/35 bg-background/95 backdrop-blur-sm shadow-xl ring-1 ring-border/50 overflow-hidden">
          {/* Step number badge */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {tourStepIdx + 1}
            </span>
            <p className="text-xs font-semibold text-primary tracking-wide flex-1">
              {guidedSteps[tourStepIdx]?.title}
            </p>
            <span className="text-xs text-muted-foreground">
              {tourStepIdx + 1}/{totalTourSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-muted mx-4">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{
                width: `${((tourStepIdx + 1) / totalTourSteps) * 100}%`,
              }}
            />
          </div>

          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {guidedSteps[tourStepIdx]?.description}
            </p>

            {/* Action hint — the specific "do this" instruction */}
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 border border-primary/20 px-3 py-2">
              <span className="text-primary text-xs mt-px">&#10132;</span>
              <p className="text-xs font-medium text-foreground">
                {guidedSteps[tourStepIdx]?.action}
              </p>
            </div>

            <p className="text-xs text-muted-foreground italic">
              {guidedSteps[tourStepIdx]?.outcome}
            </p>
          </div>

          <div className="px-4 pb-3 flex items-center justify-between gap-2 border-t border-border/30 pt-2">
            <button
              type="button"
              onClick={() => {
                const nextIdx = Math.max(0, tourStepIdx - 1);
                setTourStepIdx(nextIdx);
                navigateTo(guidedSteps[nextIdx]!.tab);
              }}
              disabled={tourStepIdx === 0}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  document
                    .querySelector(".tour-spotlight")
                    ?.classList.remove("tour-spotlight");
                  try {
                    localStorage.setItem(dismissKey, "1");
                  } catch {
                    /* noop */
                  }
                  setOnboardingDismissed(true);
                  setTourOpen(false);
                }}
                className="rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                End tour
              </button>
              <button
                type="button"
                onClick={() => {
                  document
                    .querySelector(".tour-spotlight")
                    ?.classList.remove("tour-spotlight");
                  const nextIdx = Math.min(totalTourSteps - 1, tourStepIdx + 1);
                  setTourStepIdx(nextIdx);
                  navigateTo(guidedSteps[nextIdx]!.tab);
                  if (tourStepIdx >= totalTourSteps - 1) {
                    setTourOpen(false);
                    try {
                      localStorage.setItem(dismissKey, "1");
                    } catch {
                      /* noop */
                    }
                    setOnboardingDismissed(true);
                  }
                }}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold",
                  k.duoToneAccentSolid,
                  k.duoToneAccentSolidHover
                )}
              >
                {tourStepIdx >= totalTourSteps - 1 ? "Finish" : "Next step"}
              </button>
            </div>
          </div>
        </div>
      )}
    </SidebarInset>
  );
}
