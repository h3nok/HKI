import {
  DEBUG_FEATURE_FLAG_KEYS,
  createFeatureFlagSnapshot,
  getFeatureFlagDependencyIssues,
  getFeatureFlagPreset,
} from "@shared/feature-flags";
import { describe, expect, it } from "vitest";
import {
  buildViewerFeatureContext,
  evaluateFeatureFlagsForUser,
} from "./feature-flags";

describe("feature flag evaluation", () => {
  it("enables release flags for eligible roles by default", () => {
    const result = evaluateFeatureFlagsForUser({
      user: { role: "manager", valueStreams: "pharmacy" },
      environment: "production",
    });

    expect(result.flags["release.chat.promptGenerator"]).toBe(true);
  });

  it("keeps minimum-role gates enforced even when an override exists", () => {
    const result = evaluateFeatureFlagsForUser({
      user: { role: "manager", valueStreams: "pharmacy" },
      environment: "production",
      overrides: [
        { featureKey: "debug.chat.activityPanel", enabled: true },
        { featureKey: "debug.chat.tracePayloads", enabled: true },
      ],
    });

    expect(result.flags["debug.chat.activityPanel"]).toBe(false);
    expect(result.flags["debug.chat.tracePayloads"]).toBe(false);
  });

  it("allows KB operators to ingest files and use the validate sandbox while preserving manager-only sections", () => {
    const result = evaluateFeatureFlagsForUser({
      user: { role: "operator", valueStreams: "pharmacy" },
      environment: "production",
    });

    expect(result.flags["release.knowledge.tabs.ingest"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.fileUpload"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.textPaste"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.urlCrawl"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.connectors"]).toBe(false);
    expect(result.flags["release.knowledge.tabs.validate"]).toBe(true);
    expect(result.flags["release.knowledge.validate.testSandbox"]).toBe(true);
    expect(result.flags["release.knowledge.validate.evalSuite"]).toBe(false);
    expect(result.flags["release.knowledge.validate.quality"]).toBe(false);
    expect(result.flags["release.knowledge.validate.gaps"]).toBe(false);
    expect(result.flags["release.knowledge.validate.compare"]).toBe(false);
    expect(result.flags["release.knowledge.validate.contextShaping"]).toBe(
      false
    );
  });

  it("builds viewer context with scoped permissions and flags", () => {
    const viewerContext = buildViewerFeatureContext({
      user: { role: "admin", valueStreams: "pharmacy,optical" },
      environment: "production",
      overrides: [{ featureKey: "debug.chat.tracePayloads", enabled: true }],
    });

    expect(viewerContext.isGlobalScope).toBe(true);
    expect(viewerContext.scopes).toEqual(["global"]);
    expect(viewerContext.permissions.length).toBeGreaterThan(0);
    expect(viewerContext.flags["debug.chat.activityPanel"]).toBe(false);
    expect(viewerContext.flags["debug.chat.tracePayloads"]).toBe(true);
  });

  it("defines the first MVP preset for a curated KB pilot", () => {
    const preset = getFeatureFlagPreset("mvp.first");
    const result = evaluateFeatureFlagsForUser({
      user: { role: "manager", valueStreams: "pharmacy" },
      environment: "production",
      overrides: Object.entries(preset.overrides).map(
        ([featureKey, enabled]) => ({
          featureKey,
          enabled: enabled ?? null,
        })
      ),
    });

    expect(result.flags["release.chat.attachments"]).toBe(false);
    expect(result.flags["release.chat.voice"]).toBe(false);
    expect(result.flags["release.chat.rerun"]).toBe(true);
    expect(result.flags["release.chat.clearAllTasks"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.fileUpload"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.textPaste"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.urlCrawl"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.connectors"]).toBe(false);
    expect(result.flags["release.knowledge.tabs.validate"]).toBe(false);
    expect(result.flags["release.knowledge.tabs.govern"]).toBe(false);
    expect(result.flags["release.knowledge.library.documents"]).toBe(true);
    expect(result.flags["release.knowledge.library.collections"]).toBe(false);
    expect(result.flags["release.knowledge.activity.alertHistory"]).toBe(true);
    expect(result.flags["release.connectors.googleDrive"]).toBe(false);
    expect(result.flags["debug.chat.activityPanel"]).toBe(false);
  });

  it("defines the curated MVP preset for the review, test, and eval workflow", () => {
    const preset = getFeatureFlagPreset("mvp.curated");
    const result = evaluateFeatureFlagsForUser({
      user: { role: "manager", valueStreams: "pharmacy" },
      environment: "production",
      overrides: Object.entries(preset.overrides).map(
        ([featureKey, enabled]) => ({
          featureKey,
          enabled: enabled ?? null,
        })
      ),
    });

    expect(result.flags["release.knowledge.tabs.validate"]).toBe(true);
    expect(result.flags["release.knowledge.tabs.govern"]).toBe(true);
    expect(result.flags["release.chat.attachments"]).toBe(false);
    expect(result.flags["release.chat.voice"]).toBe(false);
    expect(result.flags["release.chat.rerun"]).toBe(true);
    expect(result.flags["release.chat.clearAllTasks"]).toBe(false);
    expect(result.flags["release.knowledge.validate.testSandbox"]).toBe(true);
    expect(result.flags["release.knowledge.validate.quality"]).toBe(true);
    expect(result.flags["release.knowledge.validate.evalSuite"]).toBe(true);
    expect(result.flags["release.knowledge.govern.reviewQueue"]).toBe(true);
    expect(result.flags["release.knowledge.govern.usersAccess"]).toBe(false);
    expect(result.flags["release.knowledge.library.graph"]).toBe(false);
    expect(result.flags["release.knowledge.ingest.urlCrawl"]).toBe(false);
    expect(result.flags["release.connectors.googleDrive"]).toBe(false);
  });

  it("defines the full KB workspace preset for the expanded beta rollout", () => {
    const preset = getFeatureFlagPreset("beta.full");
    const result = evaluateFeatureFlagsForUser({
      user: { role: "manager", valueStreams: "pharmacy" },
      environment: "production",
      overrides: Object.entries(preset.overrides).map(
        ([featureKey, enabled]) => ({
          featureKey,
          enabled: enabled ?? null,
        })
      ),
    });

    expect(result.flags["release.chat.attachments"]).toBe(true);
    expect(result.flags["release.chat.voice"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.textPaste"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.urlCrawl"]).toBe(true);
    expect(result.flags["release.knowledge.ingest.connectors"]).toBe(true);
    expect(result.flags["release.knowledge.library.collections"]).toBe(true);
    expect(result.flags["release.knowledge.library.taxonomy"]).toBe(true);
    expect(result.flags["release.knowledge.library.graph"]).toBe(true);
    expect(result.flags["release.knowledge.validate.gaps"]).toBe(true);
    expect(result.flags["release.knowledge.validate.compare"]).toBe(true);
    expect(result.flags["release.knowledge.govern.usersAccess"]).toBe(true);
    expect(result.flags["release.knowledge.govern.compliance"]).toBe(true);
    expect(result.flags["release.knowledge.activity.alertHistory"]).toBe(true);
    expect(result.flags["release.connectors.googleDrive"]).toBe(true);
    expect(result.flags["debug.chat.activityPanel"]).toBe(false);
  });

  it("treats clear-all tasks as a debug-only chat surface", () => {
    expect(DEBUG_FEATURE_FLAG_KEYS).toContain("release.chat.clearAllTasks");
  });

  it("reports rollout issues for blocked children and empty parent surfaces", () => {
    const snapshot = createFeatureFlagSnapshot(false);
    snapshot["release.knowledge.tabs.validate"] = true;
    snapshot["release.connectors.googleDrive"] = true;

    const issues = getFeatureFlagDependencyIssues(snapshot);

    expect(
      issues.some(
        issue => issue.id === "empty-surface:release.knowledge.tabs.validate"
      )
    ).toBe(true);
    expect(
      issues.some(
        issue => issue.id === "missing-parent:release.connectors.googleDrive"
      )
    ).toBe(true);
  });
});
