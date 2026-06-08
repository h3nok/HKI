import { describe, expect, it } from "vitest";
import {
  computeCriticalPath,
  computeBlastRadius,
  summarizeRun,
  diffRuns,
} from "../algorithms.js";
import { replayEvents } from "../projector.js";
import { kbLookupTrace, multiStepPlanTrace } from "../fixtures.js";

describe("computeCriticalPath", () => {
  it("returns a non-empty path for a completed run", () => {
    const run = replayEvents("cp-1", "query", kbLookupTrace, 0);
    // Give nodes durations so the algorithm can discriminate
    const runWithDurations = {
      ...run,
      nodes: run.nodes.map((n, i) => ({ ...n, durationMs: (i + 1) * 100 })),
    };
    const path = computeCriticalPath(runWithDurations);
    expect(path.length).toBeGreaterThan(0);
  });

  it("starts from a source node (no incoming edges)", () => {
    const run = replayEvents("cp-2", "query", kbLookupTrace, 0);
    const runWithDurations = {
      ...run,
      nodes: run.nodes.map((n, i) => ({ ...n, durationMs: (i + 1) * 50 })),
    };
    const path = computeCriticalPath(runWithDurations);
    if (path.length > 0) {
      const firstId = path[0].id;
      const hasIncoming = run.edges.some(e => e.target === firstId);
      expect(hasIncoming).toBe(false);
    }
  });
});

describe("computeBlastRadius", () => {
  it("includes the start node itself", () => {
    const run = replayEvents("br-1", "query", kbLookupTrace, 0);
    const startNode = run.nodes[0];
    const radius = computeBlastRadius(run, startNode.id);
    expect(radius.has(startNode.id)).toBe(true);
  });

  it("propagates to all reachable downstream nodes", () => {
    const run = replayEvents("br-2", "query", kbLookupTrace, 0);
    const startNode = run.nodes[0];
    const radius = computeBlastRadius(run, startNode.id);
    // At minimum, the starting node plus at least one downstream node
    expect(radius.size).toBeGreaterThan(1);
  });

  it("returns only the start node when no outgoing edges", () => {
    const run = replayEvents("br-3", "query", kbLookupTrace, 0);
    const lastNode = run.nodes[run.nodes.length - 1];
    const radius = computeBlastRadius(run, lastNode.id);
    expect(radius.size).toBe(1);
    expect(radius.has(lastNode.id)).toBe(true);
  });
});

describe("summarizeRun", () => {
  it("reports correct tool call count", () => {
    const run = replayEvents("sum-1", "query", kbLookupTrace, 0);
    const summary = summarizeRun(run);
    expect(summary.toolCallCount).toBe(1);
  });

  it("reports correct token count from reflecting node", () => {
    const run = replayEvents("sum-2", "query", kbLookupTrace, 0);
    const summary = summarizeRun(run);
    expect(summary.tokensUsed).toBe(1620);
  });

  it("reports correct confidence", () => {
    const run = replayEvents("sum-3", "query", kbLookupTrace, 0);
    const summary = summarizeRun(run);
    expect(summary.confidence).toBe(0.91);
  });

  it("reports correct hkiDomain", () => {
    const run = replayEvents("sum-4", "query", kbLookupTrace, 0);
    const summary = summarizeRun(run);
    expect(summary.hkiDomain).toBe("engineering");
  });

  it("reports multiple tool calls for plan trace", () => {
    const run = replayEvents("sum-5", "query", multiStepPlanTrace, 0);
    const summary = summarizeRun(run);
    expect(summary.toolCallCount).toBe(2);
  });
});

describe("diffRuns", () => {
  it("detects added nodes when a node exists in B but not A", () => {
    const runA = replayEvents("diff-a", "query", kbLookupTrace, 0);
    const runB = replayEvents("diff-b", "query", multiStepPlanTrace, 0);
    const diff = diffRuns(runA, runB);
    // Different node IDs so all B nodes are "added" from A's perspective
    expect(diff.nodes.added.length).toBeGreaterThan(0);
  });

  it("produces empty diff for the same run replayed twice", () => {
    const runA = replayEvents("same-a", "query", kbLookupTrace, 0);
    const runB = replayEvents("same-a", "query", kbLookupTrace, 0);
    const diff = diffRuns(runA, runB);
    expect(diff.nodes.added).toHaveLength(0);
    expect(diff.nodes.removed).toHaveLength(0);
    expect(diff.nodes.changed).toHaveLength(0);
  });
});
