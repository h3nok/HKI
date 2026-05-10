/**
 * TaskMessages - Premium Message Display
 * Enterprise-grade message rendering using HKI brand design tokens
 */

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useVirtualizer,
  defaultRangeExtractor,
  type Range as VirtualRange,
} from "@tanstack/react-virtual";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Bot } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TaskMessageTextContent } from "./task-message-text-content";
import { TaskMessageToolPair } from "./task-message-tool-pair";
import { MessageBubble } from "./message-bubble";
import { BrandLoader } from "@/components/ui/brand-loader";
import { ThinkingEnvelope } from "../ui/thinking-envelope";
import { buildChatFeedbackPayload } from "./chat-feedback";
import { extractEvidenceFromMessage } from "./citation-adapter";
import { EvidenceList } from "../ui/evidence-chip";
import { countInlineCitations } from "../ui/markdown-response";
import type {
  TraceStep,
  ExecutionPlanState,
  InterventionState,
} from "../hooks/use-streaming-state";
import { InlineReasoning } from "../ui/reasoning-card";
import {
  ExecutionPlanCard,
  type ExecutionPlanData,
  type ExecutionStepData,
  InterventionCard,
  type InterventionAction,
} from "@hki/ui";
import { TrustIndicator } from "../ui/trust-indicator";
import { GuardrailsIndicator, type GuardrailCheck } from "@hki/ui";
import { useTaskMessages } from "../hooks/use-task-messages";
import { tokens, BRAND, MOTION } from "@/design-system/tokens";
import { extractMessageConfidence } from "./task-message-metadata";
import type {
  TaskMessage,
  ToolRequestContent,
  ToolResponseContent,
} from "../types";

type PersistedThoughtTraceStep = {
  type: string;
  content: string;
  metadata?: string | null;
  createdAt: Date | string;
};

// ── Defensive layer helpers ─────────────────────────────────────────────

/** Extract guardrail results from real orchestrator metadata */
function extractGuardrails(messages: TaskMessage[]): {
  checks: GuardrailCheck[];
  overallStatus: "safe" | "warning" | "blocked";
} | null {
  // Find the first assistant message with real guardrails data
  for (const msg of [...messages].reverse()) {
    const gr = msg.attributes?.guardrails;
    if (gr) {
      const checks: GuardrailCheck[] = [];
      checks.push({
        name: "Input Validation",
        status: gr.input_violations.length === 0 ? "pass" : "fail",
        message:
          gr.input_violations.length > 0
            ? gr.input_violations.join(", ")
            : undefined,
      });
      checks.push({
        name: "Output Safety",
        status: gr.output_violations.length === 0 ? "pass" : "fail",
        message:
          gr.output_violations.length > 0
            ? gr.output_violations.join(", ")
            : undefined,
      });
      const overallStatus: "safe" | "warning" | "blocked" = gr.passed
        ? "safe"
        : gr.input_violations.length > 0 || gr.output_violations.length > 0
          ? "blocked"
          : "warning";
      return { checks, overallStatus };
    }
  }
  // No guardrails data from orchestrator — don't show fake badges
  return null;
}

function normalizePersistedTraceSteps(
  steps: PersistedThoughtTraceStep[] | undefined
): TraceStep[] {
  if (!steps || steps.length === 0) return [];

  return steps.map(step => {
    let metadata: Record<string, any> | undefined;
    if (step.metadata) {
      try {
        metadata = JSON.parse(step.metadata);
      } catch {
        metadata = undefined;
      }
    }

    return {
      type: step.type,
      content: step.content,
      metadata,
      timestamp:
        typeof step.createdAt === "string"
          ? step.createdAt
          : step.createdAt.toISOString(),
    };
  });
}

function isAgentTextMessage(
  message: TaskMessage | null | undefined
): message is TaskMessage & {
  content: Extract<TaskMessage["content"], { type: "text"; author: "agent" }>;
} {
  return Boolean(
    message &&
    message.content.type === "text" &&
    message.content.author === "agent"
  );
}

