import { type ReactElement, type ReactNode } from "react";
import { RefreshCw, Clock3 } from "lucide-react";
import { Button, cn } from "@hki/ui";
import {
  ActionRow,
  StatusChip,
  SurfaceCard,
  UtilityPill,
  type ChipTone,
} from "./OverviewPrimitives";
import { ReadinessModule } from "./ReadinessModule";
import { type MaturityResult } from "./maturity-model";
import { k } from "../../theme";
import { ContentReadinessCard } from "./cards/ContentReadinessCard";
import { AnswerTrustCard } from "./cards/AnswerTrustCard";
import { ReviewQueueCard } from "./cards/ReviewQueueCard";
import { ConnectedSourcesCard } from "./cards/ConnectedSourcesCard";
import { ComplianceSafetyCard } from "./cards/ComplianceSafetyCard";
import { ContentCurrencyCard } from "./cards/ContentCurrencyCard";
import KnowledgeBookIllustration from "./KnowledgeBookIllustration";

export interface OverviewAction {
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  tone?: "primary" | "secondary";
  icon?: ReactNode;
}

export interface OverviewHeroModel {
  firstName?: string;
  streamLabel: string;
  phaseLabel: string;
  title: string;
  description: string;
  insights: Array<{
    value: string;
    label: string;
    tone?: ChipTone;
  }>;
  primaryAction: OverviewAction;
  secondaryAction: OverviewAction;
  tertiaryAction?: OverviewAction;
  readiness: {
    maturity: MaturityResult;
    stepsCompleted: number;
    totalSteps: number;
    chatHref?: string;
    launchStatus?: {
      label: string;
      tone: ChipTone;
      detail?: string;
    };
  };
}

export interface ContentReadinessCardModel {
  liveCount: number;
  trackedCount: number;
  pendingReviewCount: number;
  readyToPublishCount: number;
  processingCount: number;
  archivedCount: number;
  missingLabelsCount: number;
  topDepartments: Array<{ label: string; value: number }>;
  action: OverviewAction;
}

export interface AnswerTrustCardModel {
  trustScore: number | null;
  retrievalScore: number;
  coverageScore: number;
  avgChunksPerSearch: number;
  lastCheckedLabel: string;
  action: OverviewAction;
}

export interface ReviewQueueCardModel {
  pendingCount: number;
  readyToPublishCount: number;
  failedCount: number;
  runningCount: number;
  oldestPendingLabel: string;
  action: OverviewAction;
}

export interface ConnectedSourcesCardModel {
  total: number;
  activeCount: number;
  pausedCount: number;
  laggingCount: number;
  errorCount: number;
  latestSyncLabel: string;
  action: OverviewAction;
}

export interface ComplianceSafetyCardModel {
  upCount: number;
  serviceCount: number;
  attested: boolean;
  teamConfirmedCount: number;
  llmErrorRate: number | null;
  action: OverviewAction;
}

export interface ContentCurrencyCardModel {
  currentCount: number;
  reviewCount: number;
  staleCount: number;
  unknownCount: number;
  action: OverviewAction;
}

export interface SystemUtilityItem {
  label: string;
  value: string;
  detail?: string;
  tone?: ChipTone;
  icon: typeof Clock3;
}

export interface OverviewPageModel {
  hero: OverviewHeroModel;

  contentReadiness: ContentReadinessCardModel | null;
  answerTrust: AnswerTrustCardModel | null;
  reviewQueue: ReviewQueueCardModel | null;
  connectedSources: ConnectedSourcesCardModel | null;
  complianceSafety: ComplianceSafetyCardModel | null;
  contentCurrency: ContentCurrencyCardModel | null;
  systemItems: SystemUtilityItem[];
  lastUpdatedLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}

// ── Branded hero background ───────────────────────────────────────────────────
// Restrained surface wash plus a quiet schematic book backdrop.

function HeroBrandDecoration() {
  return null;
}

function DashboardBackdrop() {
  return null;
}

function HeroActionButton({
  action,
  emphasis = action.tone === "primary" ? "primary" : "secondary",
}: {
  action: OverviewAction;
  emphasis?: "primary" | "secondary" | "tertiary";
}) {
  if (emphasis === "tertiary") {
    const tertiaryClassName =
      "inline-flex h-9 items-center gap-1.5 rounded-full px-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground";

    if (action.href) {
      return (
        <a
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? "noopener noreferrer" : undefined}
          className={tertiaryClassName}
        >
          {action.icon}
          <span>{action.label}</span>
        </a>
      );
    }

    return (
      <button
        type="button"
        onClick={action.onClick}
        className={tertiaryClassName}
      >
        {action.icon}
        <span>{action.label}</span>
      </button>
    );
  }

  const sharedClassName = cn(
    "h-9 gap-1.5 rounded-md px-3.5 transition-colors duration-150 ease-out",
    emphasis === "primary"
      ? "bg-primary text-primary-foreground hover:bg-primary/90"
      : "border border-border bg-card text-foreground hover:border-foreground/40 hover:bg-muted/40"
  );

  if (action.href) {
    return (
      <Button
        size="sm"
        variant={emphasis === "primary" ? "default" : "outline"}
        asChild
        className={sharedClassName}
      >
        <a
          href={action.href}
          target={action.external ? "_blank" : undefined}
          rel={action.external ? "noopener noreferrer" : undefined}
        >
          {action.icon}
          <span>{action.label}</span>
        </a>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={emphasis === "primary" ? "default" : "outline"}
      onClick={action.onClick}
      className={sharedClassName}
    >
      {action.icon}
      <span>{action.label}</span>
    </Button>
  );
}

