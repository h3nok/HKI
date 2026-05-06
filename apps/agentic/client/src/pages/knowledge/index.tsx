/**
 * Knowledge Self-Service — Sidebar layout at /knowledge
 *
 * Auth: knowledge-enabled roles
 * Layout: SidebarProvider + Sidebar + SidebarInset (matches admin pattern)
 * State: KnowledgeContext shares activeTab + selectedStream between sidebar & content
 *
 * This file is the entry point only — all layout, navigation, and content
 * logic lives in the extracted modules under layout/, context/, and config/.
 */

import {
  type ReactNode,
  useState,
  useMemo,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  startTransition,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Layers,
  Lock,
  Plus,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Button, cn, HKI_IRIS, StreamIcon } from "@hki/ui";
import type { FeatureFlagKey } from "@shared/feature-flags";
import { Redirect, useLocation, useSearch } from "wouter";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { useScope } from "@/_core/hooks/useScope";
import { claimKnowledgeWorkspaceWindow } from "@/_core/workspace-navigation";
import {
  canAccessKnowledgeWorkspace,
  canManageKnowledgeWorkspace,
  canSwitchKnowledgeStreams,
  getAllowedKnowledgeTabs,
  getDefaultKnowledgeTab,
  isKnowledgeTabAllowed,
} from "@/_core/access/knowledge";
import { trpc } from "@/lib/trpc";
import type { GovernSection, KnowledgeTab } from "./types";
import { k } from "./theme";
import { getAvailableKnowledgeTabs } from "./feature-gates";
import { KnowledgeCtx, type KnowledgeState } from "./context/KnowledgeContext";
import KnowledgeSidebar from "./layout/KnowledgeSidebar";
import KnowledgeContent from "./layout/KnowledgeContent";
import KnowledgeLoader from "./components/KnowledgeLoader";

const DriveOrganizeGuide = lazy(
  () => import("./components/DriveOrganizeGuide")
);

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE PAGE — Auth guard → context provider → SidebarProvider shell
// ═══════════════════════════════════════════════════════════════════════════════

export default function KnowledgePage() {
  const { role } = usePermissions();

  const allowed = canAccessKnowledgeWorkspace(role);
  if (!allowed) {
    return <Redirect to="/welcome" />;
  }

  return <KnowledgeShell />;
}

// ── Favicon + title side effect ──────────────────────────────────────────────

function useKBBranding() {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    const prevHref = link?.href;
    const prevTitle = document.title;
    if (link) link.href = "/favicon-knowledge.svg";
    document.title = "Knowledge Domains — Hermetic";
    return () => {
      if (link && prevHref) link.href = prevHref;
      document.title = prevTitle;
    };
  }, []);
}

function buildKnowledgeStreamHref(streamId?: string | null) {
  const normalized = streamId?.trim();
  if (!normalized || normalized === "global") return "/knowledge";
  return `/knowledge?stream=${encodeURIComponent(normalized)}`;
}

