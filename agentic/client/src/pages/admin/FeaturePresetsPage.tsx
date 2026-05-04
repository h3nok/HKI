import { useMemo, useState } from "react";
import { Gauge, Layers, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@hki/ui";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createFeatureFlagPresetSnapshot,
  getFeatureFlagDependencyIssues,
  type FeatureFlagKey,
} from "@shared/feature-flags";
import { a } from "./theme";
import type {
  FeatureFlagAuditEvent,
  FeatureFlagListItem,
  FeatureFlagPresetItem,
} from "./types";
import {
  PresetCard,
  RolloutActivityCard,
  RolloutHealthCard,
  SectionActionButton,
} from "./components";

export default function FeaturePresetsPage() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const [pendingPresetId, setPendingPresetId] = useState<string | null>(null);
  const [savingPresetId, setSavingPresetId] = useState<string | null>(null);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    presetId: string;
    name: string;
  } | null>(null);

  const presetsQuery = trpc.admin.listFeatureFlagPresets.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const flagsQuery = trpc.admin.listFeatureFlags.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const featureAuditQuery = trpc.admin.listFeatureFlagAuditEvents.useQuery(
    { limit: 6 },
    { retry: false, refetchOnWindowFocus: false }
  );

  const applyPresetMutation = trpc.admin.applyFeatureFlagPreset.useMutation({
    onMutate: value => setPendingPresetId(value.presetId),
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlagPresets.invalidate(),
        utils.admin.listFeatureFlags.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
        utils.auth.viewerContext.invalidate(),
      ]);
      toast.success("Preset applied");
    },
    onError: error => toast.error(error.message || "Failed to apply preset"),
    onSettled: () => setPendingPresetId(null),
  });

  const updatePresetMutation = trpc.admin.updateFeatureFlagPreset.useMutation({
    onMutate: value => setSavingPresetId(value.presetId),
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlagPresets.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
      ]);
      toast.success("Preset saved");
    },
    onError: error => toast.error(error.message || "Failed to save preset"),
    onSettled: () => setSavingPresetId(null),
  });

  const setOverrideMutation = trpc.admin.setFeatureFlagOverride.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlags.invalidate(),
        utils.admin.listFeatureFlagPresets.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
        utils.auth.viewerContext.invalidate(),
      ]);
      toast.success("Flag updated");
    },
    onError: e => toast.error(e.message || "Failed to update flag"),
  });

  const createPresetMutation = trpc.admin.createFeatureFlagPreset.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlagPresets.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
      ]);
      toast.success("Preset created");
    },
    onError: e => toast.error(e.message || "Failed to create preset"),
  });

  const deletePresetMutation = trpc.admin.deleteFeatureFlagPreset.useMutation({
    onMutate: value => setPendingPresetId(value.presetId),
    onSuccess: async () => {
      await Promise.all([
        utils.admin.listFeatureFlagPresets.invalidate(),
        utils.admin.listFeatureFlagAuditEvents.invalidate(),
      ]);
      toast.success("Preset deleted");
    },
    onError: error => toast.error(error.message || "Failed to delete preset"),
    onSettled: () => {
      setPendingPresetId(null);
      setDeleteDialog(null);
    },
  });

  const featureItems = (flagsQuery.data ?? []) as FeatureFlagListItem[];
  const featurePresets = (presetsQuery.data ?? []) as FeatureFlagPresetItem[];
  const featureAuditEvents = (featureAuditQuery.data ??
    []) as FeatureFlagAuditEvent[];

  const currentEffectiveFlags = useMemo(
    () =>
      new Map<FeatureFlagKey, boolean>(
        featureItems.map(item => [item.key, item.effectiveEnabled])
      ),
    [featureItems]
  );

  const sortedPresets = useMemo(() => {
    const withMatch = featurePresets.map(preset => ({
      ...preset,
      matchesCurrent: Object.entries(preset.overrides).every(
        ([k, v]) => currentEffectiveFlags.get(k as FeatureFlagKey) === v
      ),
    }));
    return [...withMatch].sort((a, b) => {
      const m = Number(b.matchesCurrent) - Number(a.matchesCurrent);
      if (m !== 0) return m;
      const t =
        Number(Boolean(b.sourceTemplateKey)) -
        Number(Boolean(a.sourceTemplateKey));
      if (t !== 0) return t;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }, [currentEffectiveFlags, featurePresets]);

  const rolloutIssues = useMemo(
    () =>
      getFeatureFlagDependencyIssues(
        Object.fromEntries(currentEffectiveFlags.entries()) as Partial<
          Record<FeatureFlagKey, boolean>
        >
      ),
    [currentEffectiveFlags]
  );

  const templatePresetCount = useMemo(
    () =>
      featurePresets.filter(preset => Boolean(preset.sourceTemplateKey)).length,
    [featurePresets]
  );
  const customPresetCount = featurePresets.length - templatePresetCount;

  const isLoading = flagsQuery.isLoading || presetsQuery.isLoading;

  return (
    <div className="space-y-5">
      {isLoading && (
        <Card className={cn(a.card, "p-6 text-sm text-muted-foreground")}>
          Loading…
        </Card>
      )}

      {flagsQuery.error && (
        <Card className={cn(a.card, "p-6 text-sm text-destructive")}>
          {flagsQuery.error.message}
        </Card>
      )}

      {!isLoading && !flagsQuery.error && featureItems.length > 0 && (
        <>
          {/* Quick nav */}
          <div className="flex flex-wrap gap-2">
            <SectionActionButton
              label="⚙️ Settings"
              icon={Gauge}
              variant="outline"
              onClick={() => setLocation("/admin/settings")}
            />
            <SectionActionButton
              label="Streams"
              icon={Layers}
              variant="outline"
              onClick={() => setLocation("/admin/streams")}
            />
            <SectionActionButton
              label="New Preset"
              icon={Plus}
              variant="brand"
              disabled={createPresetMutation.isPending}
              onClick={() =>
                createPresetMutation.mutate({
                  name: "New Preset",
                  description: "Custom feature flag configuration.",
                  overrides: createFeatureFlagPresetSnapshot(),
                })
              }
            />
          </div>

          <Card className={cn(a.card, "p-4")}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className={a.sectionEyebrow}>Preset Library</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Seeded template presets stay available as rollout baselines.
                  Custom presets can be edited and deleted from this screen.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-70">
                <div className={cn(a.inset, "rounded-2xl px-4 py-3")}>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Template presets
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {templatePresetCount}
                  </p>
                </div>
                <div className={cn(a.inset, "rounded-2xl px-4 py-3")}>
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Custom presets
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {customPresetCount}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Health issues (only when broken) */}
          {rolloutIssues.length > 0 && (
            <RolloutHealthCard
              issues={rolloutIssues}
              onFix={(featureKey, enable) =>
                setOverrideMutation.mutate({ featureKey, enabled: enable })
              }
              isPending={setOverrideMutation.isPending}
            />
          )}

          {/* Presets */}
          {sortedPresets.length === 0 ? (
            <Card
              className={cn(
                a.card,
                "border-dashed p-8 text-center text-sm text-muted-foreground"
              )}
            >
              No presets available yet.
            </Card>
          ) : (
            <div
              className={cn(
                "grid gap-4",
                editingPresetId ? "grid-cols-1" : "xl:grid-cols-2"
              )}
            >
              {sortedPresets.map(preset => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  featureItems={featureItems}
                  isApplying={pendingPresetId === preset.id}
                  isDeleting={pendingPresetId === preset.id}
                  isSaving={savingPresetId === preset.id}
                  canDelete={!preset.sourceTemplateKey}
                  onApply={() =>
                    applyPresetMutation.mutate({ presetId: preset.id })
                  }
                  onDelete={() =>
                    setDeleteDialog({ presetId: preset.id, name: preset.name })
                  }
                  onSave={draft =>
                    (async () => {
                      await updatePresetMutation.mutateAsync({
                        presetId: preset.id,
                        name: draft.name,
                        description: draft.description,
                        overrides: draft.overrides,
                      });
                      await applyPresetMutation.mutateAsync({
                        presetId: preset.id,
                      });
                    })()
                  }
                  onEditingChange={editing =>
                    setEditingPresetId(editing ? preset.id : null)
                  }
                />
              ))}
            </div>
          )}

          {/* Activity */}
          <RolloutActivityCard
            events={featureAuditEvents.slice(0, 6)}
            isLoading={featureAuditQuery.isLoading}
            error={featureAuditQuery.error?.message}
          />

          <Dialog
            open={!!deleteDialog}
            onOpenChange={open => {
              if (!open) setDeleteDialog(null);
            }}
          >
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Delete "{deleteDialog?.name}"?</DialogTitle>
                <DialogDescription>
                  This removes the custom preset definition from the org. It
                  does not change the currently applied feature flags.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex justify-end gap-2 pt-2">
                <DialogClose asChild>
                  <button className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                    Cancel
                  </button>
                </DialogClose>
                <button
                  onClick={() => {
                    if (!deleteDialog) return;
                    deletePresetMutation.mutate({
                      presetId: deleteDialog.presetId,
                    });
                  }}
                  className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold transition-colors disabled:opacity-60"
                  disabled={deletePresetMutation.isPending}
                >
                  {deletePresetMutation.isPending ? "Deleting…" : "Delete"}
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}
