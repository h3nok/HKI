import { useState, useEffect, useRef, useMemo } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import {
  PanelRightClose,
  PanelRightOpen,
  Activity,
  Zap,
  Bot,
  Shield,
  Database,
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  Search,
  Wrench,
  Brain,
  AlertCircle,
  Layers,
} from "lucide-react";
import { useSpans } from "../hooks/use-spans";
import { useWebSocket } from "../hooks/use-socket";
import { useTaskMessages } from "../hooks/use-task-messages";
import {
  MultiAgentDashboard,
  type Agent,
} from "../agents/multi-agent-dashboard";
import type { GuardrailCheck } from "@hki/ui";
import { ContextPanel, type ContextItem } from "../ui/context-panel";
import {
  AgentFlowVisualizer,
  type AgentNode,
  type AgentHandoff,
} from "../agents/agent-flow-visualizer";
import { JsonViewer } from "../ui/json-viewer";
import { TaskProgressCompact, type TaskStep } from "../ui/task-progress";
import type { JsonValue, Span } from "../types";
import { LAYOUT, FONT_FAMILY } from "@/design-system/tokens";
import { cn, ui } from "@hki/ui";
import { useScope } from "@/_core/hooks/useScope";

type TracesSidebarProps = {
  isOpen: boolean;
  onToggle: () => void;
  messageId: string | null;
  taskId?: string | null;
};

type TabId = "activity" | "agents" | "safety" | "context";

// Human-readable step names for the activity panel
const STEP_NAMES: Record<string, string> = {
  guardrail: "Safety Check",
  routing: "Routing Request",
  prompt_stack: "Prompt Stack",
  memory_recall: "Recalling Context",
  thinking: "Reasoning",
  planning: "Planning Approach",
  tool_call: "Tool Execution",
  tool_result: "Tool Result",
  knowledge_retrieval: "Knowledge Search",
  reflecting: "Synthesizing Response",
  executing: "Executing",
  cache_hit: "Cache Hit",
  // Execution engine events
  plan_generated: "Execution Plan",
  step_started: "Step Started",
  step_verifying: "Verifying Step",
  step_verified: "Step Verified",
  step_failed: "Step Failed",
  replanning: "Replanning",
  human_escalation: "Needs Decision",
  rollback: "Rolling Back",
  scratchpad_update: "Working Memory",
};

// Internal steps hidden from the activity panel
const HIDDEN_STEP_TYPES = new Set(["memory_store", "final_response"]);

// Tab configuration
const TABS: { id: TabId; label: string; icon: typeof Activity }[] = [
  { id: "activity", label: "Activity", icon: Zap },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "safety", label: "Safety", icon: Shield },
  { id: "context", label: "Context", icon: Database },
];

