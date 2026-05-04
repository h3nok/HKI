import { useEffect, useMemo, useState } from "react";
import { cn } from "@hki/ui";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import type {
  FeatureFlagKey,
  FeatureFlagSnapshot,
} from "@shared/feature-flags";
import { a } from "../theme";
import {
  FEATURE_SECTION_META,
  SOFT_BADGE_CLASS,
  SOFT_LABEL_CLASS,
} from "../constants";
import { formatAuditTimestamp, groupFeatureItemsBySection } from "../utils";
import { SettingsButton } from "./primitives";
import type {
  FeatureFlagListItem,
  FeatureFlagPresetItem,
  FeatureSectionKey,
} from "../types";

function PresetSectionEditor({
  sectionKey,
  items,
  draftOverrides,
  onToggle,
}: {
  sectionKey: FeatureSectionKey;
  items: FeatureFlagListItem[];
  draftOverrides: FeatureFlagSnapshot;
  onToggle: (featureKey: FeatureFlagKey, enabled: boolean) => void;
}) {
  const meta = FEATURE_SECTION_META[sectionKey];
  const enabledCount = items.filter(item => draftOverrides[item.key]).length;
  const [isOpen, setIsOpen] = useState(false);
  const Icon = meta.icon;

  return (
    <div className={cn(a.card, "rounded-2xl")}>
      <button
        type="button"
        onClick={() => setIsOpen(current => !current)}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
        aria-expanded={isOpen}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              a.iconNeutral,
              "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {meta.title}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {meta.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-1 text-[10px]"
          >
            {enabledCount}/{items.length} on
          </Badge>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {isOpen ? (
        <div className="space-y-3 border-t border-border/60 px-4 pb-4 pt-4">
          {items.map(item => (
            <div
              key={item.key}
              className={cn(a.inset, "rounded-2xl px-4 py-3")}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">
                      {item.label}
                    </p>
                    <Badge
                      variant="outline"
                      className="rounded-full px-2 py-0.5 text-[10px]"
                    >
                      {item.minimumRole ?? "viewer"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <ToggleGroup
                  type="single"
                  value={draftOverrides[item.key] ? "enabled" : "disabled"}
                  onValueChange={value => {
                    if (!value) return;
                    onToggle(item.key, value === "enabled");
                  }}
                  className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-muted/55 p-1"
                  aria-label={`Preset state for ${item.label}`}
                >
                  <ToggleGroupItem
                    value="enabled"
                    className="h-8 rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm"
                  >
                    On
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="disabled"
                    className="h-8 rounded-lg px-3 text-xs font-semibold data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                  >
                    Off
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PresetCard({
  preset,
  featureItems,
  isApplying,
  isDeleting,
  isSaving,
  canDelete,
  onApply,
  onDelete,
  onSave,
  onEditingChange,
}: {
  preset: FeatureFlagPresetItem & { matchesCurrent: boolean };
  featureItems: FeatureFlagListItem[];
  isApplying: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  canDelete: boolean;
  onApply: () => void;
  onDelete: () => void;
  onSave: (draft: {
    name: string;
    description: string;
    overrides: FeatureFlagSnapshot;
  }) => void | Promise<void>;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const closeEditing = () => {
    setIsEditing(false);
    onEditingChange?.(false);
  };
  const toggleEditing = () => {
    const next = !isEditing;
    setIsEditing(next);
    onEditingChange?.(next);
  };
  const [draftName, setDraftName] = useState(preset.name);
  const [draftDescription, setDraftDescription] = useState(preset.description);
  const [draftOverrides, setDraftOverrides] = useState(preset.overrides);
  const groupedFeatureItems = useMemo(
    () => groupFeatureItemsBySection(featureItems),
    [featureItems]
  );
  const enabledCount = Object.values(preset.overrides).filter(Boolean).length;
  const presetKindLabel = preset.sourceTemplateKey
    ? "Seeded template"
    : "Custom preset";
  const presetHint = preset.sourceTemplateKey
    ? "Seeded rollout templates stay editable and reappear if missing; they are protected from deletion."
    : "Custom presets can be applied, edited, or deleted once they are no longer needed.";

  useEffect(() => {
    setDraftName(preset.name);
    setDraftDescription(preset.description);
    setDraftOverrides(preset.overrides);
  }, [preset.description, preset.name, preset.overrides, preset.id]);

  const handleSaveAndApply = async () => {
    await onSave({
      name: draftName,
      description: draftDescription,
      overrides: draftOverrides,
    });
    closeEditing();
  };

  return (
    <Card className={cn(a.card, "h-full")}>
      <CardHeader className="space-y-3 pb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold text-foreground">
              {preset.name}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-muted-foreground">
              {preset.description}
            </CardDescription>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0 md:justify-end">
            {preset.sourceTemplateKey ? (
              <Badge className={cn(a.pillPrimary, SOFT_BADGE_CLASS)}>
                Template preset
              </Badge>
            ) : (
              <Badge className={cn(a.pillNeutral, SOFT_BADGE_CLASS)}>
                Custom preset
              </Badge>
            )}
            <Badge
              className={cn(
                preset.matchesCurrent ? a.pillPositive : a.pillNeutral,
                SOFT_BADGE_CLASS
              )}
            >
              {preset.matchesCurrent ? "Current" : "Saved"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={cn(a.inset, "rounded-2xl px-4 py-3")}>
            <p className={SOFT_LABEL_CLASS}>{presetKindLabel}</p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {preset.sourceTemplateKey ? "Managed baseline" : "Org-specific"}
            </p>
          </div>
          <div className={cn(a.inset, "rounded-2xl px-4 py-3")}>
            <p className={SOFT_LABEL_CLASS}>Enabled controls</p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-foreground">
              {enabledCount}
            </p>
          </div>
          <div className={cn(a.inset, "rounded-2xl px-4 py-3 sm:col-span-2")}>
            <p className={SOFT_LABEL_CLASS}>Last updated</p>
            <div className="mt-1 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="text-sm font-semibold text-foreground">
                {formatAuditTimestamp(preset.updatedAt)}
              </p>
              <p className="text-xs text-muted-foreground">{presetHint}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {canDelete ? (
            <SettingsButton
              type="button"
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={onDelete}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? "Deleting…" : "Delete"}
            </SettingsButton>
          ) : null}
          <SettingsButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleEditing}
          >
            {isEditing ? (
              <>
                <X className="h-3.5 w-3.5" /> Close
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </>
            )}
          </SettingsButton>
          <SettingsButton
            type="button"
            variant={preset.matchesCurrent ? "outline" : "brand"}
            size="sm"
            disabled={isApplying || preset.matchesCurrent}
            onClick={onApply}
          >
            {preset.matchesCurrent ? (
              <>
                <Check className="h-3.5 w-3.5" /> Applied
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" /> Apply
              </>
            )}
          </SettingsButton>
        </div>

        {isEditing ? (
          <div className={cn(a.inset, "space-y-4 rounded-2xl p-4")}>
            <div className="grid gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Preset name
                </p>
                <Input
                  value={draftName}
                  onChange={event => setDraftName(event.target.value)}
                  placeholder="Preset name"
                  maxLength={128}
                  className={cn(a.field)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Preset description
                </p>
                <Textarea
                  value={draftDescription}
                  onChange={event => setDraftDescription(event.target.value)}
                  placeholder="Describe what this MVP preset enables and what it intentionally keeps off."
                  rows={3}
                  maxLength={2000}
                  className={cn(a.field)}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {groupedFeatureItems.map(([sectionKey, sectionItems]) => (
                <PresetSectionEditor
                  key={`${preset.id}-${sectionKey}`}
                  sectionKey={sectionKey}
                  items={sectionItems}
                  draftOverrides={draftOverrides}
                  onToggle={(featureKey, enabled) =>
                    setDraftOverrides(current => ({
                      ...current,
                      [featureKey]: enabled,
                    }))
                  }
                />
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-4">
              <div className="flex min-h-9 items-center">
                {canDelete ? (
                  <SettingsButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting || isSaving || isApplying}
                    onClick={onDelete}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isDeleting ? "Deleting…" : "Delete preset"}
                  </SettingsButton>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Template presets are protected and can&apos;t be deleted.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <SettingsButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isSaving || isApplying || isDeleting}
                  onClick={() => {
                    setDraftName(preset.name);
                    setDraftDescription(preset.description);
                    setDraftOverrides(preset.overrides);
                    closeEditing();
                  }}
                >
                  Cancel
                </SettingsButton>
                <SettingsButton
                  type="button"
                  variant="brand"
                  size="sm"
                  disabled={isSaving || isApplying || !draftName.trim()}
                  onClick={() => void handleSaveAndApply()}
                >
                  <Zap className="h-3.5 w-3.5" />
                  {isSaving ? "Saving…" : isApplying ? "Applying…" : "Apply"}
                </SettingsButton>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
