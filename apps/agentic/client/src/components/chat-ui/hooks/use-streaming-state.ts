/**
 * useStreamingState — Derives live agent phase from WebSocket trace events.
 *
 * Consumes the same WebSocket connection used by the traces sidebar and
 * exposes a human-readable label for what the agent is currently doing.
 *
 * Phase mapping:
 *   thinking      → "Reasoning…"
 *   planning      → "Planning approach…"
 *   tool_call     → "Calling {toolName}…"
 *   executing     → "Executing…"
 *   tool_result   → "Processing results…"
 *   knowledge_retrieval → "Searching domain knowledge…"
 *   guardrail     → "Checking safety…"
 *   reflecting    → "Synthesizing response…"
 *   final_response → null (done)
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket, type WebSocketMessage } from "./use-socket";
import { trpc } from "@/lib/trpc";

/** Human-readable labels for each orchestrator trace event type */
const PHASE_LABELS: Record<string, string> = {
  thinking: "Reasoning…",
  planning: "Planning approach…",
  tool_call: "Calling tool…",
  executing: "Executing…",
  tool_result: "Processing results…",
  hki_envelope: "Sealing HKI envelope…",
  knowledge_retrieval: "Searching domain knowledge…",
  guardrail: "Checking safety…",
  prompt_stack: "Composing prompt…",
  reflecting: "Synthesizing response…",
  // Execution engine events
  plan_generated: "Plan ready",
  step_started: "Executing step…",
  step_verifying: "Verifying step…",
  step_verified: "Step verified ✓",
  step_failed: "Step failed",
  replanning: "Adjusting plan…",
  human_escalation: "Waiting for your decision…",
  rollback: "Rolling back…",
  scratchpad_update: "Updated working memory",
};

export type TraceStep = {
  type: string;
  content: string;
  metadata?: Record<string, any>;
  timestamp: string;
};

export type ExecutionPlanState = {
  planId: string;
  goal: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  steps: Array<{
    stepId: string;
    toolName: string;
    description: string;
    status: string;
    durationMs?: number;
    error?: string | null;
    verification?: {
      passed: boolean;
      schema_valid: boolean;
      reasoning: string;
    } | null;
  }>;
  replanned?: boolean;
};

export type InterventionState = {
  planId: string;
  failedStepId: string;
  error: string;
  context: string;
  completedSteps: string[];
  scratchpadSummary: Record<string, unknown>;
  availableActions: string[];
};

export type StreamingState = {
  /** Current phase label (null when idle or complete) */
  phaseLabel: string | null;
  /** Whether the agent is actively streaming */
  isStreaming: boolean;
  /** WebSocket connection status */
  isConnected: boolean;
  /** Number of trace steps received for the current message */
  stepCount: number;
  /** All collected trace steps for the current response (for inline display) */
  traceSteps: TraceStep[];
  /** LLM-generated follow-up suggestions from the orchestrator */
  suggestedFollowUps: string[];
  /** Active execution plan (null when not in task mode) */
  executionPlan: ExecutionPlanState | null;
  /** Pending human intervention request (null when not paused) */
  pendingIntervention: InterventionState | null;
  /** Incremental assistant response text while stream is active */
  liveResponseContent: string;
  /** Send a message to the server via WebSocket */
  sendWsMessage: (message: Record<string, unknown>) => void;
};

/** Event types that represent real execution progress (for step counter) */
const EXECUTION_EVENT_TYPES = new Set([
  "tool_call",
  "tool_result",
  "plan_generated",
  "step_started",
  "step_verifying",
  "step_verified",
  "step_failed",
  "replanning",
  "knowledge_retrieval",
  "hki_envelope",
  "prompt_stack",
]);

