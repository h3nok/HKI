import { describe, expect, it } from "vitest";
import { replayEvents } from "../projector.js";
import {
  kbLookupTrace,
  multiStepPlanTrace,
  modelFallbackTrace,
  humanEscalationTrace,
  fastPathTrace,
} from "../fixtures.js";

describe("replayEvents — kbLookupTrace", () => {
  const run = replayEvents(
    "test-1",
    "What are HKI conformance levels?",
    kbLookupTrace,
    1000
  );

  it("creates nodes for each significant event", () => {
    const kinds = run.nodes.map(n => n.kind);
    expect(kinds).toContain("guardrail");
    expect(kinds).toContain("routing");
    expect(kinds).toContain("tool_call");
    expect(kinds).toContain("tool_result");
    expect(kinds).toContain("reflecting");
    expect(kinds).toContain("response");
  });

  it("enriches tool_call node with KB citations", () => {
    const toolCall = run.nodes.find(n => n.kind === "tool_call");
    expect(toolCall?.citations).toHaveLength(4);
    expect(toolCall?.resultCount).toBe(4);
  });

  it("creates an execution chain with edges", () => {
    expect(run.edges.length).toBeGreaterThan(3);
    const edge = run.edges[0];
    expect(edge.kind).toBe("execution");
  });

  it("has a data edge from tool_call to tool_result", () => {
    const toolCall = run.nodes.find(n => n.kind === "tool_call")!;
    const toolResult = run.nodes.find(n => n.kind === "tool_result")!;
    const dataEdge = run.edges.find(
      e => e.source === toolCall.id && e.target === toolResult.id
    );
    expect(dataEdge?.kind).toBe("data");
  });

  it("sets run metadata from response_metadata event", () => {
    expect(run.model).toBe("gemini-1.5-flash-002");
    expect(run.confidence).toBe(0.91);
    expect(run.hkiDomain).toBe("engineering");
  });

  it("sets run status to success", () => {
    expect(run.status).toBe("success");
  });
});

describe("replayEvents — multiStepPlanTrace", () => {
  const run = replayEvents(
    "test-2",
    "Analyze inventory and pricing",
    multiStepPlanTrace,
    2000
  );

  it("creates a plan node", () => {
    const plan = run.nodes.find(n => n.kind === "plan");
    expect(plan).toBeDefined();
    expect(plan?.steps).toHaveLength(3);
  });

  it("updates plan step statuses via step_verified events", () => {
    const plan = run.nodes.find(n => n.kind === "plan")!;
    const completedSteps =
      plan.steps?.filter(s => s.status === "completed") ?? [];
    expect(completedSteps.length).toBeGreaterThanOrEqual(2);
  });

  it("marks cache-hit tool_result correctly", () => {
    const pricingResult = run.nodes.find(
      n => n.kind === "tool_result" && n.tool === "get_product_pricing"
    );
    expect(pricingResult?.cacheHit).toBe(true);
    expect(pricingResult?.durationMs).toBe(18);
  });
});

describe("replayEvents — modelFallbackTrace", () => {
  const run = replayEvents(
    "test-3",
    "Explain HKI envelope validation",
    modelFallbackTrace,
    3000
  );

  it("creates a MODEL_FALLBACK thinking node", () => {
    const fallback = run.nodes.find(
      n => n.kind === "thinking" && n.section === "MODEL_FALLBACK"
    );
    expect(fallback).toBeDefined();
    expect(fallback?.failedModel).toBe("gemini-2.0-flash-thinking-exp");
    expect(fallback?.fallbackModel).toBe("gemini-1.5-pro-002");
    expect(fallback?.status).toBe("warning");
  });
});

describe("replayEvents — humanEscalationTrace", () => {
  const run = replayEvents(
    "test-4",
    "Update member preference",
    humanEscalationTrace,
    4000
  );

  it("creates an escalation node", () => {
    const esc = run.nodes.find(n => n.kind === "escalation");
    expect(esc).toBeDefined();
    expect(esc?.availableActions).toContain("retry_modified");
    expect(esc?.availableActions).toContain("abort");
  });

  it("marks the tool_call as error", () => {
    const tc = run.nodes.find(n => n.kind === "tool_call");
    expect(tc?.status).toBe("error");
  });
});

describe("replayEvents — fastPathTrace", () => {
  const run = replayEvents("test-5", "Hi", fastPathTrace, 5000);

  it("has no tool_call nodes", () => {
    expect(run.nodes.filter(n => n.kind === "tool_call")).toHaveLength(0);
  });

  it("has no reflecting node", () => {
    expect(run.nodes.filter(n => n.kind === "reflecting")).toHaveLength(0);
  });

  it("still creates a response node", () => {
    expect(run.nodes.find(n => n.kind === "response")).toBeDefined();
  });
});