type TaskMessagesProps = {
  taskId: string;
  /** Whether a message is currently being sent (mutation in flight). Ground truth for thinking state. */
  isSending?: boolean;
  /** Live phase label from WebSocket (e.g. "Reasoning…", "Searching domain knowledge…") */
  agentPhaseLabel?: string | null;
  /** Collected trace steps from the current streaming session */
  agentTraceSteps?: TraceStep[];
  /** Whether the agent is actively streaming via WebSocket */
  isAgentStreaming?: boolean;
  /** Incremental assistant response text while stream is active */
  liveResponseContent?: string;
  /** Active execution plan (null when not in task mode) */
  executionPlan?: ExecutionPlanState | null;
  /** Pending human intervention request (null when not paused) */
  pendingIntervention?: InterventionState | null;
  /** Submit a human intervention response to the runtime. */
  onInterventionAction?: (request: InterventionResponseRequest) => void;
  /** LLM-generated follow-up suggestions from the last response (via WebSocket) */
  suggestedFollowUps?: string[];
  /** Called when user clicks a follow-up suggestion chip */
  onSuggestionSelect?: (suggestion: string) => void;
  onRegenerate?: (message: TaskMessage) => void;
  onPin?: (message: TaskMessage) => void;
  onReply?: (message: TaskMessage) => void;
  onInspectActivity?: (message: TaskMessage) => void;
  canRecordFeedback?: boolean;
  canOpenKnowledgeLibrary?: boolean;
  knowledgeLibraryScopeId?: string | null;
  /** Scroll container ref from useAutoScroll — required for virtualizer initialization */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
};

type MessagePair = {
  id: string;
  userMessage: TaskMessage;
  agentMessages: TaskMessage[];
};

export type InterventionResponseRequest = {
  intervention: InterventionState;
  action: InterventionAction;
};

