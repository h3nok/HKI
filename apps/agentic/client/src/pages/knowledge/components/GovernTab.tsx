/**
 * Govern Tab — Review workflow, team access, and compliance
 *
 * Sub-views:
 *  - Review: full review workflow (submit → decide → publish) with quality reports
 *  - Team: invite management, role assignment
 *  - Compliance: attestation tracking, review audit trail, LLM observability
 */

import {
  useCallback,
  useEffect,
  lazy,
  Suspense,
  useMemo,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Users,
  FileCheck,
  Loader2,
  UserPlus,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { cn, Button } from "@hki/ui";
import { trpc } from "@/lib/trpc";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { k } from "../theme";
import type { GovernSection, KnowledgeTab } from "../types";
import { KBTopBar, KBWorkflowBanner } from "./kb-primitives";
import {
  getAvailableGovernSections,
  getAvailableValidateSections,
} from "../feature-gates";

// ── Lazy-loaded sub-views ───────────────────────────────────────────────────
const ReviewTab = lazy(() => import("./ReviewTab"));
const TeamTab = lazy(() => import("./TeamTab"));
const ComplianceTab = lazy(() => import("./ComplianceTab"));
// ── Sub-view definitions ────────────────────────────────────────────────────

export type GovernView = GovernSection;

interface SubViewDef {
  key: GovernView;
  label: string;
  icon: typeof Shield;
}

const SUB_VIEWS: SubViewDef[] = [
  { key: "review", label: "📋 Review Queue", icon: Shield },
  { key: "team", label: "👥 Users & Access", icon: Users },
  { key: "compliance", label: "✅ Compliance", icon: FileCheck },
];

const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

// ── Loading fallback ────────────────────────────────────────────────────────

function SubViewLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

interface GovernTabProps {
  selectedStream: string;
  streamLabel: string;
  initialView?: GovernView;
  onNavigate?: (tab: KnowledgeTab, section?: string) => void;
}

export default function GovernTab({
  selectedStream,
  streamLabel,
  initialView,
  onNavigate,
}: GovernTabProps) {
  const { canView: canViewFeature } = useFeatureAccess();
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const availableViews = useMemo(
    () => getAvailableGovernSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const canManageReviewAssignments = isFeatureEnabled(
    "release.knowledge.govern.reviewAssignments"
  );
  const canViewTeam = availableViews.includes("team");
  const availableValidateSections = useMemo(
    () => getAvailableValidateSections(isFeatureEnabled),
    [isFeatureEnabled]
  );
  const canRunValidateTest = availableValidateSections.includes("test");
  const [view, setView] = useState<GovernView>(
    initialView ?? availableViews[0] ?? "review"
  );

  // Sync from parent only when initialView explicitly changes
  useEffect(() => {
    if (initialView && availableViews.includes(initialView)) {
      setView(initialView);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialView]);

  // If the current view is disabled, fall back to the first available
  useEffect(() => {
    if (!availableViews.includes(view) && availableViews[0]) {
      setView(availableViews[0]);
    }
  }, [availableViews, view]);

  // Pending review count for badge
  const reviewQ = trpc.knowledge.reviewListPending.useQuery(
    selectedStream
      ? { limit: 50, valueStreamId: selectedStream }
      : { limit: 50 },
    { retry: false }
  );
  const pendingCount = (
    (reviewQ.data ?? []) as Array<{ streamId?: string | null }>
  ).filter(
    record =>
      !selectedStream || !record.streamId || record.streamId === selectedStream
  ).length;
  const reviewAllQ = trpc.knowledge.reviewListAll.useQuery(
    selectedStream
      ? { limit: 100, valueStreamId: selectedStream }
      : { limit: 100 },
    { retry: false }
  );
  const reviewRecords = reviewAllQ.data ?? [];
  const approvedCount = reviewRecords.filter(
    (record: any) =>
      (!selectedStream ||
        !record.streamId ||
        record.streamId === selectedStream) &&
      record.status === "approved"
  ).length;
  const publishedCount = reviewRecords.filter(
    (record: any) =>
      (!selectedStream ||
        !record.streamId ||
        record.streamId === selectedStream) &&
      record.status === "published"
  ).length;
  const createGovernSectionAction = useCallback(
    (
      section: GovernView,
      options: {
        emphasis: "primary" | "secondary";
      }
    ) => {
      if (section === view || !availableViews.includes(section)) {
        return undefined;
      }

      const config = {
        review: { label: "Open review queue", icon: Landmark },
        team: { label: "Manage users & access", icon: Users },
        compliance: { label: "Open compliance", icon: FileCheck },
      } as const;
      const target = config[section];

      return {
        id: `govern:${section}`,
        action: {
          label: target.label,
          onClick: () => setView(section),
          icon: target.icon,
          tone:
            options.emphasis === "secondary"
              ? ("secondary" as const)
              : undefined,
          testId:
            options.emphasis === "primary"
              ? "kb-govern-workflow-primary"
              : "kb-govern-workflow-secondary",
        },
      };
    },
    [availableViews, view]
  );

  const createValidateTestAction = useCallback(
    (emphasis: "primary" | "secondary") => {
      if (!onNavigate || !canRunValidateTest) {
        return undefined;
      }

      return {
        id: "validate:test",
        action: {
          label: "Test answers",
          onClick: () => onNavigate("validate", "test"),
          icon: ShieldCheck,
          tone: emphasis === "secondary" ? ("secondary" as const) : undefined,
          testId:
            emphasis === "primary"
              ? "kb-govern-workflow-primary"
              : "kb-govern-workflow-secondary",
        },
      };
    },
    [canRunValidateTest, onNavigate]
  );

  const governWorkflow = useMemo(() => {
    const pickSecondaryGovernAction = (
      sections: GovernView[],
      excludedIds: string[] = []
    ) => {
      for (const section of sections) {
        const candidate = createGovernSectionAction(section, {
          emphasis: "secondary",
        });
        if (candidate && !excludedIds.includes(candidate.id)) {
          return candidate.action;
        }
      }

      return undefined;
    };

    if (pendingCount > 0) {
      const primaryAction =
        createGovernSectionAction("review", { emphasis: "primary" }) ??
        (view === "review" ? createValidateTestAction("primary") : undefined);

      return {
        statusLabel: `${pendingCount} waiting review`,
        statusTone: "amber" as const,
        title: "Clear the review queue",
        description: "Approve or request changes, then publish.",
        primaryAction: primaryAction?.action,
        secondaryAction: pickSecondaryGovernAction(
          ["team", "compliance"],
          [primaryAction?.id ?? ""]
        ),
      };
    }

    if (approvedCount > 0) {
      const primaryAction = createGovernSectionAction("review", {
        emphasis: "primary",
      });

      return {
        statusLabel: `${approvedCount} ready to publish`,
        statusTone: "blue" as const,
        title: "Approved content ready to publish",
        description: "Publish approved docs and confirm access before rollout.",
        primaryAction: primaryAction?.action,
        secondaryAction: pickSecondaryGovernAction(
          ["team", "compliance"],
          [primaryAction?.id ?? ""]
        ),
      };
    }

    const primaryAction =
      createGovernSectionAction("team", { emphasis: "primary" }) ??
      (view === "team" ? createValidateTestAction("primary") : undefined);

    return {
      statusLabel:
        publishedCount > 0 ? "Governance in good shape" : "Set your controls",
      statusTone: publishedCount > 0 ? ("green" as const) : ("blue" as const),
      title:
        publishedCount > 0
          ? "Governance is clear"
          : "Set up users, access, and compliance",
      description:
        publishedCount > 0
          ? "Review queue clear. Maintain access and compliance."
          : "Configure user access, curation ownership, and compliance before rollout.",
      primaryAction: primaryAction?.action,
      secondaryAction: pickSecondaryGovernAction(
        ["compliance", "review"],
        [primaryAction?.id ?? ""]
      ),
    };
  }, [
    approvedCount,
    createGovernSectionAction,
    createValidateTestAction,
    pendingCount,
    publishedCount,
    view,
  ]);

  return (
    <div className="w-full min-h-[calc(100vh-200px)]" data-tour="govern-queue">
      <motion.div {...fadeIn} className="w-full space-y-5">
        <KBWorkflowBanner
          testId="kb-govern-workflow-banner"
          icon={
            view === "team" ? Users : view === "compliance" ? FileCheck : Shield
          }
          tone="amber"
          eyebrow="Workflow Step 6"
          title={governWorkflow.title}
          description={governWorkflow.description}
          statusLabel={governWorkflow.statusLabel}
          statusTone={governWorkflow.statusTone}
          primaryAction={governWorkflow.primaryAction}
          secondaryAction={governWorkflow.secondaryAction}
        />

        {/* ── Unified top bar ── */}
        <KBTopBar
          tabs={SUB_VIEWS.filter(sv => availableViews.includes(sv.key)).map(
            sv => ({
              key: sv.key,
              label: sv.label,
              icon: sv.icon,
              badge: sv.key === "review" ? pendingCount : undefined,
            })
          )}
          activeTab={view}
          onTabChange={setView}
          tabsAriaLabel="Governance sections"
          actions={
            view === "review" && canViewTeam && canManageReviewAssignments ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => setView("team")}
              >
                <UserPlus className="h-3 w-3" />
                Invite
              </Button>
            ) : undefined
          }
        />

        {/* ── Content ── */}
        <Suspense fallback={<SubViewLoader />}>
          <AnimatePresence mode="wait">
            {view === "review" && (
              <motion.div
                key="review"
                {...fadeIn}
                role="tabpanel"
                id="govern-panel-review"
                aria-labelledby="govern-tab-review"
              >
                <ReviewTab
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                />
              </motion.div>
            )}
            {view === "team" && (
              <motion.div
                key="team"
                {...fadeIn}
                role="tabpanel"
                id="govern-panel-team"
                aria-labelledby="govern-tab-team"
              >
                <TeamTab
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                />
              </motion.div>
            )}
            {view === "compliance" && (
              <motion.div
                key="compliance"
                {...fadeIn}
                role="tabpanel"
                id="govern-panel-compliance"
                aria-labelledby="govern-tab-compliance"
              >
                <ComplianceTab
                  selectedStream={selectedStream}
                  streamLabel={streamLabel}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </motion.div>
    </div>
  );
}