export function TracesSidebar({
  isOpen,
  onToggle,
  messageId,
  taskId,
}: TracesSidebarProps) {
  const { activeScopeDef } = useScope();
  const {
    spans: historicalSpans,
    isLoading,
    error,
  } = useSpans(messageId, taskId);
  const [liveSpans, setLiveSpans] = useState<Span[]>([]);
  const { lastMessage, isConnected } = useWebSocket(taskId || null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>("activity");

  // Collapsible step state
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Conversation data for deriving real context
  const { data: taskData } = useTaskMessages(taskId || null);
  const conversationMessages = useMemo(
    () => taskData?.messages ?? [],
    [taskData]
  );

  const toggleStep = (id: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Auto-scroll to bottom when new live spans arrive
  useEffect(() => {
    if (!messageId && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [liveSpans, messageId]);

  // Handle live WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.eventType === "thought_trace") {
      const eventType = String(lastMessage.type || "working");

      // Skip internal steps that aren't meaningful to the user
      if (HIDDEN_STEP_TYPES.has(eventType)) return;

      // Build a human-readable name
      let stepName =
        STEP_NAMES[eventType] ||
        eventType.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      if (eventType === "tool_call" && lastMessage.metadata?.tool_name) {
        stepName = `Calling ${String(lastMessage.metadata.tool_name)
          .replace(/_/g, " ")
          .replace(/\b\w/g, c => c.toUpperCase())}`;
      }
      if (eventType === "routing" && lastMessage.metadata?.routed_to) {
        stepName = `Routed to ${lastMessage.metadata.routed_to}`;
      }
      if (eventType === "prompt_stack") {
        stepName = "Prompt stack composed";
      }
      // Structured reasoning sections get their section label + icon
      if (eventType === "thinking" && lastMessage.metadata?.section) {
        const icon = lastMessage.metadata.icon || "🧠";
        stepName = `${icon} ${lastMessage.metadata.section}`;
      }
      // Model escalation
      if (lastMessage.metadata?.escalation) {
        stepName = "⚡ Escalating to advanced model";
      }

      const newSpan: Span = {
        id: `live-${Date.now()}-${Math.random()}`,
        name: stepName,
        task_id: taskId || "",
        start_time: lastMessage.timestamp || new Date().toISOString(),
        attributes: {
          type: eventType,
          step: lastMessage.step,
          content: lastMessage.content,
          ...lastMessage.metadata,
        },
      };
      // Cap at 500 spans to prevent unbounded memory growth
      const MAX_LIVE_SPANS = 500;
      setLiveSpans(prev => {
        const next = [...prev, newSpan];
        return next.length > MAX_LIVE_SPANS
          ? next.slice(-MAX_LIVE_SPANS)
          : next;
      });
    } else if (lastMessage.type === "final_response") {
      // Keep spans for a bit then clear or let user select the new message
    }
  }, [lastMessage, taskId]);

  // Clear live spans when switching tasks
  useEffect(() => {
    setLiveSpans([]);
  }, [taskId]);

  // Determine which spans to show
  const isLiveMode = !messageId;
  const displaySpans = isLiveMode ? liveSpans : historicalSpans;

  // ── Derived data from real spans & conversation ───────────────────

  /** Build agent workflow nodes from actual thought-trace steps */
  const flowAgents = useMemo<AgentNode[]>(() => {
    if (displaySpans.length === 0) return [];

    const typeMapping: Record<
      string,
      { type: AgentNode["type"]; name: string }
    > = {
      thinking: { type: "supervisor", name: "Reasoning" },
      planning: { type: "router", name: "Planning" },
      executing: { type: "tool-use", name: "Tool Execution" },
      tool_call: { type: "tool-use", name: "Tool Execution" },
      tool_result: { type: "tool-use", name: "Tool Execution" },
      reflecting: { type: "retail", name: "Synthesis" },
    };

    const nodes: AgentNode[] = [];
    const seen = new Set<string>();

    for (const span of displaySpans) {
      const spanType = String(span.attributes?.type || "thinking");
      const key = ["executing", "tool_call", "tool_result"].includes(spanType)
        ? "tool-use"
        : spanType;
      if (seen.has(key)) continue;
      seen.add(key);

      const mapping = typeMapping[spanType];
      if (!mapping) continue;

      const isLastSpan = span === displaySpans[displaySpans.length - 1];
      nodes.push({
        id: key,
        type: mapping.type,
        name: mapping.name,
        status: isLastSpan && isLiveMode ? "active" : "completed",
        message: String(span.attributes?.content || "").slice(0, 60),
      });
    }
    return nodes;
  }, [displaySpans, isLiveMode]);

  /** Currently-active agent derived from the latest span */
  const currentFlowAgent = useMemo<AgentNode["type"] | undefined>(() => {
    if (displaySpans.length === 0) return undefined;
    const last = String(
      displaySpans[displaySpans.length - 1].attributes?.type || ""
    );
    if (["tool_call", "executing", "tool_result"].includes(last))
      return "tool-use";
    if (last === "reflecting") return "retail";
    if (last === "planning") return "router";
    return "supervisor";
  }, [displaySpans]);

  /** Auto-derive handoffs from sequential workflow nodes */
  const handoffs = useMemo<AgentHandoff[]>(() => {
    if (flowAgents.length < 2) return [];
    return flowAgents.slice(0, -1).map((node, i) => ({
      from: node.type,
      to: flowAgents[i + 1].type,
      timestamp: Date.now(),
    }));
  }, [flowAgents]);

  /** Per-agent stats aggregated from real spans */
  const agents = useMemo<Agent[]>(() => {
    if (displaySpans.length === 0) return [];

    const map = new Map<string, Agent>();
    for (const span of displaySpans) {
      const t = String(span.attributes?.type || "thinking");
      let agentType: Agent["type"], agentName: string;
      if (["thinking", "planning"].includes(t)) {
        agentType = "supervisor";
        agentName = "Supervisor";
      } else if (["executing", "tool_call", "tool_result"].includes(t)) {
        agentType = "tool-use";
        agentName = "Tool Executor";
      } else if (t === "reflecting") {
        agentType = "retail";
        agentName = "Synthesis";
      } else {
        agentType = "supervisor";
        agentName = "Supervisor";
      }

      if (!map.has(agentType)) {
        map.set(agentType, {
          id: agentType,
          name: agentName,
          type: agentType,
          status: "idle",
          tasksCompleted: 0,
          successRate: 1.0,
        });
      }
      map.get(agentType)!.tasksCompleted += 1;
    }

    // Mark the last span's agent as active during live mode
    if (isLiveMode && displaySpans.length > 0) {
      const lastType = String(
        displaySpans[displaySpans.length - 1].attributes?.type || ""
      );
      let activeKey: Agent["type"] = "supervisor";
      if (["executing", "tool_call", "tool_result"].includes(lastType))
        activeKey = "tool-use";
      else if (lastType === "reflecting") activeKey = "retail";
      const active = map.get(activeKey);
      if (active) {
        active.status = "active";
        active.currentTask = String(
          displaySpans[displaySpans.length - 1].attributes?.content || ""
        ).slice(0, 50);
      }
    }
    return Array.from(map.values());
  }, [displaySpans, isLiveMode]);

  /** Guardrail results derived from actual orchestrator data when available,
   *  otherwise inferred from server-side processing state.
   *  The server runs checkInputGuardrails / checkOutputGuardrails on every message.
   *  If spans exist → the message was processed → input guardrails passed.
   *  If a reflection/final span exists → output guardrails passed. */
  const guardrailChecks = useMemo<GuardrailCheck[]>(() => {
    // Prefer real guardrails data from the orchestrator if available on any message
    for (const msg of [...conversationMessages].reverse()) {
      const gr = (msg as any).attributes?.guardrails;
      if (gr) {
        const checks: GuardrailCheck[] = [];
        checks.push({
          name: "Input Validation",
          status:
            gr.input_violations?.length === 0
              ? ("pass" as const)
              : ("fail" as const),
        });
        checks.push({
          name: "Output Safety",
          status:
            gr.output_violations?.length === 0
              ? ("pass" as const)
              : ("fail" as const),
        });
        return checks;
      }
    }

    // Fallback: infer from trace spans when no real guardrails data
    const processed = displaySpans.length > 0;
    const hasOutput = displaySpans.some(s =>
      ["reflecting", "tool_result"].includes(String(s.attributes?.type))
    );
    return [
      {
        name: "Input Validation",
        status: processed ? ("pass" as const) : ("warn" as const),
      },
      {
        name: "Output Safety",
        status: hasOutput ? ("pass" as const) : ("warn" as const),
      },
    ];
  }, [displaySpans, conversationMessages]);

  const guardrailOverall = useMemo<"safe" | "warning" | "blocked">(() => {
    if (guardrailChecks.every(c => c.status === "pass")) return "safe";
    if (guardrailChecks.some(c => c.status === "fail")) return "blocked";
    return "warning";
  }, [guardrailChecks]);

  /** Context items built from real conversation data & tool invocations */
  const contextItems = useMemo<ContextItem[]>(() => {
    const items: ContextItem[] = [];
    const userMsgs = conversationMessages.filter(
      m => m.content.author === "user"
    );
    const agentMsgs = conversationMessages.filter(
      m => m.content.author === "agent"
    );

    if (conversationMessages.length > 0) {
      items.push({
        id: "ctx-session",
        type: "session",
        title: "Conversation",
        content: `${userMsgs.length} user message${userMsgs.length !== 1 ? "s" : ""}, ${agentMsgs.length} agent response${agentMsgs.length !== 1 ? "s" : ""}`,
        timestamp: new Date().toISOString(),
      });
    }

    const toolSpans = displaySpans.filter(
      s => String(s.attributes?.type) === "tool_call"
    );
    if (toolSpans.length > 0) {
      const names = [
        ...Array.from(
          new Set(toolSpans.map(s => String(s.attributes?.toolName || s.name)))
        ),
      ];
      items.push({
        id: "ctx-tools",
        type: "retrieval",
        title: "Tools Invoked",
        content: names.join(", "),
        source: "tool-executor",
        relevance: 1.0,
      });
    }

    const promptStackSpan = displaySpans.find(
      s => String(s.attributes?.type) === "prompt_stack"
    );
    if (promptStackSpan) {
      const sections = Array.isArray(promptStackSpan.attributes?.sections)
        ? (promptStackSpan.attributes?.sections as Array<
            Record<string, unknown>
          >)
        : [];
      const summary = sections
        .map(section => {
          const title = String(section.title || section.key || "Layer");
          const source = String(section.source || "runtime");
          return `${title}: ${source}`;
        })
        .join(" • ");
      items.push({
        id: "ctx-prompt-stack",
        type: "session",
        title: "Active Prompt Stack",
        content:
          summary ||
          "Layered platform constitution, domain persona, and runtime policy applied.",
        source: "orchestrator",
      });
    }

    const latestProvenance = [...agentMsgs]
      .reverse()
      .find(
        msg =>
          msg.content.type === "text" && Boolean(msg.attributes?.provenance)
      )?.attributes?.provenance as Record<string, unknown> | undefined;

    if (!promptStackSpan && latestProvenance) {
      const promptStack =
        (latestProvenance.prompt_stack as
          | Record<string, unknown>
          | undefined) ?? undefined;
      if (promptStack) {
        const source = String(
          promptStack.domain_prompt_source || "runtime"
        ).replace(/_/g, " ");
        const layerCount = Number(promptStack.layer_count || 0);
        const toolCount = Number(promptStack.enabled_tool_count || 0);
        items.push({
          id: "ctx-prompt-stack-provenance",
          type: "session",
          title: "Prompt Stack Snapshot",
          content: `${layerCount || 0} layers • ${toolCount || 0} tools • domain source: ${source}`,
          source: "message-provenance",
        });
      }
    }

    if (latestProvenance) {
      const policy =
        (latestProvenance.execution_policy as
          | Record<string, unknown>
          | undefined) ?? undefined;
      if (policy) {
        const toolPermissions =
          (policy.tool_permissions as Record<string, unknown> | undefined) ??
          undefined;
        const approvalMode = String(
          toolPermissions?.approval_mode || "sensitive_only"
        ).replace(/_/g, " ");
        items.push({
          id: "ctx-execution-policy",
          type: "session",
          title: "Execution Policy",
          content: `${String(policy.model_tier || latestProvenance.model_tier || "auto")} tier • planning ${policy.enable_planning === false ? "off" : "on"} • approvals ${approvalMode}`,
          source: "message-provenance",
        });
      }
    }

    return items;
  }, [conversationMessages, displaySpans]);

  /** Estimate token usage from actual message content */
  const { usedTokens, maxTokens } = useMemo(() => {
    let chars = 0;
    for (const msg of conversationMessages) {
      if (msg.content.type === "text") chars += msg.content.content.length;
    }
    return { usedTokens: Math.round(chars / 4), maxTokens: 128_000 };
  }, [conversationMessages]);

  // Derive TaskProgress steps from spans
  const progressSteps = useMemo<TaskStep[]>(() => {
    if (displaySpans.length === 0) return [];
    return displaySpans.map((span, idx) => {
      const type = String(span.attributes?.type || "reasoning");
      const isLast = idx === displaySpans.length - 1;
      const status: TaskStep["status"] =
        isLast && isLiveMode ? "running" : "complete";
      return {
        id: span.id,
        label: span.name,
        status,
        duration:
          span.start_time && span.end_time
            ? new Date(span.end_time).getTime() -
              new Date(span.start_time).getTime()
            : undefined,
      };
    });
  }, [displaySpans, isLiveMode]);

  // Get step icon based on type
  const getStepIcon = (type: string) => {
    switch (type) {
      case "prompt_stack":
        return Layers;
      case "tool_call":
        return Wrench;
      case "search":
        return Search;
      case "tool_result":
        return Check;
      default:
        return Brain;
    }
  };

  return (
    <motion.aside
      initial={false}
      animate={{
        width: isOpen
          ? LAYOUT.contextPanel.width
          : LAYOUT.contextPanel.collapsedWidth,
      }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="relative h-full flex flex-col z-20 bg-sidebar border-l border-border"
    >
      {/* ═══════════════════════════════════════════════════════════════════════
          HEADER - Minimal with toggle
          ═══════════════════════════════════════════════════════════════════════ */}
      <div
        className="shrink-0 flex items-center justify-between px-3"
        style={{ height: 52, borderBottom: "1px solid var(--border)" }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggle}
              className="p-2 rounded-lg transition-colors text-muted-foreground hover:bg-primary/8 hover:text-primary"
            >
              {isOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {isOpen ? "Collapse" : "Expand"}
          </TooltipContent>
        </Tooltip>

        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2"
          >
            {/* Scope badge */}
            {activeScopeDef && (
              <span
                className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium"
                style={{
                  background:
                    "color-mix(in srgb, var(--primary) 10%, transparent)",
                  color: "var(--muted-foreground)",
                  fontFamily: FONT_FAMILY.mono,
                  letterSpacing: "0.03em",
                }}
              >
                <span>{activeScopeDef.icon}</span>
                {activeScopeDef.name}
              </span>
            )}
            {isLiveMode && isConnected && (
              <span
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  background:
                    "color-mix(in srgb, var(--success, #22c55e) 15%, transparent)",
                  color: "var(--success, #22c55e)",
                }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                </span>
                Live
              </span>
            )}
          </motion.div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          COLLAPSED STATE - Icon strip
          ═══════════════════════════════════════════════════════════════════════ */}
      {!isOpen && (
        <div className="flex flex-col items-center py-4 gap-3">
          {TABS.map(tab => (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setActiveTab(tab.id);
                    onToggle();
                  }}
                  className={cn(
                    "p-2.5 rounded-lg transition-colors",
                    activeTab === tab.id
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-primary/8 hover:text-primary"
                  )}
                >
                  <tab.icon className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{tab.label}</TooltipContent>
            </Tooltip>
          ))}
          {displaySpans.length > 0 && (
            <span
              className="flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold rounded-full"
              style={{ background: "var(--primary)", color: "white" }}
            >
              {displaySpans.length}
            </span>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TABS - Industry standard segmented control
          ═══════════════════════════════════════════════════════════════════════ */}
      {isOpen && (
        <>
          <div
            className="px-3 py-2"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className={ui.tabBar}>
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    ui.tab,
                    "flex-1 justify-center",
                    activeTab === tab.id ? ui.tabActive : ui.tabInactive
                  )}
                >
                  <tab.icon className="size-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB CONTENT
              ═══════════════════════════════════════════════════════════════════════ */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {/* ACTIVITY TAB - Timeline */}
              {activeTab === "activity" && (
                <motion.div
                  key="activity"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3"
                >
                  {displaySpans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "var(--muted)" }}
                      >
                        <Zap
                          className="size-6"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {isLiveMode
                          ? "Waiting for activity..."
                          : "No activity yet"}
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {isLiveMode
                          ? "Agent steps will appear here"
                          : "Start a conversation to see traces"}
                      </p>
                    </div>
                  ) : (
                    <div className="relative">
                      {/* Compact progress bar */}
                      {progressSteps.length > 0 && (
                        <div className="mb-3">
                          <TaskProgressCompact steps={progressSteps} />
                        </div>
                      )}

                      {/* Vertical timeline line */}
                      <div
                        className="absolute left-[11px] top-2 bottom-2 w-px"
                        style={{ background: "var(--border)" }}
                      />

                      {/* Steps */}
                      <div className="space-y-1">
                        {displaySpans.map((span, idx) => {
                          const type = String(
                            span.attributes?.type || "reasoning"
                          );
                          const StepIcon = getStepIcon(type);
                          const isExpanded = expandedSteps.has(span.id);
                          const isLast = idx === displaySpans.length - 1;
                          const details = Object.fromEntries(
                            Object.entries(span.attributes ?? {}).filter(
                              ([key]) =>
                                !["type", "step", "content"].includes(key)
                            )
                          );
                          const hasDetails = Object.keys(details).length > 0;
                          const hasContent = Boolean(span.attributes?.content);

                          return (
                            <div key={span.id} className="relative pl-7">
                              {/* Status dot on timeline */}
                              <div
                                className={cn(
                                  "absolute left-0 top-2.5 w-[22px] h-[22px] rounded-full flex items-center justify-center z-10",
                                  isLast && isLiveMode ? "animate-pulse" : ""
                                )}
                                style={{
                                  background: "var(--card)",
                                  border: "2px solid var(--border)",
                                }}
                              >
                                <StepIcon
                                  className="size-3"
                                  style={{
                                    color:
                                      type === "tool_result"
                                        ? "var(--success, #22c55e)"
                                        : "var(--primary)",
                                  }}
                                />
                              </div>

                              {/* Step content */}
                              <button
                                onClick={() => toggleStep(span.id)}
                                className="w-full text-left p-2.5 rounded-lg transition-colors hover:bg-primary/8"
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className="text-xs font-medium truncate"
                                    style={{ color: "var(--foreground)" }}
                                  >
                                    {span.name}
                                  </span>
                                  <ChevronRight
                                    className={cn(
                                      "size-3 shrink-0 transition-transform",
                                      isExpanded && "rotate-90"
                                    )}
                                    style={{ color: "var(--muted-foreground)" }}
                                  />
                                </div>
                                {hasContent && !isExpanded && (
                                  <p className="text-[11px] mt-0.5 truncate text-muted-foreground">
                                    {String(
                                      span.attributes?.content || ""
                                    ).slice(0, 60)}
                                    ...
                                  </p>
                                )}
                              </button>

                              {/* Expanded content */}
                              <AnimatePresence>
                                {(hasContent || hasDetails) && isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="px-2.5 pb-2.5">
                                      {hasContent && (
                                        <>
                                          {(() => {
                                            const raw = String(
                                              span.attributes?.content || ""
                                            );
                                            try {
                                              const parsed = JSON.parse(raw);
                                              return (
                                                <JsonViewer
                                                  data={parsed as JsonValue}
                                                  defaultOpenDepth={1}
                                                  className="text-[11px]"
                                                />
                                              );
                                            } catch {
                                              return (
                                                <pre className="text-[11px] p-2 rounded-md overflow-x-auto whitespace-pre-wrap bg-muted text-muted-foreground">
                                                  {raw}
                                                </pre>
                                              );
                                            }
                                          })()}
                                        </>
                                      )}
                                      {hasDetails && (
                                        <div
                                          className={cn(hasContent && "mt-2")}
                                        >
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                            Details
                                          </p>
                                          <JsonViewer
                                            data={details as JsonValue}
                                            defaultOpenDepth={2}
                                            className="text-[11px]"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}

                        {/* Live indicator at bottom */}
                        {isLiveMode && isConnected && (
                          <div className="relative pl-7 py-2">
                            <div
                              className="absolute left-0 top-3 w-[22px] h-[22px] rounded-full flex items-center justify-center"
                              style={{
                                background: "var(--card)",
                                border: "2px solid var(--primary)",
                              }}
                            >
                              <Loader2
                                className="size-3 animate-spin"
                                style={{ color: "var(--primary)" }}
                              />
                            </div>
                            <span
                              className="text-xs"
                              style={{ color: "var(--muted-foreground)" }}
                            >
                              Processing...
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* AGENTS TAB */}
              {activeTab === "agents" && (
                <motion.div
                  key="agents"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3 space-y-4"
                >
                  {flowAgents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "var(--muted)" }}
                      >
                        <Bot
                          className="size-6"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        No agent activity yet
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Agent workflow will appear when processing starts
                      </p>
                    </div>
                  ) : (
                    <>
                      <AgentFlowVisualizer
                        agents={flowAgents}
                        currentAgent={currentFlowAgent}
                        handoffs={handoffs}
                        layout="vertical"
                      />
                      {agents.length > 0 && (
                        <div
                          className="border-t pt-4"
                          style={{ borderColor: "var(--border)" }}
                        >
                          <MultiAgentDashboard
                            agents={agents}
                            activeAgentId={currentFlowAgent || "supervisor"}
                          />
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* SAFETY TAB */}
              {activeTab === "safety" && (
                <motion.div
                  key="safety"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3"
                >
                  <div className="space-y-2">
                    {guardrailChecks.map((check, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg"
                        style={{ background: "var(--muted)" }}
                      >
                        <span
                          className="text-xs font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {check.name}
                        </span>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold",
                            check.status === "pass"
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                              : check.status === "fail"
                                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                          )}
                        >
                          {check.status === "pass" ? (
                            <Check className="size-3" />
                          ) : check.status === "fail" ? (
                            <AlertCircle className="size-3" />
                          ) : (
                            <Loader2 className="size-3" />
                          )}
                          {check.status === "pass"
                            ? "Pass"
                            : check.status === "fail"
                              ? "Fail"
                              : "Pending"}
                        </div>
                      </div>
                    ))}
                  </div>
                  {guardrailOverall === "safe" ? (
                    <div
                      className="mt-4 p-3 rounded-lg text-center"
                      style={{
                        background:
                          "color-mix(in srgb, var(--success, #22c55e) 10%, transparent)",
                      }}
                    >
                      <Shield
                        className="size-5 mx-auto mb-1"
                        style={{ color: "var(--success, #22c55e)" }}
                      />
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--success, #22c55e)" }}
                      >
                        All guardrails passing
                      </p>
                    </div>
                  ) : (
                    <div
                      className="mt-4 p-3 rounded-lg text-center"
                      style={{ background: "var(--muted)" }}
                    >
                      <Shield
                        className="size-5 mx-auto mb-1"
                        style={{ color: "var(--muted-foreground)" }}
                      />
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Awaiting message processing
                      </p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* CONTEXT TAB */}
              {activeTab === "context" && (
                <motion.div
                  key="context"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="p-3"
                >
                  {contextItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                        style={{ background: "var(--muted)" }}
                      >
                        <Database
                          className="size-6"
                          style={{ color: "var(--muted-foreground)" }}
                        />
                      </div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        No context yet
                      </p>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        Context will populate as you interact
                      </p>
                    </div>
                  ) : (
                    <ContextPanel
                      items={contextItems}
                      maxTokens={maxTokens}
                      usedTokens={usedTokens}
                    />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </motion.aside>
  );
}