function TaskMessagesImpl({
  taskId,
  isSending = false,
  agentPhaseLabel,
  agentTraceSteps = [],
  isAgentStreaming = false,
  liveResponseContent = "",
  executionPlan,
  pendingIntervention,
  onInterventionAction,
  suggestedFollowUps = [],
  onSuggestionSelect,
  onRegenerate,
  onPin,
  onReply,
  onInspectActivity,
  canRecordFeedback = false,
  canOpenKnowledgeLibrary = false,
  knowledgeLibraryScopeId,
  scrollContainerRef,
}: TaskMessagesProps) {
  const { data: queryData, isLoading } = useTaskMessages(taskId);
  const feedbackMut = trpc.knowledge.chunkFeedback.useMutation({
    onError: error =>
      console.warn("[ChatFeedback] Failed to record feedback:", error.message),
  });

  const messages = useMemo(() => queryData?.messages ?? [], [queryData]);

  const handleAgentFeedback = useCallback(
    (
      userMessage: TaskMessage,
      agentMessage: TaskMessage,
      signal: "up" | "down"
    ) => {
      if (!canRecordFeedback) return;

      const payload = buildChatFeedbackPayload({
        userMessage,
        agentMessage,
        signal,
      });
      if (!payload) return;

      feedbackMut.mutate(payload);
    },
    [canRecordFeedback, feedbackMut]
  );

  // Track "freshly arrived" message IDs for typewriter animation.
  // When isSending transitions from true→false and new agent messages appeared,
  // those IDs get the typewriter effect on their first render.
  const [freshMessageIds, setFreshMessageIds] = useState<Set<string>>(
    new Set()
  );
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  const wasSendingRef = useRef(false);

  useEffect(() => {
    const currentIds = new Set(messages.map(m => m.id));

    // Detect send completion: was sending, now not sending
    if (wasSendingRef.current && !isSending) {
      const newAgentIds = messages
        .filter(m => {
          if (prevMessageIdsRef.current.has(m.id)) return false;
          if (m.content.type !== "text" || m.content.author !== "agent")
            return false;
          const text = m.content.content.trim().toLowerCase();
          return text !== "thinking..." && text !== "thinking";
        })
        .map(m => m.id);

      if (newAgentIds.length > 0) {
        setFreshMessageIds(new Set(newAgentIds));
        // Auto-clear after typewriter completes (~3s)
        setTimeout(() => setFreshMessageIds(new Set()), 4000);
      }
    }

    wasSendingRef.current = isSending;
    prevMessageIdsRef.current = currentIds;
  }, [messages, isSending]);

  // Clear fresh IDs when switching tasks
  useEffect(() => {
    setFreshMessageIds(new Set());
  }, [taskId]);

  // Build tool call ID to response map
  const toolCallIdToResponseMap = useMemo<
    Map<string, TaskMessage & { content: ToolResponseContent }>
  >(
    () =>
      new Map(
        messages
          .filter(
            (m): m is TaskMessage & { content: ToolResponseContent } =>
              m.content.type === "tool_response"
          )
          .map(m => [m.content.tool_call_id, m])
      ),
    [messages]
  );

  // Group messages into user/agent pairs
  const messagePairs = useMemo<MessagePair[]>(() => {
    const pairs: MessagePair[] = [];
    let currentUserMessage: TaskMessage | null = null;
    let currentAgentMessages: TaskMessage[] = [];

    for (const message of messages) {
      const isUserMessage = message.content.author === "user";

      if (isUserMessage) {
        if (currentUserMessage) {
          pairs.push({
            id: currentUserMessage.id || `pair-${pairs.length}`,
            userMessage: currentUserMessage,
            agentMessages: currentAgentMessages,
          });
        }
        currentUserMessage = message;
        currentAgentMessages = [];
      } else {
        if (currentUserMessage) {
          currentAgentMessages.push(message);
        }
      }
    }

    if (currentUserMessage) {
      pairs.push({
        id: currentUserMessage.id || `pair-${pairs.length}`,
        userMessage: currentUserMessage,
        agentMessages: currentAgentMessages,
      });
    }

    return pairs;
  }, [messages]);

  const lastPair = useMemo(
    () => messagePairs[messagePairs.length - 1] ?? null,
    [messagePairs]
  );

  const lastAgentTextMessage = useMemo(() => {
    if (!lastPair) return null;
    return (
      [...lastPair.agentMessages].reverse().find(isAgentTextMessage) ?? null
    );
  }, [lastPair]);

  const lastAgentEvidence = useMemo(
    () =>
      lastAgentTextMessage
        ? extractEvidenceFromMessage(lastAgentTextMessage)
        : [],
    [lastAgentTextMessage]
  );

  const thoughtTraceQ = trpc.chat.getThoughtTrace.useQuery(
    { messageId: lastAgentTextMessage?.id ?? "" },
    {
      enabled: Boolean(lastAgentTextMessage?.id) && !isAgentStreaming,
      refetchOnWindowFocus: false,
    }
  );

  const persistedTraceSteps = useMemo(
    () =>
      normalizePersistedTraceSteps(
        thoughtTraceQ.data as PersistedThoughtTraceStep[] | undefined
      ),
    [thoughtTraceQ.data]
  );

  const shouldShowThinking = useMemo(() => {
    // Ground truth: if the mutation is in flight, the agent is working.
    // We only show thinking if a send is actively pending AND the last pair
    // doesn't already have a real response (handles the brief moment between
    // mutation completing and the query refetch returning the new data).
    if (!isSending) return false;
    if (messagePairs.length === 0) return true; // Sending first message

    const lastPair = messagePairs[messagePairs.length - 1]!;

    // Check if we already have a real agent response in the last pair
    const hasRealContent = lastPair.agentMessages.some(m => {
      if (m.content.type === "text") {
        const text = m.content.content.trim().toLowerCase();
        return text !== "thinking..." && text !== "thinking";
      }
      return m.content.type === "tool_request";
    });

    return !hasRealContent;
  }, [messagePairs, isSending]);

  const envelopeTraceSteps = useMemo(() => {
    if (isAgentStreaming || shouldShowThinking) {
      return agentTraceSteps;
    }

    return persistedTraceSteps.length > 0
      ? persistedTraceSteps
      : agentTraceSteps;
  }, [
    agentTraceSteps,
    isAgentStreaming,
    persistedTraceSteps,
    shouldShowThinking,
  ]);

  // Track if the last pair has tool requests (for StreamingIndicator phase)
  const hasToolRequests = useMemo(() => {
    if (messagePairs.length === 0) return false;
    const lastPair = messagePairs[messagePairs.length - 1]!;
    return lastPair.agentMessages.some(m => m.content.type === "tool_request");
  }, [messagePairs]);

  // ── Virtualization ────────────────────────────────────────────────────────
  // Force a re-render after mount so the virtualizer picks up the scroll element
  // (refs are set synchronously during commit, before layout effects run).
  const [, setMounted] = useState(false);
  useLayoutEffect(() => {
    setMounted(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rangeExtractor = useCallback(
    (range: VirtualRange) => {
      const lastIdx = messagePairs.length - 1;
      const base = defaultRangeExtractor(range);
      // Always keep the last pair rendered so streaming/thinking states are always visible
      if (lastIdx >= 0 && !base.includes(lastIdx)) {
        return [...base, lastIdx].sort((a, b) => a - b);
      }
      return base;
    },
    [messagePairs.length]
  );

  const virtualizer = useVirtualizer({
    count: messagePairs.length,
    getScrollElement: () => scrollContainerRef?.current ?? null,
    estimateSize: () => 220, // rough initial estimate per pair (px, including pb-6 gap)
    overscan: 4,
    rangeExtractor,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const renderMessage = (message: TaskMessage) => {
    switch (message.content.type) {
      case "text": {
        const evidence =
          message.content.author === "agent"
            ? extractEvidenceFromMessage(message)
            : [];
        const suppressInlineSources =
          message.content.author === "agent" &&
          message.id === lastAgentTextMessage?.id &&
          !shouldShowThinking &&
          extractMessageConfidence(lastAgentTextMessage) !== null &&
          lastAgentEvidence.length > 0;

        // When the response text has inline [1], [2] markers and we have
        // matching evidence, render them as interactive chips inline and
        // suppress the separate SOURCES row at the bottom.
        const textContent =
          message.content.type === "text" ? message.content.content : "";
        const inlineCitationCount =
          evidence.length > 0 ? countInlineCitations(textContent) : 0;
        const hasInlineCitations = inlineCitationCount > 0;

        return (
          <>
            <TaskMessageTextContent
              content={message.content}
              isStreaming={message.streaming_status === "STREAMING"}
              animate={
                message.streaming_status === "STREAMING" ||
                freshMessageIds.has(message.id)
              }
              evidence={evidence.length > 0 ? evidence : undefined}
              canViewLibrary={canOpenKnowledgeLibrary}
              libraryScopeId={knowledgeLibraryScopeId}
            />

            {message.content.author === "agent" &&
            message.streaming_status !== "STREAMING" &&
            evidence.length > 0 &&
            !suppressInlineSources &&
            !hasInlineCitations ? (
              <div className="mt-4 border-t border-border/40 pt-3">
                <div
                  className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em]"
                  style={{ color: BRAND.blue[700] }}
                >
                  <BookOpen className="h-3.5 w-3.5" />
                  Sources
                </div>

                <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <EvidenceList
                    evidences={evidence}
                    canViewLibrary={canOpenKnowledgeLibrary}
                    libraryScopeId={knowledgeLibraryScopeId}
                  />
                </div>
              </div>
            ) : null}
          </>
        );
      }
      case "tool_request": {
        const toolCallId = message.content.tool_call_id;

        // Show tool request paired with its response (if available)
        return (
          <TaskMessageToolPair
            toolRequestMessage={
              message as TaskMessage & { content: ToolRequestContent }
            }
            toolResponseMessage={toolCallIdToResponseMap.get(toolCallId)}
          />
        );
      }
      case "tool_response":
        return null; // Handled by tool pair
      case "reasoning":
        return <InlineReasoning content={message.content.content} />;
      default:
        return null;
    }
  };

  if (isLoading && !isSending) {
    return <BrandLoader variant="inline" message="Loading conversation…" />;
  }

  if (messagePairs.length === 0 && !shouldShowThinking) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 h-full text-center">
        <div
          className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--primary) 8%, var(--muted))",
          }}
        >
          <Bot
            className="w-8 h-8"
            style={{ color: "var(--primary)", opacity: 0.6 }}
          />
        </div>
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          Start the conversation by sending a message
        </p>
      </div>
    );
  }

  // First message being sent — no message pairs yet
  if (messagePairs.length === 0 && (shouldShowThinking || isAgentStreaming)) {
    return (
      <div className="flex flex-col w-full py-4">
        <ThinkingEnvelope
          steps={agentTraceSteps}
          isStreaming={isAgentStreaming || shouldShowThinking}
          phaseLabel={agentPhaseLabel}
        />
      </div>
    );
  }

  // Virtualized render: only ~4 pairs above/below viewport are in the DOM.
  // The last pair is always included via rangeExtractor so streaming/thinking
  // states are never unmounted.
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      aria-atomic="false"
      className="relative w-full"
      style={{ height: totalSize }}
    >
      {virtualItems.map(virtualItem => {
        const pair = messagePairs[virtualItem.index]!;
        const isLastPair = virtualItem.index === messagePairs.length - 1;

        return (
          <div
            key={pair.id}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
              width: "100%",
            }}
            className="pb-6"
          >
            <div className="space-y-4">
              {/* User message — only animate on the new (last) pair */}
              <motion.div
                key={`user-${pair.id}`}
                initial={isLastPair ? { opacity: 0, y: 8 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                <MessageBubble
                  message={pair.userMessage}
                  isUser={true}
                  onPin={() => onPin?.(pair.userMessage)}
                  onReply={() => onReply?.(pair.userMessage)}
                  onRegenerate={
                    onRegenerate
                      ? () => onRegenerate(pair.userMessage)
                      : undefined
                  }
                >
                  {renderMessage(pair.userMessage)}
                </MessageBubble>
              </motion.div>

              {/* Thinking envelope — visible while agent is working, collapsed summary after */}
              {isLastPair && (
                <ThinkingEnvelope
                  steps={envelopeTraceSteps}
                  isStreaming={
                    isAgentStreaming || (shouldShowThinking && isLastPair)
                  }
                  phaseLabel={agentPhaseLabel}
                  fallbackCitations={
                    lastAgentTextMessage?.attributes?.citations
                  }
                />
              )}

              {/* Execution Plan Card — renders when orchestrator is in task mode */}
              {isLastPair &&
                executionPlan &&
                executionPlan.steps.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="w-full"
                  >
                    <ExecutionPlanCard
                      plan={{
                        planId: executionPlan.planId,
                        goal: executionPlan.goal,
                        status:
                          executionPlan.status as ExecutionPlanData["status"],
                        totalSteps: executionPlan.totalSteps,
                        completedSteps: executionPlan.completedSteps,
                        replanned: executionPlan.replanned,
                        steps: executionPlan.steps.map(s => ({
                          stepId: s.stepId,
                          toolName: s.toolName,
                          description: s.description,
                          status: s.status as ExecutionStepData["status"],
                          durationMs: s.durationMs,
                          error: s.error,
                          verification: s.verification,
                        })),
                      }}
                    />
                  </motion.div>
                )}

              {/* Intervention Card — renders when agent needs human decision */}
              {isLastPair && pendingIntervention && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <InterventionCard
                    intervention={{
                      planId: pendingIntervention.planId,
                      failedStepId: pendingIntervention.failedStepId,
                      error: pendingIntervention.error,
                      context: pendingIntervention.context,
                      completedSteps: pendingIntervention.completedSteps,
                      scratchpadSummary: pendingIntervention.scratchpadSummary,
                      availableActions:
                        pendingIntervention.availableActions as InterventionAction[],
                    }}
                    onAction={(action: InterventionAction) => {
                      onInterventionAction?.({
                        intervention: pendingIntervention,
                        action,
                      });
                    }}
                  />
                </motion.div>
              )}

              {/* Agent messages — tool pairs are rendered inside ThinkingEnvelope */}
              {pair.agentMessages.length > 0 &&
                (() => {
                  // Pre-compute trust data so we can inject it into the last agent message's action bar
                  let trustSlot: React.ReactNode = null;
                  let lastAgentTextId: string | null = null;

                  if (
                    isLastPair &&
                    !shouldShowThinking &&
                    lastAgentTextMessage
                  ) {
                    lastAgentTextId = lastAgentTextMessage.id;
                    const confidence =
                      extractMessageConfidence(lastAgentTextMessage);
                    if (confidence !== null && lastAgentEvidence.length > 0) {
                      trustSlot = (
                        <TrustIndicator
                          score={confidence}
                          evidences={lastAgentEvidence}
                          canViewLibrary={canOpenKnowledgeLibrary}
                          libraryScopeId={knowledgeLibraryScopeId}
                        />
                      );
                    }
                  }

                  return pair.agentMessages.map(agentMessage => {
                    if (
                      agentMessage.content.type === "tool_request" ||
                      agentMessage.content.type === "tool_response"
                    ) {
                      return null;
                    }
                    if (agentMessage.content.type === "text") {
                      const text = agentMessage.content.content
                        .trim()
                        .toLowerCase();
                      if (text === "thinking..." || text === "thinking")
                        return null;
                    }
                    return (
                      <motion.div
                        key={agentMessage.id}
                        initial={isLastPair ? { opacity: 0, y: 8 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <MessageBubble
                          message={agentMessage}
                          isUser={false}
                          variant="minimal"
                          onPin={() => onPin?.(agentMessage)}
                          onReply={() => onReply?.(agentMessage)}
                          onFeedback={
                            canRecordFeedback &&
                            agentMessage.content.type === "text" &&
                            agentMessage.content.author === "agent"
                              ? (_messageId, sentiment) =>
                                  handleAgentFeedback(
                                    pair.userMessage,
                                    agentMessage,
                                    sentiment
                                  )
                              : undefined
                          }
                          onRegenerate={
                            onRegenerate
                              ? () => onRegenerate(pair.userMessage)
                              : undefined
                          }
                          onInspectActivity={
                            onInspectActivity &&
                            agentMessage.content.type === "text" &&
                            agentMessage.content.author === "agent"
                              ? () => onInspectActivity(agentMessage)
                              : undefined
                          }
                          actionSlot={
                            agentMessage.id === lastAgentTextId
                              ? trustSlot
                              : undefined
                          }
                        >
                          {renderMessage(agentMessage)}
                        </MessageBubble>
                      </motion.div>
                    );
                  });
                })()}

              {/* Live streaming preview bubble (before final DB message persists) */}
              {isLastPair &&
                isAgentStreaming &&
                liveResponseContent.trim().length > 0 && (
                  <motion.div
                    key={`${pair.id}-live-streaming-preview`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <MessageBubble
                      message={{
                        id: `${pair.id}-live-streaming-preview`,
                        task_id: taskId,
                        content: {
                          type: "text",
                          author: "agent",
                          format: "markdown",
                          content: liveResponseContent,
                        },
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        streaming_status: "STREAMING",
                      }}
                      isUser={false}
                      variant="minimal"
                      showActions={false}
                    >
                      <TaskMessageTextContent
                        content={{
                          type: "text",
                          author: "agent",
                          format: "markdown",
                          content: liveResponseContent,
                        }}
                        isStreaming
                        animate
                      />
                    </MessageBubble>
                  </motion.div>
                )}

              {/* Guardrails badge (safety-critical — stays as standalone row) */}
              {isLastPair &&
                !shouldShowThinking &&
                pair.agentMessages.length > 0 &&
                (() => {
                  const guardrails = extractGuardrails(pair.agentMessages);
                  if (!guardrails || guardrails.overallStatus === "safe")
                    return null;
                  return (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="mt-0.5 pl-0.5"
                    >
                      <GuardrailsIndicator
                        checks={guardrails.checks}
                        overallStatus={guardrails.overallStatus}
                      />
                    </motion.div>
                  );
                })()}

              {/* Follow-up suggestion chips */}
              {isLastPair &&
                !shouldShowThinking &&
                !isAgentStreaming &&
                suggestedFollowUps.length > 0 &&
                pair.agentMessages.some(
                  m => m.content.type === "text" && m.content.author === "agent"
                ) && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.25 }}
                    className="flex flex-wrap gap-2 mt-2"
                    aria-label="Suggested follow-ups"
                  >
                    {suggestedFollowUps.map(suggestion => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => onSuggestionSelect?.(suggestion)}
                        className="text-[12px] px-3 py-1.5 rounded-full border border-border/60
                                   bg-muted/40 text-muted-foreground
                                   hover:text-primary hover:bg-primary/8 hover:border-primary/30
                                   transition-all duration-150 cursor-pointer text-left
                                   focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </motion.div>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const TaskMessages = memo(TaskMessagesImpl);