export function useStreamingState(
  conversationId: string | null
): StreamingState {
  const { lastMessage, isConnected, sendWsMessage } =
    useWebSocket(conversationId);
  const [phaseLabel, setPhaseLabel] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const isStreamingRef = useRef(false); // Ref mirror for inline reset check
  const [stepCount, setStepCount] = useState(0);
  const [traceSteps, setTraceSteps] = useState<TraceStep[]>([]);
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([]);
  const [executionPlan, setExecutionPlan] = useState<ExecutionPlanState | null>(
    null
  );
  const [pendingIntervention, setPendingIntervention] =
    useState<InterventionState | null>(null);
  const [liveResponseContent, setLiveResponseContent] = useState("");
  const utils = trpc.useUtils();
  const lastConversationId = useRef(conversationId);
  const finalResponseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when conversation changes + clean up timers
  useEffect(() => {
    if (conversationId !== lastConversationId.current) {
      lastConversationId.current = conversationId;
      if (finalResponseTimer.current) clearTimeout(finalResponseTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
      finalResponseTimer.current = null;
      safetyTimer.current = null;
      setPhaseLabel(null);
      setIsStreaming(false);
      setStepCount(0);
      setTraceSteps([]);
      setSuggestedFollowUps([]);
      setExecutionPlan(null);
      setPendingIntervention(null);
      setLiveResponseContent("");
    }
  }, [conversationId]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (finalResponseTimer.current) clearTimeout(finalResponseTimer.current);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    };
  }, []);

  // Process WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    // ── Handle reconnect recovery (fix #7) ──────────────────────────
    if (lastMessage.type === "reconnected") {
      if (isStreamingRef.current) {
        // WS reconnected during an active stream — events were lost.
        // Force-clear streaming state; the mutation's onSettled will refresh.
        setPhaseLabel(null);
        setIsStreaming(false);
        isStreamingRef.current = false;
        setLiveResponseContent("");
        if (conversationId) {
          utils.chat.getTask.invalidate({ conversationId });
        }
      }
      return;
    }

    if (lastMessage.eventType === "thought_trace") {
      const eventType = lastMessage.type as string;

      if (process.env.NODE_ENV === "development") {
        console.log(
          "[StreamingState] trace event:",
          eventType,
          lastMessage.metadata ?? ""
        );
      }

      if (eventType === "final_response") {
        // Clear safety timeout — we received the final response
        if (safetyTimer.current) {
          clearTimeout(safetyTimer.current);
          safetyTimer.current = null;
        }

        // Agent is done — close immediately.
        if (finalResponseTimer.current) {
          clearTimeout(finalResponseTimer.current);
          finalResponseTimer.current = null;
        }
        setPhaseLabel(null);
        setIsStreaming(false);
        isStreamingRef.current = false;
        setLiveResponseContent("");

        // Invalidate the messages query so the final response appears instantly
        // instead of waiting for the mutation's onSettled refetch
        if (conversationId) {
          utils.chat.getTask.invalidate({ conversationId });
          utils.chat.getTasks.invalidate();
        }
      } else if (eventType === "suggested_follow_ups") {
        // Arrives AFTER final_response — doesn't affect streaming state
        const followUps = lastMessage.metadata?.suggested_follow_ups;
        if (Array.isArray(followUps) && followUps.length > 0) {
          setSuggestedFollowUps(followUps.map(String));
        }
      } else if (eventType === "final_response_chunk") {
        // Incremental assistant text updates — keep stream active and
        // let TaskMessages render a live preview bubble.
        const wasStreaming = isStreamingRef.current;
        const chunkContent = String(lastMessage.content ?? "");

        if (!wasStreaming) {
          setStepCount(0);
          setTraceSteps([]);
          setSuggestedFollowUps([]);
          setExecutionPlan(null);
          setPendingIntervention(null);
        }
        if (finalResponseTimer.current) {
          clearTimeout(finalResponseTimer.current);
          finalResponseTimer.current = null;
        }
        if (safetyTimer.current) {
          clearTimeout(safetyTimer.current);
        }
        safetyTimer.current = setTimeout(() => {
          setPhaseLabel(null);
          setIsStreaming(false);
          isStreamingRef.current = false;
          setLiveResponseContent("");
          safetyTimer.current = null;
        }, 45_000);

        setIsStreaming(true);
        isStreamingRef.current = true;
        setPhaseLabel("Composing response…");
        setLiveResponseContent(
          prev => `${wasStreaming ? prev : ""}${chunkContent}`
        );
      } else {
        // ── Fix #4: Inline stream-start reset ──────────────────────
        // Reset state on the first event of a new stream instead of using a
        // useEffect transition (which fires after the first event is processed,
        // causing a race condition that loses the first trace step).
        if (!isStreamingRef.current) {
          setStepCount(0);
          setTraceSteps([]);
          setSuggestedFollowUps([]);
          setExecutionPlan(null);
          setPendingIntervention(null);
          setLiveResponseContent("");
        }

        // Active trace event — update the phase label
        // Cancel any pending final_response timer (prevents race condition
        // if a new stream starts before the old timer fires)
        if (finalResponseTimer.current) {
          clearTimeout(finalResponseTimer.current);
          finalResponseTimer.current = null;
        }

        // Reset safety timeout on every event (auto-close after 45s of silence)
        if (safetyTimer.current) {
          clearTimeout(safetyTimer.current);
        }
        safetyTimer.current = setTimeout(() => {
          setPhaseLabel(null);
          setIsStreaming(false);
          isStreamingRef.current = false;
          safetyTimer.current = null;
        }, 45_000);

        setIsStreaming(true);
        isStreamingRef.current = true;

        // Fix #3: Only count execution-relevant events as "steps" for the UI
        if (EXECUTION_EVENT_TYPES.has(eventType)) {
          setStepCount(prev => prev + 1);
        }

        // Collect step for inline trace display
        setTraceSteps(prev => [
          ...prev,
          {
            type: eventType,
            content: (lastMessage.content as string) || "",
            metadata: lastMessage.metadata,
            timestamp:
              (lastMessage.timestamp as string) || new Date().toISOString(),
          },
        ]);

        // Build a specific label for the current phase
        let label = PHASE_LABELS[eventType] || "Working…";
        if (eventType === "tool_call") {
          const toolName = String(
            lastMessage.metadata?.tool ||
              lastMessage.metadata?.tool_name ||
              "tool"
          )
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
          label = `Calling ${toolName}`;
        }
        if (eventType === "tool_result" && lastMessage.metadata?.result) {
          const result = lastMessage.metadata.result;
          const toolName = String(result.name || "tool")
            .replace(/_/g, " ")
            .replace(/\b\w/g, c => c.toUpperCase());
          label = result.error
            ? `${toolName} needs attention`
            : `Processed ${toolName}`;
        }
        // Structured reasoning sections — clean human-readable labels
        if (eventType === "thinking" && lastMessage.metadata?.section) {
          const SECTION_LABELS: Record<string, string> = {
            UNDERSTANDING: "Analyzing your question",
            KNOWLEDGE_RETRIEVAL: "Searching domain knowledge",
            SYNTHESIS: "Composing response",
            PLANNING: "Planning approach",
            EVALUATION: "Evaluating results",
          };
          const section = String(lastMessage.metadata.section);
          label =
            SECTION_LABELS[section] || lastMessage.content || "Thinking...";
        }
        if (eventType === "prompt_stack" && lastMessage.metadata?.summary) {
          const source = String(
            lastMessage.metadata.summary.domain_prompt_source || "runtime"
          ).replace(/_/g, " ");
          label = `Prompt stack ready (${source})`;
        }
        // Model escalation
        if (lastMessage.metadata?.escalation) {
          label = "Escalating to advanced model…";
        }

        // ── Execution engine events ──────────────────────────────
        if (eventType === "plan_generated" && lastMessage.metadata) {
          const m = lastMessage.metadata;
          setExecutionPlan({
            planId: String(m.plan_id ?? ""),
            goal: String(m.goal ?? ""),
            status: String(m.status ?? "executing"),
            totalSteps: Number(m.total_steps ?? 0),
            completedSteps: Number(m.completed_steps ?? 0),
            steps: Array.isArray(m.steps)
              ? m.steps.map((s: any) => ({
                  stepId: String(s.step_id ?? ""),
                  toolName: String(s.tool_name ?? ""),
                  description: String(s.description ?? ""),
                  status: String(s.status ?? "planned"),
                  durationMs: s.duration_ms ?? undefined,
                  error: s.error ?? null,
                  verification: s.verification ?? null,
                }))
              : [],
            replanned: Boolean(m.replanned),
          });
          label = `Plan: ${m.goal} (${m.total_steps} steps)`;
        }

        if (
          (eventType === "step_started" ||
            eventType === "step_verified" ||
            eventType === "step_failed") &&
          lastMessage.metadata
        ) {
          const m = lastMessage.metadata;
          // Update the step in the current plan
          setExecutionPlan(prev => {
            if (!prev) return prev;

            // Fix #1: Match step by ID first, then fall back to positional index.
            // The orchestrator may use different IDs than plan_generated provided,
            // so we also accept a step_index hint or match the first step with
            // a matching status.
            const matchIndex = prev.steps.findIndex(
              s => s.stepId === m.step_id
            );
            const resolvedIndex =
              matchIndex >= 0
                ? matchIndex
                : m.step_index != null
                  ? Number(m.step_index)
                  : prev.steps.findIndex(s =>
                      eventType === "step_started"
                        ? s.status === "planned"
                        : s.status === "executing" || s.status === "verifying"
                    );

            return {
              ...prev,
              completedSteps:
                eventType === "step_verified"
                  ? prev.completedSteps + 1
                  : prev.completedSteps,
              status: eventType === "step_failed" ? "failed" : prev.status,
              steps: prev.steps.map((s, idx) =>
                idx === resolvedIndex
                  ? {
                      ...s,
                      status: String(m.status ?? s.status),
                      durationMs: m.duration_ms ?? s.durationMs,
                      error: m.error ?? s.error,
                      verification: m.verification ?? s.verification,
                    }
                  : s
              ),
            };
          });

          if (eventType === "step_started") {
            const progress = lastMessage.metadata.plan_progress;
            label = progress
              ? `Step ${progress}: ${lastMessage.content}`
              : (lastMessage.content as string) || label;
          }
        }

        if (
          eventType === "human_escalation" &&
          lastMessage.metadata?.intervention
        ) {
          const iv = lastMessage.metadata.intervention;
          setPendingIntervention({
            planId: String(iv.plan_id ?? ""),
            failedStepId: String(iv.failed_step_id ?? ""),
            error: String(iv.error ?? ""),
            context: String(iv.context ?? ""),
            completedSteps: Array.isArray(iv.completed_steps)
              ? iv.completed_steps.map(String)
              : [],
            scratchpadSummary: iv.scratchpad_summary ?? {},
            availableActions: Array.isArray(iv.available_actions)
              ? iv.available_actions.map(String)
              : ["retry", "skip", "abort"],
          });
        }

        setPhaseLabel(label);
      }
    }
  }, [lastMessage, conversationId, utils]);

  return {
    phaseLabel,
    isStreaming,
    isConnected,
    stepCount,
    traceSteps,
    suggestedFollowUps,
    executionPlan,
    pendingIntervention,
    liveResponseContent,
    sendWsMessage,
  };
}