const HERO_TITLE_LOCKUPS: Record<
  string,
  {
    lead: string;
    blue?: string;
    red?: string;
  }
> = {
  "set the standard first": {
    lead: "Set the",
    blue: "Standard",
    red: "First",
  },
  "find the open space": {
    lead: "Find the",
    blue: "Open",
    red: "Space",
  },
  "signal your first document": {
    lead: "Signal Your",
    blue: "First",
    red: "Document",
  },
  "shape what goes live": {
    lead: "Shape What",
    blue: "Goes",
    red: "Live",
  },
  "pressure-test the answers": {
    lead: "Pressure-Test",
    blue: "the",
    red: "Answers",
  },
  "keep the signal fresh": {
    lead: "Keep the",
    blue: "Signal",
    red: "Fresh",
  },
  "train an agent your team can trust": {
    lead: "Train an Agent",
    blue: "Your Team",
    red: "Can Trust",
  },
  "keep content current": {
    lead: "Keep Content",
    blue: "Current",
  },
  "build the first trusted sources": {
    lead: "Build the First",
    blue: "Trusted",
    red: "Sources",
  },
  "browse trusted knowledge": {
    lead: "Browse",
    blue: "Trusted",
    red: "Knowledge",
  },
  "content is live": {
    lead: "Content is",
    blue: "Live",
  },
};

function HeroTitleLockup({ title }: { title: string }) {
  const normalizedTitle = title.trim().toLowerCase();
  const preset = HERO_TITLE_LOCKUPS[normalizedTitle];

  if (!title.trim()) return null;

  if (!preset) {
    return (
      <h1 className="max-w-none text-lg font-bold leading-tight tracking-normal text-foreground sm:text-xl lg:text-2xl">
        {title}
      </h1>
    );
  }

  return (
    <h1 className="max-w-none text-lg font-extrabold leading-tight tracking-normal text-foreground sm:text-xl lg:text-2xl">
      <span>{preset.lead}</span>
      {preset.blue ? (
        <>
          {" "}
          <span className={cn("font-extrabold", k.accentText)}>
            {preset.blue}
          </span>
        </>
      ) : null}
      {preset.red ? (
        <>
          {" "}
          <span className={cn("font-extrabold", k.brandRedText)}>
            {preset.red}
          </span>
        </>
      ) : null}
    </h1>
  );
}

