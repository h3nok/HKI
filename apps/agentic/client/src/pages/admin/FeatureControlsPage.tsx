import { useMemo, useState } from "react";
import {
  Gauge,
  Layers,
  Search,
  Shield,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@hki/ui";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  getFeatureFlagDependencyIssues,
  type FeatureFlagDependencyIssue,
  type FeatureFlagKey,
} from "@shared/feature-flags";
import { a } from "./theme";
import { CATEGORY_META } from "./constants";
import { featureMatchesSearch } from "./utils";
import type {
  AdminUserSnapshot,
  FeatureFlagAuditEvent,
  FeatureFlagListItem,
  FeatureFlagPresetItem,
  FeatureTab,
  SettingsTabNavItem,
} from "./types";
import {
  DebugSessionCard,
  FeatureListCard,
  RolloutActivityCard,
  RolloutHealthCard,
  SettingsAreaCard,
  SettingsRail,
} from "./components";

export default function FeatureControlsPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [activeTab, setActiveTab] = useState<FeatureTab>("overview");

  // ── Queries ──────────────────────────────────────────────────────────
  const viewerContextQuery = trpc.auth.viewerContext.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const presetsQuery = trpc.admin.listFeatureFlagPresets.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const flagsQuery = trpc.admin.listFeatureFlags.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const featureAuditQuery = trpc.admin.listFeatureFlagAuditEvents.useQuery(
    { limit: 8 },
    { retry: false, refetchOnWindowFocus: false }
  );
  const usersQuery = trpc.admin.listUsers.useQuery(
    { limit: 100 },
    { retry: false, refetchOnWindowFocus: false }
  );
  const streamsQuery = trpc.admin.listValueStreams.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // ── Mutations ────────────────────────────────────────────────────────
  const setOverrideMutation = trpc.admin.setFeatureFlagOverride.useMutation({
    onMutate: v => setPendingKey(v.featureKey),
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlags.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
        utils.auth.viewerContext.invalidate(),
      ]);
    },
    onError: e => toast.error(e.message || "Failed to update feature flag"),
    onSettled: () => setPendingKey(null),
  });

  const resetOverrideMutation = trpc.admin.resetFeatureFlagOverride.useMutation(
    {
      onMutate: v => setPendingKey(v.featureKey),
      onSuccess: async () => {
        await Promise.all([
          utils.admin.listFeatureFlags.invalidate(),
          utils.admin.listFeatureFlagAuditEvents.invalidate(),
          utils.auth.viewerContext.invalidate(),
        ]);
      },
      onError: e =>
        toast.error(e.message || "Failed to reset feature flag override"),
      onSettled: () => setPendingKey(null),
    }
  );

  const startDebugSessionMutation = trpc.auth.startDebugSession.useMutation({
    onSuccess: async () => {
      await utils.auth.viewerContext.invalidate();
      toast.success("Debug session activated");
    },
    onError: e => toast.error(e.message || "Failed to activate debug session"),
  });

  const stopDebugSessionMutation = trpc.auth.stopDebugSession.useMutation({
    onSuccess: async () => {
      await utils.auth.viewerContext.invalidate();
      toast.success("Debug session cleared");
    },
    onError: e => toast.error(e.message || "Failed to clear debug session"),
  });

  // ── Derived data ─────────────────────────────────────────────────────
  const featureItems = (flagsQuery.data ?? []) as FeatureFlagListItem[];
  const featurePresets = (presetsQuery.data ?? []) as FeatureFlagPresetItem[];
  const debugSession = viewerContextQuery.data?.debugSession ?? null;
  const isDebugSessionActive = Boolean(debugSession?.active);
  const isDebugSessionPending =
    startDebugSessionMutation.isPending || stopDebugSessionMutation.isPending;

  const currentEffectiveFlags = useMemo(
    () =>
      new Map<FeatureFlagKey, boolean>(
        featureItems.map(item => [item.key, item.effectiveEnabled])
      ),
    [featureItems]
  );

  const rolloutIssues = useMemo(
    () =>
      getFeatureFlagDependencyIssues(
        Object.fromEntries(currentEffectiveFlags.entries()) as Partial<
          Record<FeatureFlagKey, boolean>
        >
      ),
    [currentEffectiveFlags]
  );

  const featureIssueMap = useMemo(() => {
    const issueMap = new Map<FeatureFlagKey, FeatureFlagDependencyIssue[]>();
    for (const issue of rolloutIssues) {
      for (const featureKey of issue.featureKeys) {
        const existing = issueMap.get(featureKey) ?? [];
        if (existing.some(e => e.id === issue.id)) continue;
        existing.push(issue);
        issueMap.set(featureKey, existing);
      }
    }
    return issueMap;
  }, [rolloutIssues]);

  const deploymentPresets = useMemo(
    () =>
      featurePresets.map(preset => ({
        ...preset,
        matchesCurrent: Object.entries(preset.overrides).every(
          ([featureKey, enabled]) =>
            currentEffectiveFlags.get(featureKey as FeatureFlagKey) === enabled
        ),
      })),
    [currentEffectiveFlags, featurePresets]
  );

  const filteredFeatureItems = useMemo(
    () => featureItems.filter(item => featureMatchesSearch(item, searchValue)),
    [featureItems, searchValue]
  );

  const releaseItems = useMemo(
    () => filteredFeatureItems.filter(item => item.category === "release"),
    [filteredFeatureItems]
  );

  const debugItems = useMemo(
    () => filteredFeatureItems.filter(item => item.category === "debug"),
    [filteredFeatureItems]
  );

  const enabledReleaseCount = releaseItems.filter(
    item => item.effectiveEnabled
  ).length;
  const adminOverrideCount = featureItems.filter(
    item => item.source === "admin_override"
  ).length;
  const enabledDebugCount = featureItems.filter(
    item => item.category === "debug" && item.effectiveEnabled
  ).length;
  const rolloutIssueCount = rolloutIssues.length;
  const activePreset = deploymentPresets.find(p => p.matchesCurrent);
  const configuredStreams = useMemo(
    () => (streamsQuery.data ?? []).filter(s => s.id !== "global"),
    [streamsQuery.data]
  );
  const totalUsers = usersQuery.data?.total ?? 0;
  const loadedUsers = (usersQuery.data?.users ?? []) as AdminUserSnapshot[];
  const activeUsers = loadedUsers.filter(u => u.isActive).length;
  const adminUsers = loadedUsers.filter(u => u.role === "admin").length;
  const managerUsers = loadedUsers.filter(u => u.role === "manager").length;
  const featureAuditEvents = (featureAuditQuery.data ??
    []) as FeatureFlagAuditEvent[];
  const showFeatureSearch =
    activeTab === "release" || activeTab === "debug" || activeTab === "all";
  const currentPresetLabel = activePreset?.name ?? "Custom";
  const debugSessionLabel = isDebugSessionActive
    ? `${debugSession?.minutesRemaining ?? 0}m`
    : "Off";

  // ── Tab metadata ─────────────────────────────────────────────────────
  const settingsTabItems = useMemo<SettingsTabNavItem[]>(
    () => [
      {
        key: "overview",
        label: "Overview",
        description: "",
        icon: Gauge,
        badge: rolloutIssueCount === 0 ? "" : `${rolloutIssueCount} issues`,
        tone: rolloutIssueCount === 0 ? "positive" : "warning",
      },
      {
        key: "access",
        label: "Access & Scope",
        description: "",
        icon: Users,
        badge: `${configuredStreams.length} domains`,
        tone: "primary",
      },
      {
        key: "debug",
        label: "Debug",
        description: "",
        icon: Wrench,
        badge: isDebugSessionActive
          ? `${debugSession?.minutesRemaining ?? 0}m live`
          : "",
        tone: "warning",
      },
      {
        key: "all",
        label: "All Flags",
        description: "",
        icon: Search,
        badge: searchValue.trim()
          ? `${filteredFeatureItems.length} matches`
          : `${featureItems.length}`,
        tone: "neutral",
      },
    ],
    [
      configuredStreams.length,
      debugSession?.minutesRemaining,
      featureItems.length,
      filteredFeatureItems.length,
      isDebugSessionActive,
      rolloutIssueCount,
      searchValue,
    ]
  );

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleToggle = (featureKey: FeatureFlagKey, enabled: boolean) => {
    setOverrideMutation.mutate({ featureKey, enabled });
  };

  const handleReset = (featureKey: FeatureFlagKey) => {
    resetOverrideMutation.mutate({ featureKey });
  };

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {flagsQuery.isLoading && (
        <Card className={cn(a.card, "p-6 text-sm text-muted-foreground")}>
          Loading settings...
        </Card>
      )}

      {flagsQuery.error && (
        <Card className={cn(a.card, "p-6 text-sm text-destructive")}>
          {flagsQuery.error.message}
        </Card>
      )}

      {!flagsQuery.isLoading &&
        !flagsQuery.error &&
        featureItems.length > 0 && (
          <Tabs
            value={activeTab}
            onValueChange={value => setActiveTab(value as FeatureTab)}
            orientation="vertical"
            className="space-y-0"
          >
            <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
              <SettingsRail
                tabs={settingsTabItems}
                activeTab={activeTab}
                showSearch={showFeatureSearch}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
                onOpenPresets={() => setLocation("/admin/settings/presets")}
                onOpenUsers={() => setLocation("/admin/users")}
                onOpenStreams={() => setLocation("/admin/streams")}
              />

              <div className="min-w-0 space-y-5">
                {/* ── Overview ──────────────────────────────────────── */}
                <TabsContent value="overview" className="mt-0 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <SettingsAreaCard
                      title="Feature Flags"
                      description={`${currentPresetLabel} · ${enabledReleaseCount}/${releaseItems.length} on · ${adminOverrideCount} overrides`}
                      icon={Sparkles}
                      tone="primary"
                      stats={[]}
                      actionLabel="Open Feature Flags"
                      actionIcon={Sparkles}
                      onAction={() => setLocation("/admin/settings/presets")}
                    />
                    <SettingsAreaCard
                      title="Users & Roles"
                      description={`${totalUsers} users · ${adminUsers} admin · ${managerUsers} manager · ${activeUsers} active`}
                      icon={Users}
                      tone="primary"
                      stats={[]}
                      actionLabel="Manage users"
                      actionIcon={Users}
                      onAction={() => setLocation("/admin/users")}
                    />
                    <SettingsAreaCard
                      title="Domains"
                      description={`${configuredStreams.length} domains configured`}
                      icon={Layers}
                      tone="primary"
                      stats={[]}
                      actionLabel="Manage domains"
                      actionIcon={Layers}
                      onAction={() => setLocation("/admin/streams")}
                    />
                    <SettingsAreaCard
                      title="Debug"
                      description={`Session ${debugSessionLabel} · ${enabledDebugCount} flags on`}
                      icon={Wrench}
                      tone="neutral"
                      stats={[]}
                      actionLabel="Debug tools"
                      actionIcon={Wrench}
                      onAction={() => setActiveTab("debug")}
                    />
                  </div>

                  {rolloutIssues.length > 0 && (
                    <RolloutHealthCard
                      issues={rolloutIssues}
                      onFix={(featureKey, enable) =>
                        setOverrideMutation.mutate({
                          featureKey,
                          enabled: enable,
                        })
                      }
                      isPending={setOverrideMutation.isPending}
                    />
                  )}

                  <RolloutActivityCard
                    events={featureAuditEvents.slice(0, 5)}
                    isLoading={featureAuditQuery.isLoading}
                    error={featureAuditQuery.error?.message}
                  />
                </TabsContent>

                {/* ── Access & Scope ────────────────────────────────── */}
                <TabsContent value="access" className="mt-0 space-y-5">
                  <div className="grid gap-5 md:grid-cols-2">
                    <SettingsAreaCard
                      title="Users & Roles"
                      description={`${totalUsers} users · ${adminUsers} admin · ${managerUsers} manager`}
                      icon={Users}
                      tone="primary"
                      stats={[]}
                      actionLabel="Manage users"
                      actionIcon={Users}
                      onAction={() => setLocation("/admin/users")}
                    />
                    <SettingsAreaCard
                      title="Domains"
                      description={`${configuredStreams.length} domains configured`}
                      icon={Layers}
                      tone="primary"
                      stats={[]}
                      actionLabel="Manage domains"
                      actionIcon={Layers}
                      onAction={() => setLocation("/admin/streams")}
                    />
                  </div>
                </TabsContent>

                {/* ── Debug ─────────────────────────────────────────── */}
                <TabsContent value="debug" className="mt-0 space-y-5">
                  <DebugSessionCard
                    debugSession={debugSession}
                    isDebugSessionActive={isDebugSessionActive}
                    isDebugSessionPending={isDebugSessionPending}
                    onStart={minutes =>
                      startDebugSessionMutation.mutate({
                        durationMinutes: minutes,
                      })
                    }
                    onStop={() => stopDebugSessionMutation.mutate()}
                  />
                  <FeatureListCard
                    title={CATEGORY_META.debug.label}
                    description="Requires a live debug session to take effect."
                    items={debugItems}
                    featureIssueMap={featureIssueMap}
                    pendingKey={pendingKey}
                    onToggle={handleToggle}
                    onReset={handleReset}
                    emptyTitle="No debug flags match the current filter."
                  />
                </TabsContent>

                {/* ── All Flags ─────────────────────────────────────── */}
                <TabsContent value="all" className="mt-0 space-y-5">
                  {rolloutIssues.length > 0 && (
                    <RolloutHealthCard
                      issues={rolloutIssues}
                      onFix={(featureKey, enable) =>
                        setOverrideMutation.mutate({
                          featureKey,
                          enabled: enable,
                        })
                      }
                      isPending={setOverrideMutation.isPending}
                    />
                  )}
                  <FeatureListCard
                    title="All Flags"
                    items={filteredFeatureItems}
                    featureIssueMap={featureIssueMap}
                    pendingKey={pendingKey}
                    onToggle={handleToggle}
                    onReset={handleReset}
                    emptyTitle="No flags match the current filter."
                  />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        )}
    </div>
  );
}