function KnowledgeGateCard({
  badge,
  title,
  description,
  actions,
  children,
  icon: Icon = Lock,
}: {
  badge: string;
  title: ReactNode;
  description: ReactNode;
  actions: ReactNode;
  children?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className={cn("min-h-svh", k.ground, "px-6 py-10 text-foreground")}>
      <div className="mx-auto flex min-h-[60vh] max-w-4xl items-center justify-center">
        <div className={cn("w-full rounded-[28px] px-8 py-8", k.card)}>
          <div className="flex flex-col gap-6">
            <div className="flex items-start gap-4">
              <div className="relative shrink-0">
                <div
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15",
                    k.duoToneFill,
                    k.duoToneShadowSoft
                  )}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center rounded-full border border-primary/18 bg-primary/8 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                  {badge}
                </div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                  {title}
                </h1>
                <div className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                  {description}
                </div>
              </div>
            </div>

            {children ? (
              <div
                className={cn(
                  "rounded-2xl border border-border/60 p-4",
                  k.inset
                )}
              >
                {children}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">{actions}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HKI EXPLAINER — educational callout for domain isolation
// ═══════════════════════════════════════════════════════════════════════════════

const HVSI_STORAGE_KEY = "kb-hvsi-explainer-dismissed";

const HVSI_POINTS = [
  {
    title: "One domain, one active boundary",
    detail:
      "Every document, chunk, and retrieval request belongs to exactly one active domain. No cross-domain bleed.",
  },
  {
    title: "Fail closed",
    detail:
      "If a domain is missing or unauthorized the request fails — no silent fallback to a global scope.",
  },
  {
    title: "Shared knowledge uses replication",
    detail:
      "If a policy applies to multiple domains it is published as domain-specific copies, never a shared wildcard record.",
  },
];

function HvsiExplainer() {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      return sessionStorage.getItem(HVSI_STORAGE_KEY) !== "1";
    } catch {
      return true;
    }
  });

  const toggle = () => {
    setIsOpen(prev => {
      const next = !prev;
      try {
        sessionStorage.setItem(HVSI_STORAGE_KEY, next ? "0" : "1");
      } catch {
        /* noop */
      }
      return next;
    });
  };

  return (
    <div className={cn("mt-6 rounded-2xl", k.card)}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-expanded={isOpen}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: `color-mix(in srgb, ${HKI_IRIS} 12%, transparent)`,
          }}
        >
          <ShieldCheck className="h-4 w-4" style={{ color: HKI_IRIS }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={k.heading}>
            <span style={{ color: HKI_IRIS }}>Hermetic</span>{" "}
            <span className="text-foreground">Domain</span> Isolation
            <span className={cn("ml-1.5", k.muted)}>(HKI)</span>
          </p>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {isOpen ? (
        <div className="space-y-4 border-t border-border/40 px-5 pb-5 pt-4">
          <p className={k.subtext}>
            This platform enforces hermetic isolation — each domain is a sealed
            boundary. Documents, retrieval, and ingestion never cross domain
            lines at runtime.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {HVSI_POINTS.map((point, i) => (
              <div key={point.title} className={cn("rounded-xl p-4", k.inset)}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                      k.duoToneFill,
                      k.duoToneAccentText
                    )}
                  >
                    {i + 1}
                  </span>
                  <p className={k.heading}>{point.title}</p>
                </div>
                <p className={cn(k.muted, "mt-2 leading-5")}>{point.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN LANDING — hermetic entry point for domain selection
// ═══════════════════════════════════════════════════════════════════════════════

function StreamLandingPage({
  streams,
  firstScopedStream,
  canManage,
  onNavigate,
}: {
  streams: Array<{ id: string; name?: string | null; icon?: string }>;
  firstScopedStream: string;
  canManage: boolean;
  onNavigate: (path: string) => void;
}) {
  const hasStreams = streams.length > 0;

  return (
    <div className={cn("min-h-svh", k.ground)}>
      {/* ── Top bar ────────────────────────────────────────────────── */}
      <header
        className={cn(
          "sticky top-0 z-30 flex items-center justify-between border-b border-border/40 px-6 py-3",
          k.card
        )}
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              k.duoToneFill
            )}
          >
            <BookOpen className="h-4 w-4" />
          </div>
          <span className={k.heading}>Knowledge Domains</span>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onNavigate("/knowledge/create")}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Domain
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onNavigate("/welcome")}
            className="gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        </div>
      </header>

      {/* ── Page body ──────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Hero */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-primary/18 bg-primary/8 px-2.5 py-0.5 text-xs font-semibold",
                k.duoToneAccentText
              )}
            >
              <Layers className="h-3 w-3" />
              {hasStreams
                ? `${streams.length} domain${streams.length === 1 ? "" : "s"}`
                : "Get started"}
            </div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Select a <span className={k.accentText}>domain</span>
          </h1>
          <p className={cn(k.subtext, "max-w-xl")}>
            Knowledge opens one active domain at a time. Pick a domain below to
            start curating content.
          </p>
        </div>

        {/* ── HVSI explainer ─────────────────────────────────────── */}
        <HvsiExplainer />

        {/* ── Stream grid ────────────────────────────────────────── */}
        {hasStreams ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {streams.slice(0, 12).map(scope => {
              const isPrimary = scope.id === firstScopedStream;
              const label = scope.name || scope.id;

              return (
                <a
                  key={scope.id}
                  href={buildKnowledgeStreamHref(scope.id)}
                  className={cn(
                    "group relative flex flex-col gap-4 rounded-2xl p-5 transition-all",
                    k.card,
                    isPrimary
                      ? cn("ring-1 ring-primary/20", k.duoToneShadowSoft)
                      : cn(k.duoToneBorderHoverSoft, "hover:shadow-md")
                  )}
                >
                  {/* Stream icon + name */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          isPrimary
                            ? cn(k.duoToneFill, k.duoToneShadowSoft)
                            : k.inset
                        )}
                      >
                        <StreamIcon
                          id={scope.icon ?? "building"}
                          size={22}
                          className={isPrimary ? "" : "opacity-70"}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className={cn(k.heading, "truncate")}>{label}</p>
                        <p className={cn(k.muted, "mt-0.5 truncate")}>
                          {scope.id}
                        </p>
                      </div>
                    </div>
                    {isPrimary ? (
                      <span
                        className={cn(
                          "shrink-0 rounded-full border border-primary/20 bg-primary/8 px-2 py-0.5 text-[10px] font-semibold",
                          k.duoToneAccentText
                        )}
                      >
                        Recent
                      </span>
                    ) : null}
                  </div>

                  {/* CTA row */}
                  <div className="mt-auto flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isPrimary
                          ? k.duoToneAccentText
                          : "text-muted-foreground group-hover:text-foreground"
                      )}
                    >
                      Open domain
                    </span>
                    <ArrowRight
                      className={cn(
                        "h-4 w-4 transition-transform group-hover:translate-x-0.5",
                        isPrimary
                          ? k.duoToneAccentText
                          : "text-muted-foreground/50 group-hover:text-foreground"
                      )}
                    />
                  </div>
                </a>
              );
            })}

            {/* Create new domain card (admin only) */}
            {canManage ? (
              <button
                type="button"
                onClick={() => onNavigate("/knowledge/create")}
                className={cn(
                  "group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border/60 p-5 transition-colors",
                  "hover:border-primary/30 hover:bg-primary/4",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 transition-colors",
                    "group-hover:border-primary/30 group-hover:bg-primary/8"
                  )}
                >
                  <Plus className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                  New domain
                </p>
              </button>
            ) : null}
          </div>
        ) : (
          /* ── Empty state ────────────────────────────────────── */
          <div
            className={cn(
              "mt-8 flex flex-col items-center gap-5 rounded-2xl py-14",
              k.card
            )}
          >
            <div
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-2xl",
                k.inset
              )}
            >
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="max-w-sm text-center">
              <p className={k.heading}>No domains available</p>
              <p className={cn(k.muted, "mt-1.5")}>
                {canManage
                  ? "Create a domain to start curating knowledge for your team."
                  : "Ask an admin to create or assign a domain for you."}
              </p>
            </div>
            {canManage ? (
              <Button
                type="button"
                onClick={() => onNavigate("/knowledge/create")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Create domain
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHELL — State, context provider, sidebar + content layout
// ═══════════════════════════════════════════════════════════════════════════════

function KnowledgeShell() {
  useKBBranding();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const { role } = usePermissions();
  const canManageKnowledge = canManageKnowledgeWorkspace(role);
  const { canView: canViewFeature, isLoading: isFeatureAccessLoading } =
    useFeatureAccess();
  const { availableScopes } = useScope();
  const isAdmin = role === "admin";
  const isFeatureEnabled = useCallback(
    (key: FeatureFlagKey) => canViewFeature(key),
    [canViewFeature]
  );
  const allowedTabs = useMemo(() => getAllowedKnowledgeTabs(role), [role]);
  const availableTabs = useMemo(
    () =>
      getAvailableKnowledgeTabs({
        allowedTabs,
        canManageKnowledge,
        isEnabled: isFeatureEnabled,
      }),
    [allowedTabs, canManageKnowledge, isFeatureEnabled]
  );

  useEffect(() => {
    claimKnowledgeWorkspaceWindow();
  }, []);

  const urlParams = useMemo(
    () => new URLSearchParams(searchString),
    [searchString]
  );
  const urlStream = urlParams.get("stream")?.trim() || "";
  const urlTab = urlParams.get("tab")?.trim() || null;
  const isStreamLocked = !!urlStream && urlStream !== "global";
  const defaultTab = useMemo(
    () => availableTabs[0] ?? getDefaultKnowledgeTab(role),
    [availableTabs, role]
  );
  const normalizeTab = useCallback(
    (candidate?: string | null): KnowledgeTab => {
      if (
        candidate &&
        isKnowledgeTabAllowed(role, candidate as KnowledgeTab) &&
        availableTabs.includes(candidate as KnowledgeTab)
      ) {
        return candidate as KnowledgeTab;
      }
      return defaultTab;
    },
    [availableTabs, defaultTab, role]
  );

  const canSwitchStreams = canSwitchKnowledgeStreams(role);
  const nonGlobalAvailableScopes = useMemo(
    () => availableScopes.filter(scope => scope.id !== "global"),
    [availableScopes]
  );
  const firstScopedScope = useMemo(
    () => nonGlobalAvailableScopes[0] ?? null,
    [nonGlobalAvailableScopes]
  );
  const firstScopedStream = useMemo(() => {
    return firstScopedScope?.id ?? "";
  }, [firstScopedScope]);
  const defaultStream = urlStream && urlStream !== "global" ? urlStream : "";

  const [tab, setTab] = useState<KnowledgeTab>(() => {
    if (urlTab) {
      return normalizeTab(urlTab);
    }

    try {
      const saved = sessionStorage.getItem("knowledge-active-tab");
      if (saved && isKnowledgeTabAllowed(role, saved as KnowledgeTab)) {
        return saved as KnowledgeTab;
      }
    } catch {
      /* noop */
    }
    return defaultTab;
  });
  const [selectedStream, setSelectedStream] = useState<string>(defaultStream);
  const [governSection, setGovernSection] = useState<GovernSection>("review");

  useEffect(() => {
    if (defaultStream === selectedStream) return;
    setSelectedStream(defaultStream);
  }, [defaultStream, selectedStream]);

  const streamLabel = useMemo(() => {
    if (!selectedStream) return "Select a Stream";
    const scope = availableScopes.find(entry => entry.id === selectedStream);
    return scope?.name || selectedStream;
  }, [selectedStream, availableScopes]);

  const streamId = selectedStream;
  const attestQ = trpc.knowledge.getAttestation.useQuery(
    { valueStreamId: streamId || "" },
    {
      retry: false,
      refetchOnWindowFocus: false,
      enabled: Boolean(streamId),
    }
  );

  const isAttested = attestQ.data?.attested ?? false;
  const attestedAt = attestQ.data?.attestedAt ?? null;
  const [showGuide, setShowGuide] = useState(false);

  const onOpenGuide = () => {
    if (!canManageKnowledge) return;
    setShowGuide(true);
  };
  const onCloseGuide = () => {
    setShowGuide(false);
    attestQ.refetch();
  };

  const handleSelectedStreamChange = useCallback(
    (nextStream: string) => {
      const normalized = nextStream.trim();
      if (normalized !== defaultStream) {
        setLocation(buildKnowledgeStreamHref(normalized));
        return;
      }
      startTransition(() => {
        setSelectedStream(normalized);
      });
    },
    [defaultStream, setLocation]
  );

  const persistTab = useCallback(
    (nextTabCandidate: KnowledgeTab) => {
      const nextTab = normalizeTab(nextTabCandidate);
      startTransition(() => {
        setTab(nextTab);
      });
      try {
        sessionStorage.setItem("knowledge-active-tab", nextTab);
      } catch {
        /* noop */
      }
    },
    [normalizeTab]
  );

  useEffect(() => {
    if (isFeatureAccessLoading) return;

    const nextTab = normalizeTab(tab);
    if (nextTab === tab) return;
    setTab(nextTab);
    try {
      sessionStorage.setItem("knowledge-active-tab", nextTab);
    } catch {
      /* noop */
    }
  }, [isFeatureAccessLoading, normalizeTab, tab]);

  const ctx: KnowledgeState = {
    tab,
    setTab: persistTab,
    governSection,
    setGovernSection,
    selectedStream,
    setSelectedStream:
      !isStreamLocked && canSwitchStreams
        ? handleSelectedStreamChange
        : () => {},
    streamLabel,
    isStreamLocked,
    isAdmin,
    onOpenGuide,
    isAttested,
    isAttestationLoading: attestQ.isLoading,
    attestedAt,
  };

  if (isFeatureAccessLoading) {
    return <KnowledgeLoader />;
  }

  if (!isFeatureAccessLoading && availableTabs.length === 0) {
    return (
      <KnowledgeGateCard
        badge="Domain unavailable"
        title="Knowledge tabs are turned off"
        description="Your account can still access Knowledge, but this deployment currently has every Knowledge tab disabled."
        actions={
          <>
            {isAdmin ? (
              <Button
                type="button"
                onClick={() => setLocation("/admin/settings")}
              >
                Open Settings
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => setLocation("/welcome")}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Welcome
            </Button>
          </>
        }
      />
    );
  }

  if (!selectedStream || selectedStream === "global") {
    return (
      <StreamLandingPage
        streams={nonGlobalAvailableScopes}
        firstScopedStream={firstScopedStream}
        canManage={canManageKnowledge}
        onNavigate={setLocation}
      />
    );
  }

  if (showGuide) {
    return (
      <KnowledgeCtx.Provider value={ctx}>
        <SidebarProvider className="knowledge-sidebar">
          <KnowledgeSidebar />
          <SidebarInset className={cn("min-h-svh overflow-y-auto", k.ground)}>
            <Suspense fallback={<KnowledgeLoader />}>
              <DriveOrganizeGuide
                streamLabel={streamLabel}
                valueStreamId={streamId}
                onBack={onCloseGuide}
              />
            </Suspense>
          </SidebarInset>
        </SidebarProvider>
      </KnowledgeCtx.Provider>
    );
  }

  return (
    <KnowledgeCtx.Provider value={ctx}>
      <SidebarProvider className="knowledge-sidebar">
        <KnowledgeSidebar />
        <KnowledgeContent />
      </SidebarProvider>
    </KnowledgeCtx.Provider>
  );
}