function OverviewHero({ hero }: { hero: OverviewHeroModel }) {
  return (
    <SurfaceCard
      variant="default"
      className="kb-overview-hero relative overflow-hidden rounded-[30px] border border-border/30 bg-card px-7 py-6 lg:px-9 lg:py-7 dark:border-white/6 dark:bg-card"
    >
      <HeroBrandDecoration />

      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-stretch">
        {/* ── Left: content ── */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <p className="text-[12px] font-medium text-muted-foreground/78">
            {hero.firstName ? (
              <>
                <span className="text-foreground/56">
                  Welcome back, {hero.firstName}
                </span>
                <span className="mx-2 select-none text-border">&#47;</span>
              </>
            ) : null}
            <span>{hero.streamLabel}</span>
            {hero.phaseLabel &&
              hero.phaseLabel.toLowerCase() !==
                hero.streamLabel.toLowerCase() && (
                <>
                  <span className="mx-2 select-none text-border">&#47;</span>
                  <span className="font-semibold text-primary">
                    {hero.phaseLabel}
                  </span>
                </>
              )}
          </p>

          {/* Title block */}
          <div className="space-y-2.5">
            <HeroTitleLockup title={hero.title} />
            <p className="max-w-[54ch] text-[0.9rem] leading-relaxed text-muted-foreground/90">
              {hero.description}
            </p>
          </div>

          {/* Actions — pushed to bottom */}
          <div className="mt-auto pt-1">
            <ActionRow className="gap-3">
              <HeroActionButton
                action={hero.primaryAction}
                emphasis="primary"
              />
              <HeroActionButton
                action={hero.secondaryAction}
                emphasis="secondary"
              />
              {hero.tertiaryAction && (
                <HeroActionButton
                  action={hero.tertiaryAction}
                  emphasis="tertiary"
                />
              )}
            </ActionRow>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="hidden xl:flex xl:items-stretch xl:px-2">
          <div className="w-px self-stretch bg-linear-to-b from-transparent via-border/50 to-transparent" />
        </div>

        {/* ── Right: Readiness panel ── */}
        <div className="flex shrink-0 items-center xl:w-57">
          <div className="w-full rounded-3xl border border-border/50 bg-background/76 px-3.5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.42),0_10px_18px_-24px_rgba(15,23,42,0.12)] dark:border-white/6 dark:bg-white/3 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            <ReadinessModule
              maturity={hero.readiness.maturity}
              stepsCompleted={hero.readiness.stepsCompleted}
              totalSteps={hero.readiness.totalSteps}
              launchStatus={hero.readiness.launchStatus}
              chatHref={hero.readiness.chatHref}
            />
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}

function OverviewTelemetryDeck({
  systemItems,
  lastUpdatedLabel,
  refreshing,
  onRefresh,
}: Pick<
  OverviewPageModel,
  "systemItems" | "lastUpdatedLabel" | "refreshing" | "onRefresh"
>) {
  const hasAttention = systemItems.some(
    item => item.tone === "warning" || item.tone === "danger"
  );

  return (
    <SurfaceCard
      variant={hasAttention ? "warning" : "tinted"}
      className="flex h-full flex-col gap-4 px-5 py-5"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <ActionRow className="gap-2">
          <StatusChip
            tone={hasAttention ? "warning" : "brand"}
            className="shadow-none"
          >
            Live telemetry
          </StatusChip>
          <StatusChip tone="neutral" className="shadow-none">
            Updated {lastUpdatedLabel}
          </StatusChip>
        </ActionRow>

        <Button
          onClick={onRefresh}
          disabled={refreshing}
          variant="ghost-primary"
          size="sm"
          className="rounded-xl"
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
          />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {systemItems.map(item => (
          <UtilityPill
            key={item.label}
            icon={item.icon}
            label={item.label}
            value={item.value}
            detail={item.detail}
            tone={item.tone}
            className="min-w-0"
          />
        ))}
      </div>
    </SurfaceCard>
  );
}

export function OverviewPage({ model }: { model: OverviewPageModel }) {
  const topHasContentReadiness = Boolean(model.contentReadiness);
  const topHasAnswerTrust = Boolean(model.answerTrust);
  const secondaryCards: ReactElement[] = [
    model.reviewQueue ? (
      <ReviewQueueCard key="reviewQueue" data={model.reviewQueue} />
    ) : null,
    model.connectedSources ? (
      <ConnectedSourcesCard
        key="connectedSources"
        data={model.connectedSources}
      />
    ) : null,
    model.complianceSafety ? (
      <ComplianceSafetyCard
        key="complianceSafety"
        data={model.complianceSafety}
      />
    ) : null,
  ].filter((card): card is ReactElement => card !== null);
  const secondarySpanClass =
    secondaryCards.length <= 1
      ? "xl:col-span-12"
      : secondaryCards.length === 2
        ? "xl:col-span-6"
        : "xl:col-span-4";
  const showTelemetryDeck = model.systemItems.length > 0;

  return (
    <div className="relative isolate w-full max-w-none pb-8">
      <DashboardBackdrop />

      <div className="relative space-y-5">
        <OverviewHero hero={model.hero} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {model.contentReadiness ? (
            <div
              className={cn(
                "min-w-0",
                topHasAnswerTrust ? "xl:col-span-7" : "xl:col-span-12"
              )}
            >
              <ContentReadinessCard data={model.contentReadiness} />
            </div>
          ) : null}
          {model.answerTrust ? (
            <div
              className={cn(
                "min-w-0",
                topHasContentReadiness ? "xl:col-span-5" : "xl:col-span-12"
              )}
            >
              <AnswerTrustCard data={model.answerTrust} />
            </div>
          ) : null}

          {secondaryCards.map((card, index) => (
            <div
              key={card.key ?? index}
              className={cn("min-w-0", secondarySpanClass)}
            >
              {card}
            </div>
          ))}

          {model.contentCurrency ? (
            <div
              className={cn(
                "min-w-0",
                showTelemetryDeck ? "xl:col-span-5" : "xl:col-span-12"
              )}
            >
              <ContentCurrencyCard data={model.contentCurrency} />
            </div>
          ) : null}
          {showTelemetryDeck ? (
            <div
              className={cn(
                "min-w-0",
                model.contentCurrency ? "xl:col-span-7" : "xl:col-span-12"
              )}
            >
              <OverviewTelemetryDeck
                systemItems={model.systemItems}
                lastUpdatedLabel={model.lastUpdatedLabel}
                refreshing={model.refreshing}
                onRefresh={model.onRefresh}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
