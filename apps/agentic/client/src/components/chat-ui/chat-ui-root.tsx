/**
 * ChatUIRoot - Premium Chat Interface
 * Enterprise-grade UI using HKI brand design tokens
 *
 * Design Principles:
 * - No-Washout warm neutrals (never pure white backgrounds)
 * - HKI Iris (#0E7C7B) for primary actions
 * - HKI Iris for emphasis
 * - Soft shadows + hairline borders for depth
 * - Smooth 200-300ms transitions
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Sun,
  Moon,
  Activity,
  PanelLeft,
  Shield,
  SquarePen,
  BookOpen,
} from "lucide-react";
import { AgenticIcon } from "../ui/icons/AgenticIcon";
import { KnowledgeIcon } from "../ui/icons/KnowledgeIcon";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { ToolbarAction } from "./ui/toolbar-action";
import { TaskSidebar } from "./task-sidebar/task-sidebar";
import { TracesSidebar } from "./traces-sidebar/traces-sidebar";
import {
  TaskMessages,
  type InterventionResponseRequest,
} from "./task-messages/task-messages";
import { ErrorBoundary, HkiMark } from "@hki/ui";
import { PromptInput } from "./prompt-input";
import type { PromptRuntimeTone } from "./prompt-input";
import { SuggestionGrid } from "./suggestions/suggestion-grid";
import {
  buildLeadershipFallbackQuestions,
  dedupeQuestions,
} from "./suggestions/question-quality";
import { KeyboardShortcutsDialog } from "./ui/keyboard-shortcuts-dialog";
import { useTaskMessages } from "./hooks/use-task-messages";

import { useSafeSearchParams, SearchParamKey } from "./hooks/use-search-params";
import { useCreateTask } from "./hooks/use-tasks";
import { useSendMessage } from "./hooks/use-task-messages";
import { useStreamingState } from "./hooks/use-streaming-state";
import { useAutoScroll } from "./hooks/use-auto-scroll";
import { useKeyboardShortcuts } from "./hooks/use-keyboard-shortcuts";
import { trpc } from "@/lib/trpc";
import {
  LAYOUT,
  MOTION,
  SPACING,
  TYPOGRAPHY,
  RADIUS,
  ELEVATION,
  BORDER,
  GRID,
  GRADIENTS,
  GLASS,
  GLOW,
  FONT_FAMILY,
} from "@/design-system/tokens";
import { RotatingPlaceholder } from "./ui/rotating-placeholder";
import { useScope } from "@/_core/hooks/useScope";
import { buildKnowledgeWorkspaceHref } from "@/_core/workspace-navigation";
import { GLOBAL_SCOPE } from "@shared/value-streams";
import { StreamSwitcher } from "@/components/shared/StreamSwitcher";
import { usePermissions } from "@/_core/hooks/usePermissions";
import { useFeatureAccess } from "@/_core/hooks/useFeatureAccess";
import { canAccessKnowledgeWorkspace } from "@/_core/access/knowledge";
import type { Task, TaskMessage } from "./types";

type ChatUIRootProps = {
  userId: number;
  className?: string;
};

// Animation variants using design system motion tokens
const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: MOTION.slow / 1000,
      ease: MOTION.easeOut,
    },
  },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.slow / 1000, ease: MOTION.easeOut },
  },
};

function ConversationStartingCard({ scopeName }: { scopeName?: string }) {
  const activeScopeLabel = scopeName?.trim() || "current HKI context";
  const statusText = scopeName?.trim()
    ? `Using ${activeScopeLabel} context and checking available sources before responding.`
    : "Using the current HKI context and checking available sources before responding.";

  return (
    <motion.div
      key={`starting-${activeScopeLabel}`}
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.24, ease: MOTION.easeOut }}
      className="mx-auto w-full max-w-140"
    >
      <div
        className="overflow-hidden rounded-[28px] border"
        style={{
          borderColor:
            "color-mix(in srgb, var(--foreground) 6%, var(--border))",
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--card) 99%, white 1%) 0%, var(--card) 100%)",
          boxShadow:
            "0 14px 28px -26px color-mix(in srgb, var(--foreground) 10%, transparent)",
        }}
      >
        <div
          className="h-0.5 w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--border) 55%, transparent) 20%, color-mix(in srgb, var(--border) 80%, transparent) 50%, color-mix(in srgb, var(--border) 55%, transparent) 80%, transparent 100%)",
            opacity: 1,
          }}
        />

        <div className="px-6 py-6">
          <div className="flex items-start gap-4">
            <motion.div
              className="relative shrink-0 rounded-2xl p-2"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--primary) 20%, transparent), color-mix(in srgb, var(--card) 84%, transparent))",
                border:
                  "1px solid color-mix(in srgb, var(--primary) 30%, var(--border))",
                boxShadow:
                  "inset 0 1px 0 color-mix(in srgb, white 18%, transparent), 0 18px 34px -22px color-mix(in srgb, var(--primary) 78%, transparent)",
              }}
              animate={{ y: [0, -2, 0] }}
              transition={{
                duration: 2.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <AgenticIcon size={58} animated aria-hidden="true" />
            </motion.div>

            <div className="min-w-0 flex-1">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.24em]"
                style={{ color: "var(--primary)" }}
              >
                HKI Agent
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal text-foreground">
                Preparing your response
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {statusText}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {[
                  {
                    label: "Open secure thread",
                    icon: Shield,
                    color: "var(--primary)",
                  },
                  {
                    label: "Resolve context",
                    icon: BookOpen,
                    color: "var(--foreground)",
                  },
                  {
                    label: "Prepare answer",
                    icon: Activity,
                    color: "var(--primary)",
                  },
                ].map(item => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                    style={{
                      color: item.color,
                      background: `color-mix(in srgb, ${item.color} 10%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${item.color} 16%, var(--border))`,
                    }}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/** Generate scope-aware prompt suggestions from domain metadata.
 *  Priority: admin-configured sampleQuestions → generated prompts → curated leadership fallbacks */
function getScopePrompts(
  scopeDef:
    | {
        id?: string;
        name?: string;
        description?: string | null;
        sampleQuestions?: string[];
      }
    | undefined,
  generatedPrompts?: string[]
): string[] {
  const cleanedAdmin = dedupeQuestions(scopeDef?.sampleQuestions ?? [], 6);
  const cleanedGenerated = dedupeQuestions(generatedPrompts ?? [], 6);

  // 1. Admin-configured sample questions from DB — best source
  if (cleanedAdmin.length > 0) return cleanedAdmin.slice(0, 3);

  // 2. LLM-generated stream prompts
  if (cleanedGenerated.length > 0) return cleanedGenerated.slice(0, 3);

  const name = scopeDef?.name;
  const desc = scopeDef?.description ?? null;
  const leadershipFallback = dedupeQuestions(
    buildLeadershipFallbackQuestions(
      !name || scopeDef?.id === GLOBAL_SCOPE ? undefined : name,
      desc
    ),
    6
  );
  return leadershipFallback.slice(0, 3);
}

export function ChatUIRoot({ userId, className }: ChatUIRootProps) {
  const { taskID, updateParams, searchParams } = useSafeSearchParams();
  const [isTracesSidebarOpen, setIsTracesSidebarOpen] = useState(false); // Opens when user clicks Activity
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null
  );
  const [promptValue, setPromptValue] = useState("");
  const starterPrompt = useMemo(
    () => searchParams.get("starter")?.trim() ?? "",
    [searchParams]
  );
  const hasAppliedStarterRef = useRef(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const {
    activeScope,
    setActiveScope,
    availableScopes,
    activeScopeDef,
    hasMultipleScopes,
    isScopeLocked,
  } = useScope();
  const { role } = usePermissions();
  const { canView: canViewFeature } = useFeatureAccess();
  const canUseKnowledgeLibrary = canAccessKnowledgeWorkspace(role);
  const knowledgeHref = canUseKnowledgeLibrary
    ? buildKnowledgeWorkspaceHref(activeScope)
    : "/welcome";
  const canAccessAdminHub = role === "admin";
  const canGenerateStreamPrompts = canViewFeature(
    "release.chat.promptGenerator"
  );
  const canUseChatAttachments = canViewFeature("release.chat.attachments");
  const canUseChatVoice = canViewFeature("release.chat.voice");
  const canUseChatRerun = canViewFeature("release.chat.rerun");
  const canUseClearAllTasks = canViewFeature("release.chat.clearAllTasks");
  const canUseActivityPanel =
    canViewFeature("release.chat.activityPanel") ||
    canViewFeature("debug.chat.activityPanel");
  const canRecordChatFeedback = role === "admin" || role === "manager";
  const [autoPromptsByScope, setAutoPromptsByScope] = useState<
    Record<string, string[]>
  >({});
  const generatingScopePromptsRef = useRef<Set<string>>(new Set());
  const suggestQuestionsMut = trpc.gemini.suggestQuestions.useMutation();

  useEffect(() => {
    if (!canGenerateStreamPrompts) return;

    let cancelled = false;
    const scopeDef = activeScopeDef;
    const scopeId = scopeDef?.id;
    const scopeName = scopeDef?.name;
    if (!scopeDef || !scopeId || !scopeName || scopeId === GLOBAL_SCOPE) return;
    if (scopeDef.sampleQuestions?.length) return;
    if (Object.prototype.hasOwnProperty.call(autoPromptsByScope, scopeId))
      return;
    if (generatingScopePromptsRef.current.has(scopeId)) return;

    generatingScopePromptsRef.current.add(scopeId);
    setAutoPromptsByScope(prev =>
      Object.prototype.hasOwnProperty.call(prev, scopeId)
        ? prev
        : { ...prev, [scopeId]: [] }
    );

    suggestQuestionsMut.mutate(
      {
        title: `${scopeName} knowledge domain`,
        content: [
          `Domain: ${scopeName}`,
          scopeDef.description ? `Description: ${scopeDef.description}` : "",
          "Generate practical prompts leadership can ask to validate grounded answers, access isolation, and token/cost efficiency.",
        ]
          .filter(Boolean)
          .join("\n"),
        count: 6,
        valueStreamId: scopeId,
      },
      {
        onSuccess: data => {
          if (cancelled) return;
          const cleaned = dedupeQuestions(data.questions ?? [], 6);
          if (cleaned.length === 0) return;
          setAutoPromptsByScope(prev => ({
            ...prev,
            [scopeId]: cleaned,
          }));
        },
        onSettled: () => {
          generatingScopePromptsRef.current.delete(scopeId);
        },
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    activeScopeDef,
    autoPromptsByScope,
    canGenerateStreamPrompts,
    suggestQuestionsMut,
  ]);

  const activeScopePrompts = useMemo(
    () =>
      getScopePrompts(
        activeScopeDef,
        activeScopeDef?.id ? autoPromptsByScope[activeScopeDef.id] : undefined
      ),
    [activeScopeDef, autoPromptsByScope]
  );

  useEffect(() => {
    if (hasAppliedStarterRef.current) return;
    if (!starterPrompt) return;
    if (taskID) return;
    if (promptValue.trim().length > 0) return;

    setPromptValue(starterPrompt);
    hasAppliedStarterRef.current = true;

    requestAnimationFrame(() => {
      const textarea =
        document.querySelector<HTMLTextAreaElement>(
          '[aria-label="Message input"]'
        ) || document.querySelector<HTMLTextAreaElement>("textarea");
      textarea?.focus();
    });
  }, [promptValue, starterPrompt, taskID]);

  // Track active project from sidebar so new tasks inherit project scope
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(
    null
  );
  const handleActiveProjectChange = useCallback(
    (projectId: string | null, projectName?: string | null) => {
      setActiveProjectId(projectId);
      setActiveProjectName(projectName ?? null);
    },
    []
  );

  // Live streaming state from WebSocket — provides agent phase label + trace steps
  const {
    phaseLabel: agentPhaseLabel,
    isStreaming: isAgentStreaming,
    isConnected,
    traceSteps: agentTraceSteps,
    suggestedFollowUps,
    executionPlan,
    pendingIntervention,
    liveResponseContent,
  } = useStreamingState(taskID);

  const { createTask, isLoading: isTaskCreating } = useCreateTask(userId);
  const { sendMessage, isLoading: isQuickActionSending } = useSendMessage();
  const utils = trpc.useUtils();
  const [isPromptSending, setIsPromptSending] = useState(false);
  const sendingLockRef = useRef(false); // Guards against false-resets during PromptInput remount (first message only)
  const messageCountAtSendRef = useRef<number | null>(null); // Track message count when a send started
  const sendStartTimeRef = useRef<number>(0); // Timestamp when send started — ensures minimum thinking display
  const clearSendingTimeoutRef = useRef<number | null>(null);
  const { data: taskData, isLoading: isMessagesLoading } =
    useTaskMessages(taskID);

  const latestInspectableAgentMessageId = useMemo(() => {
    const messages = taskData?.messages ?? [];
    return (
      [...messages].reverse().find(message => {
        if (message.content.type !== "text") return false;
        if (message.content.author !== "agent") return false;
        if (message.streaming_status === "STREAMING") return false;
        const text = message.content.content.trim().toLowerCase();
        return text !== "thinking" && text !== "thinking...";
      })?.id ?? null
    );
  }, [taskData?.messages]);

  useEffect(() => {
    if (!taskID || isScopeLocked) return;

    const conversationScope = taskData?.conversation?.scope;
    if (!conversationScope) return;

    const isKnownConversationScope = availableScopes.some(
      scope => scope.id === conversationScope
    );
    if (!isKnownConversationScope) return;

    if (conversationScope !== activeScope) {
      setActiveScope(conversationScope);
    }

    const desiredScopeParam =
      conversationScope === GLOBAL_SCOPE ? null : conversationScope;
    const currentScopeParam = searchParams.get(SearchParamKey.SCOPE);

    if (currentScopeParam !== desiredScopeParam) {
      updateParams({ [SearchParamKey.SCOPE]: desiredScopeParam });
    }
  }, [
    taskID,
    taskData?.conversation?.scope,
    isScopeLocked,
    activeScope,
    availableScopes,
    searchParams,
    setActiveScope,
    updateParams,
  ]);

  // Smart auto-scroll: only scrolls if user is near bottom, pauses when user scrolls up
  const messageCount = taskData?.messages?.length ?? 0;
  const {
    containerRef: scrollContainerRef,
    bottomRef: messagesEndRef,
    isAtBottom,
    pendingUpdateCount,
    followMode,
    scrollToBottom,
  } = useAutoScroll({
    conversationId: taskID,
    isStreaming: isAgentStreaming,
    contentVersion: messageCount,
    deps: [
      taskID,
      messageCount,
      isAgentStreaming,
      agentPhaseLabel,
      agentTraceSteps?.length,
      suggestedFollowUps?.length,
    ],
  });

  const jumpToLatestLabel = useMemo(() => {
    if (pendingUpdateCount > 0) {
      return `${pendingUpdateCount} new update${pendingUpdateCount === 1 ? "" : "s"}`;
    }
    if (isAgentStreaming) {
      return "Resume live";
    }
    return "Jump to latest";
  }, [isAgentStreaming, pendingUpdateCount]);

  const clearPendingSend = useCallback(() => {
    if (clearSendingTimeoutRef.current !== null) {
      window.clearTimeout(clearSendingTimeoutRef.current);
      clearSendingTimeoutRef.current = null;
    }
    sendingLockRef.current = false;
    messageCountAtSendRef.current = null;
    setIsPromptSending(false);
  }, []);

  const beginPendingSend = useCallback(() => {
    if (clearSendingTimeoutRef.current !== null) {
      window.clearTimeout(clearSendingTimeoutRef.current);
      clearSendingTimeoutRef.current = null;
    }
    if (!sendingLockRef.current) {
      messageCountAtSendRef.current = taskData?.messages?.length ?? 0;
      sendStartTimeRef.current = Date.now();
    }
    sendingLockRef.current = true;
    setIsPromptSending(true);
  }, [taskData?.messages?.length]);

  const interventionMutation = trpc.chat.respondToIntervention.useMutation({
    onSuccess: (_result, variables) => {
      utils.chat.getTask.invalidate({
        conversationId: variables.conversationId,
      });
      utils.chat.getTasks.invalidate();
    },
    onError: error => {
      clearPendingSend();
      toast.error(error.message || "Failed to resume the paused action.");
    },
  });

  // Robust sending detection: combines prompt-driven busy state with explicit
  // quick-action / suggestion sends so the thinking UI appears immediately.
  const isAgentBusy =
    isPromptSending ||
    isQuickActionSending ||
    isTaskCreating ||
    interventionMutation.isPending;
  const promptRuntimeState = useMemo<{
    label: string;
    tone: PromptRuntimeTone;
  }>(() => {
    if (isAgentBusy) {
      return {
        label: agentPhaseLabel?.trim() || "Working",
        tone: "working",
      };
    }
    if (taskID && isConnected === false) {
      return { label: "Offline", tone: "offline" };
    }
    if (taskID && isConnected) {
      return { label: "Live", tone: "live" };
    }
    return { label: "Ready", tone: "ready" };
  }, [agentPhaseLabel, isAgentBusy, isConnected, taskID]);

  const handleSendingStateChange = useCallback(
    (sending: boolean) => {
      if (sending) {
        beginPendingSend();
      } else if (sendingLockRef.current) {
        // The PromptInput hook is reporting "not sending" — but if this is just
        // a new hook instance mounting after the welcome→chat transition, ignore it.
        // We'll clear this lock in the useEffect below when real data arrives.
        if (!taskID && (taskData?.messages?.length ?? 0) === 0) {
          clearPendingSend();
        }
      } else {
        setIsPromptSending(false);
      }
    },
    [beginPendingSend, clearPendingSend, taskData?.messages?.length, taskID]
  );

  // Clear the sending lock once the message list has grown beyond what we saw at send-time.
  // This correctly handles:
  //   • First message: messageCountAtSendRef=0, lock clears when first response arrives
  //   • Subsequent messages: messageCountAtSendRef=N, lock clears when count exceeds N
  //     (the optimistic user message adds 1, so we wait for count > N+1 which is the real response)
  useEffect(() => {
    if (!sendingLockRef.current || messageCountAtSendRef.current === null)
      return;
    const currentCount = taskData?.messages?.length ?? 0;
    // After sending, the optimistic update adds the user message (+1).
    // We need to wait for the assistant response (+2 from baseline).
    // But the "Thinking..." placeholder may also be in the list, so check for
    // a real (non-placeholder) assistant message that wasn't there before.
    const msgs = taskData?.messages ?? [];
    const baselineCount = messageCountAtSendRef.current;

    // Only check once we have more messages than we started with + the optimistic user msg
    if (currentCount <= baselineCount + 1) return;

    // Verify there's a real assistant response (not just "Thinking...")
    const hasNewRealResponse = msgs.some((m: any, idx: number) => {
      // Only look at messages after the baseline
      if (idx < baselineCount) return false;
      if (m.content?.author === "agent" || m.role === "assistant") {
        const text =
          typeof m.content === "string"
            ? m.content
            : (m.content?.content ?? "");
        return (
          text.trim().toLowerCase() !== "thinking..." &&
          !m.id?.startsWith("optimistic-")
        );
      }
      return false;
    });
    if (hasNewRealResponse) {
      // Ensure the thinking indicator stays visible for at least 1.2s.
      // Fast orchestrator responses (< 1s) would otherwise flash imperceptibly.
      const elapsed = Date.now() - sendStartTimeRef.current;
      const MIN_THINKING_MS = 1200;
      const remaining = Math.max(0, MIN_THINKING_MS - elapsed);

      if (remaining > 0) {
        if (clearSendingTimeoutRef.current !== null) {
          window.clearTimeout(clearSendingTimeoutRef.current);
        }
        clearSendingTimeoutRef.current = window.setTimeout(() => {
          clearSendingTimeoutRef.current = null;
          clearPendingSend();
        }, remaining);
      } else {
        clearPendingSend();
      }
    }
  }, [clearPendingSend, taskData]);

  useEffect(() => {
    return () => {
      if (clearSendingTimeoutRef.current !== null) {
        window.clearTimeout(clearSendingTimeoutRef.current);
      }
    };
  }, []);

  const toggleTracesSidebar = useCallback(() => {
    if (!canUseActivityPanel) return;
    if (isTracesSidebarOpen) {
      setSelectedMessageId(null);
      setIsTracesSidebarOpen(false);
      return;
    }
    setSelectedMessageId(
      isAgentStreaming ? null : latestInspectableAgentMessageId
    );
    setIsTracesSidebarOpen(true);
  }, [
    canUseActivityPanel,
    isAgentStreaming,
    isTracesSidebarOpen,
    latestInspectableAgentMessageId,
  ]);

  const handleInspectMessageActivity = useCallback(
    (message: TaskMessage) => {
      if (!canUseActivityPanel) return;
      setSelectedMessageId(message.id);
      setIsTracesSidebarOpen(true);
    },
    [canUseActivityPanel]
  );

  useEffect(() => {
    if (!canUseActivityPanel && isTracesSidebarOpen) {
      setIsTracesSidebarOpen(false);
    }
  }, [canUseActivityPanel, isTracesSidebarOpen]);

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const handleNewChat = useCallback(() => {
    updateParams({ [SearchParamKey.TASK_ID]: null });
  }, [updateParams]);

  const focusInput = useCallback(() => {
    // Focus the prompt textarea
    const textarea =
      document.querySelector<HTMLTextAreaElement>(
        '[aria-label="Message input"]'
      ) || document.querySelector<HTMLTextAreaElement>("textarea");
    textarea?.focus();
  }, []);

  const handleEscape = useCallback(() => {
    if (isShortcutsOpen) {
      setIsShortcutsOpen(false);
    } else if (isTracesSidebarOpen) {
      setIsTracesSidebarOpen(false);
    }
  }, [isShortcutsOpen, isTracesSidebarOpen]);

  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onToggleSidebar: () => setIsSidebarOpen(prev => !prev),
    onToggleActivity: toggleTracesSidebar,
    canToggleActivity: canUseActivityPanel,
    onFocusInput: focusInput,
    onShowShortcuts: () => setIsShortcutsOpen(prev => !prev),
    onEscape: handleEscape,
  });

  const handleScopeChange = useCallback(
    (scopeId: string) => {
      if (scopeId === activeScope) return;

      const scopeName =
        scopeId === GLOBAL_SCOPE
          ? "General HKI context"
          : availableScopes.find(scope => scope.id === scopeId)?.name ||
            "the selected stream";

      setActiveScope(scopeId);
      updateParams({
        [SearchParamKey.SCOPE]: scopeId === GLOBAL_SCOPE ? null : scopeId,
        ...(taskID ? { [SearchParamKey.TASK_ID]: null } : {}),
      });

      if (!taskID) return;

      setSelectedMessageId(null);
      setPromptValue("");
      setIsTracesSidebarOpen(false);
      toast.info(
        `Switched to ${scopeName}. Started a new chat to keep value-stream context isolated.`
      );
    },
    [activeScope, availableScopes, setActiveScope, taskID, updateParams]
  );

  const handleTaskSelect = useCallback(
    (task: Task) => {
      const nextScope = task.scope ?? GLOBAL_SCOPE;
      const canSyncTaskScope = availableScopes.some(
        scope => scope.id === nextScope
      );

      if (!isScopeLocked && canSyncTaskScope && nextScope !== activeScope) {
        setActiveScope(nextScope);
      }

      updateParams({
        [SearchParamKey.TASK_ID]: task.id,
        ...(canSyncTaskScope
          ? {
              [SearchParamKey.SCOPE]:
                nextScope === GLOBAL_SCOPE ? null : nextScope,
            }
          : {}),
      });
      setSelectedMessageId(null);
    },
    [activeScope, availableScopes, isScopeLocked, setActiveScope, updateParams]
  );

  const handleQuickAction = useCallback(
    async (title: string) => {
      if (isAgentBusy) return; // Prevent double-send
      beginPendingSend();
      try {
        const task = await createTask({
          description: title,
          content: title,
          projectId: activeProjectId ?? undefined,
          scope: activeScope,
        });
        if (task) {
          updateParams({ [SearchParamKey.TASK_ID]: task.id });
          await sendMessage({
            taskId: task.id,
            scope: activeScope,
            content: {
              type: "text",
              author: "user",
              format: "plain",
              content: title,
            },
          });
        }
      } catch (err) {
        clearPendingSend();
        console.error("[QuickAction] Failed:", err);
        toast.error("Failed to process action. Please try again.");
      }
    },
    [
      isAgentBusy,
      beginPendingSend,
      clearPendingSend,
      createTask,
      updateParams,
      sendMessage,
      activeProjectId,
      activeScope,
    ]
  );

  const handleSuggestion = useCallback(
    async (suggestion: string) => {
      if (!suggestion || isAgentBusy) return; // Prevent double-send
      beginPendingSend();

      try {
        let currentTaskId = taskID;

        // Create new conversation if needed
        if (!currentTaskId) {
          const newTask = await createTask({
            description:
              suggestion.slice(0, 50) + (suggestion.length > 50 ? "..." : ""),
            content: suggestion,
            projectId: activeProjectId ?? undefined,
            scope: activeScope,
          });
          if (newTask) {
            currentTaskId = newTask.id;
            updateParams({ [SearchParamKey.TASK_ID]: currentTaskId });
          }
        }

        if (currentTaskId) {
          await sendMessage({
            taskId: currentTaskId,
            scope: activeScope,
            content: {
              type: "text",
              author: "user",
              format: "plain",
              content: suggestion,
            },
          });
        }
      } catch (err) {
        clearPendingSend();
        console.error("[Suggestion] Failed:", err);
        toast.error("Failed to send message. Please try again.");
      }
    },
    [
      taskID,
      isAgentBusy,
      beginPendingSend,
      clearPendingSend,
      createTask,
      updateParams,
      sendMessage,
      activeProjectId,
      activeScope,
    ]
  );

  const handleRegenerate = useCallback(
    async (message: TaskMessage) => {
      if (isAgentBusy) return;

      if (
        message.content.type !== "text" ||
        message.content.author !== "user"
      ) {
        toast.error("Only user prompts can be rerun.");
        return;
      }

      const rerunContent = message.content.content.trim();
      if (!rerunContent) {
        toast.error("This message can't be rerun.");
        return;
      }

      const rerunTaskId = message.task_id || taskID;
      if (!rerunTaskId) {
        toast.error("Couldn't find the conversation to rerun this prompt.");
        return;
      }

      beginPendingSend();

      try {
        await sendMessage({
          taskId: rerunTaskId,
          scope: taskData?.conversation?.scope ?? activeScope,
          content: {
            type: "text",
            author: "user",
            format: "plain",
            content: rerunContent,
            ...(message.content.attachments?.length
              ? { attachments: [...message.content.attachments] }
              : {}),
          },
        });
      } catch (err) {
        clearPendingSend();
        console.error("[Regenerate] Failed:", err);
        toast.error("Failed to regenerate response. Please try again.");
      }
    },
    [
      activeScope,
      beginPendingSend,
      clearPendingSend,
      isAgentBusy,
      sendMessage,
      taskData?.conversation?.scope,
      taskID,
    ]
  );

  const handlePin = useCallback((message: TaskMessage) => {
    toast.success("Message pinned to conversation");
  }, []);

  const handleReply = useCallback((message: TaskMessage) => {
    const content =
      message.content.type === "text" ? message.content.content : "Attachment";
    const quote = `> ${content.substring(0, 100)}${content.length > 100 ? "..." : ""}\n\n`;
    setPromptValue(prev => quote + prev);
  }, []);

  const handleInterventionAction = useCallback(
    async ({ intervention, action }: InterventionResponseRequest) => {
      if (!taskID || interventionMutation.isPending) return;

      const scratchpad = intervention.scratchpadSummary ?? {};
      const toolName =
        typeof scratchpad.tool === "string" ? scratchpad.tool : undefined;
      const rawArguments = scratchpad.arguments;
      const toolArguments =
        rawArguments &&
        typeof rawArguments === "object" &&
        !Array.isArray(rawArguments)
          ? (rawArguments as Record<string, unknown>)
          : undefined;

      beginPendingSend();
      try {
        await interventionMutation.mutateAsync({
          conversationId: taskID,
          planId: intervention.planId,
          failedStepId: intervention.failedStepId || undefined,
          action,
          toolName,
          toolArguments,
        });
        toast.success(
          action === "abort"
            ? "Stopped the gated action."
            : action === "skip"
              ? "Resuming without the gated tool."
              : "Approval sent. Resuming the paused step."
        );
      } catch {
        // The mutation onError owns the visible failure state.
      }
    },
    [beginPendingSend, interventionMutation, taskID]
  );

  const contentPadding = LAYOUT.chat.contentPadding;
  const chatMaxWidth = LAYOUT.chat.maxWidth;
  const inputPaddingY = LAYOUT.chat.inputPaddingY;
  const inputPaddingX = LAYOUT.chat.inputPaddingX;

  return (
    <div
      className={`agentic-chat-shell flex h-screen w-full overflow-hidden ${className || ""}`}
      role="application"
      aria-label="HKI Agent"
    >
      {/* Left Sidebar - Conversations */}
      <TaskSidebar
        userId={userId}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onToggle={() => setIsSidebarOpen(prev => !prev)}
        onSelectTask={handleTaskSelect}
        onActiveProjectChange={handleActiveProjectChange}
        activeStreamName={
          activeScope === GLOBAL_SCOPE ? undefined : activeScopeDef?.name
        }
        activeStreamIcon={
          activeScope === GLOBAL_SCOPE ? undefined : activeScopeDef?.icon
        }
        activeScopeId={activeScope}
        isScopeLocked={isScopeLocked}
        isConnected={taskID ? isConnected : undefined}
        showClearAllAction={canUseClearAllTasks}
      />

      {/* Main Chat Area - uses CSS variable tokens for theme support */}
      <main
        className="agentic-chat-main flex-1 flex flex-col min-w-0 bg-background"
        role="main"
        aria-label="Chat"
      >
        {/* Header */}
        <header
          role="banner"
          aria-label="Chat actions"
          className="agentic-chat-header shrink-0 flex items-center justify-between px-4 sm:px-6 z-10"
          style={{ height: 56 }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Toggle sidebar open/close */}
            <ToolbarAction
              size="icon-sm"
              active={isSidebarOpen}
              onClick={() => setIsSidebarOpen(prev => !prev)}
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              tooltip={isSidebarOpen ? "Close sidebar ⌘B" : "Open sidebar ⌘B"}
            >
              <PanelLeft className="w-5 h-5" />
            </ToolbarAction>

            {/* Brand mark + New Task — only when sidebar is closed */}
            {!isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3 ml-1"
              >
                <AgenticIcon size={28} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        updateParams({ [SearchParamKey.TASK_ID]: null })
                      }
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold
                                                       text-primary
                                                       hover:bg-primary/5
                                                       active:scale-[0.97]
                                                       transition-all duration-200 ease-out"
                      aria-label="New Task"
                    >
                      <SquarePen className="w-3.5 h-3.5" strokeWidth={2} />
                      <span className="tracking-wide">New Task</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Start new task</TooltipContent>
                </Tooltip>
              </motion.div>
            )}

            {/* Stream Switcher */}
            <StreamSwitcher
              activeScope={activeScope}
              activeScopeDef={activeScopeDef}
              availableScopes={availableScopes}
              hasMultipleScopes={hasMultipleScopes && !isScopeLocked}
              onScopeChange={handleScopeChange}
              compact={!isSidebarOpen}
            />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <nav
              className="flex items-center gap-1"
              aria-label="Platform navigation"
            >
              {canAccessAdminHub && (
                <ToolbarAction
                  asChild
                  tooltip="Open Admin Hub"
                  className="platform-nav-link"
                >
                  <a href="/admin" aria-label="Open Admin Hub">
                    <HkiMark
                      size={16}
                      variant="color"
                      className="h-4 w-4"
                      aria-hidden
                    />
                    <span className="hidden text-xs sm:inline">Admin</span>
                  </a>
                </ToolbarAction>
              )}

              <ToolbarAction
                asChild
                tooltip="Open Knowledge Domains"
                className="platform-nav-link"
              >
                <a href={knowledgeHref} aria-label="Open Knowledge Domains">
                  <KnowledgeIcon size={16} className="h-4 w-4" aria-hidden />
                  <span className="hidden text-xs sm:inline">Knowledge</span>
                </a>
              </ToolbarAction>
            </nav>

            <div
              className="h-5 w-px mx-1"
              style={{
                background:
                  "color-mix(in srgb, var(--primary) 15%, var(--border))",
              }}
            />
            {canUseActivityPanel && (
              <ToolbarAction
                size="icon-sm"
                active={isTracesSidebarOpen}
                onClick={toggleTracesSidebar}
                aria-label={
                  isTracesSidebarOpen
                    ? "Hide activity panel"
                    : "Show activity panel"
                }
                aria-pressed={isTracesSidebarOpen}
                tooltip={
                  isTracesSidebarOpen ? "Hide Activity ⌘J" : "Show Activity ⌘J"
                }
              >
                <Activity className="w-4 h-4" aria-hidden />
                {isTracesSidebarOpen && (
                  <span className="relative flex h-2 w-2">
                    <span
                      className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                      style={{ background: "var(--primary)" }}
                    />
                    <span
                      className="relative inline-flex rounded-full h-2 w-2"
                      style={{ background: "var(--primary)" }}
                    />
                  </span>
                )}
              </ToolbarAction>
            )}
            <ToolbarAction
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={
                theme === "light"
                  ? "Switch to dark mode"
                  : "Switch to light mode"
              }
              tooltip={theme === "light" ? "Dark mode" : "Light mode"}
            >
              {theme === "light" ? (
                <Moon className="w-4 h-4" aria-hidden />
              ) : (
                <Sun className="w-4 h-4" aria-hidden />
              )}
            </ToolbarAction>
            <KeyboardShortcutsDialog
              open={isShortcutsOpen}
              onClose={() => setIsShortcutsOpen(false)}
              showActivityShortcut={canUseActivityPanel}
            />
          </div>
        </header>

        {/* Content Area */}
        <AnimatePresence mode="wait">
          {taskID ? (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col min-h-0 relative"
            >
              {/* Messages - scrollable, centered column with token-based max-width and padding */}
              <div
                ref={scrollContainerRef}
                className="agentic-chat-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain flex flex-col items-center"
                role="region"
                aria-label="Conversation messages"
                style={{ overflowAnchor: "none" }}
              >
                <div
                  className="mx-auto w-full pt-6 px-4 sm:px-6 flex-1 flex flex-col min-h-full"
                  style={{
                    maxWidth: chatMaxWidth,
                  }}
                >
                  <ErrorBoundary componentName="Messages">
                    <TaskMessages
                      taskId={taskID}
                      isSending={isAgentBusy}
                      agentPhaseLabel={agentPhaseLabel}
                      agentTraceSteps={agentTraceSteps}
                      isAgentStreaming={isAgentStreaming}
                      liveResponseContent={liveResponseContent}
                      executionPlan={executionPlan}
                      pendingIntervention={pendingIntervention}
                      onInterventionAction={handleInterventionAction}
                      suggestedFollowUps={suggestedFollowUps}
                      onSuggestionSelect={handleSuggestion}
                      onRegenerate={
                        canUseChatRerun ? handleRegenerate : undefined
                      }
                      onPin={handlePin}
                      onReply={handleReply}
                      onInspectActivity={handleInspectMessageActivity}
                      canRecordFeedback={canRecordChatFeedback}
                      canOpenKnowledgeLibrary={canUseKnowledgeLibrary}
                      knowledgeLibraryScopeId={activeScope}
                      scrollContainerRef={scrollContainerRef}
                    />
                  </ErrorBoundary>

                  {/* Bottom spacer — ensures last message isn't hidden behind input bar */}
                  <div className="h-28 shrink-0 sm:h-32" aria-hidden />
                  <div ref={messagesEndRef} />
                </div>
              </div>

              {/* Scroll-to-bottom FAB — appears when user scrolls up */}
              <AnimatePresence>
                {followMode === "paused" && !isAtBottom && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-6 bottom-24 z-20 flex flex-col items-end gap-2"
                  >
                    {(pendingUpdateCount > 0 || isAgentStreaming) && (
                      <div
                        className="rounded-full border px-3 py-1 text-[11px] font-medium shadow-sm backdrop-blur-sm"
                        style={{
                          background:
                            "color-mix(in srgb, var(--card) 86%, transparent)",
                          borderColor:
                            "color-mix(in srgb, var(--primary) 18%, var(--border))",
                          color: "var(--muted-foreground)",
                        }}
                      >
                        {pendingUpdateCount > 0
                          ? `${pendingUpdateCount} fresh ${pendingUpdateCount === 1 ? "message" : "changes"}`
                          : "Live response is still arriving"}
                      </div>
                    )}

                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => scrollToBottom("smooth")}
                      className="group flex h-11 items-center gap-2 rounded-full border px-3.5 shadow-lg transition-all duration-200 hover:shadow-xl"
                      style={{
                        background:
                          "linear-gradient(180deg, color-mix(in srgb, var(--card) 96%, white 4%) 0%, var(--card) 100%)",
                        borderColor:
                          "color-mix(in srgb, var(--primary) 22%, var(--border))",
                        color: "var(--foreground)",
                      }}
                      aria-label="Scroll to latest messages"
                    >
                      <span
                        className="relative flex h-7 w-7 items-center justify-center rounded-full"
                        style={{
                          background:
                            "color-mix(in srgb, var(--primary) 12%, transparent)",
                          color: "var(--primary)",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="transition-transform group-hover:translate-y-0.5"
                        >
                          <path d="M12 5v14M5 12l7 7 7-7" />
                        </svg>
                        {isAgentStreaming && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
                            <span
                              className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                              style={{ background: "var(--primary)" }}
                            />
                            <span
                              className="relative inline-flex h-2.5 w-2.5 rounded-full"
                              style={{ background: "var(--primary)" }}
                            />
                          </span>
                        )}
                      </span>

                      <div className="flex flex-col items-start leading-none">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          Live Tail
                        </span>
                        <span className="text-xs font-semibold">
                          {jumpToLatestLabel}
                        </span>
                      </div>

                      {pendingUpdateCount > 0 && (
                        <span
                          className="rounded-full px-2 py-1 text-[11px] font-semibold tabular-nums"
                          style={{
                            background:
                              "color-mix(in srgb, var(--primary) 14%, transparent)",
                            color: "var(--primary)",
                          }}
                        >
                          {pendingUpdateCount}
                        </span>
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input area - clean floating footer */}
              <div
                className="agentic-chat-input-dock shrink-0 relative flex flex-col items-center"
                style={{ paddingTop: 10, paddingBottom: inputPaddingY }}
              >
                {/* Spacer — no gradient, capsule shadow provides depth */}

                <div
                  className="relative mx-auto w-full px-4 sm:px-6"
                  style={{
                    maxWidth: chatMaxWidth,
                  }}
                >
                  {/* Input capsule */}
                  <div className="relative z-10">
                    <PromptInput
                      userId={userId}
                      value={promptValue}
                      onPromptChange={setPromptValue}
                      disabled={isAgentBusy}
                      size="large"
                      enableAttachments={canUseChatAttachments}
                      enableVoice={canUseChatVoice}
                      onSendingStateChange={handleSendingStateChange}
                      activeProjectId={activeProjectId}
                      activeProjectName={activeProjectName}
                      activeScope={activeScope}
                      activeScopeName={activeScopeDef?.name}
                      activeScopeIcon={activeScopeDef?.icon}
                      isScopeLocked={isScopeLocked}
                      runtimeStateLabel={promptRuntimeState.label}
                      runtimeStateTone={promptRuntimeState.tone}
                    />
                  </div>

                  {/* Disclaimer */}
                  <p className="mt-1.5 text-[11px] text-muted-foreground/60 text-center select-none">
                    This uses AI and may produce inaccurate information. Verify
                    important details.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            /* Welcome Screen — warm, HKI-branded home experience */
            <motion.div
              key={`welcome-${activeScope}`}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20 }}
              variants={fadeInUp}
              className="flex-1 relative min-h-0"
              style={{
                display: "grid",
                placeItems: "center",
                paddingLeft: contentPadding,
                paddingRight: contentPadding,
                paddingTop: SPACING[8],
                paddingBottom: SPACING[8],
              }}
            >
              <div
                className="agentic-chat-welcome-card w-full"
                style={{ maxWidth: chatMaxWidth }}
              >
                {/* Hero Section — warm greeting + brand */}
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    duration: MOTION.slow / 1000,
                    ease: MOTION.easeOut,
                  }}
                  className="flex flex-col items-center justify-center text-center w-full"
                  style={{ marginBottom: 32 }}
                >
                  {/* Icon */}
                  <div style={{ marginBottom: 20 }}>
                    <AgenticIcon size={72} animated />
                  </div>

                  {/* Time-of-day greeting */}
                  <h1
                    className="tracking-normal text-foreground"
                    style={{
                      fontSize: 26,
                      fontWeight: 700,
                      lineHeight: 1.3,
                      letterSpacing: 0,
                      marginBottom: 6,
                    }}
                  >
                    {activeScopeDef && activeScopeDef.id !== GLOBAL_SCOPE ? (
                      <span className="text-primary">
                        {activeScopeDef.name}
                      </span>
                    ) : (
                      (() => {
                        const hour = new Date().getHours();
                        const greeting =
                          hour < 12
                            ? "Good morning"
                            : hour < 17
                              ? "Good afternoon"
                              : "Good evening";
                        return (
                          <>
                            {greeting}.{" "}
                            <span className="text-primary">
                              How can I help?
                            </span>
                          </>
                        );
                      })()
                    )}
                  </h1>

                  {/* Subtitle — scope-aware */}
                  <span
                    className="uppercase tracking-widest font-medium text-muted-foreground"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.25em",
                      fontFamily: FONT_FAMILY.mono,
                    }}
                  >
                    {activeScopeDef && activeScopeDef.id !== GLOBAL_SCOPE
                      ? activeScopeDef.description || "HKI Agent"
                      : "HKI Agent · General HKI context"}
                  </span>
                </motion.div>

                {isAgentBusy ? (
                  <ConversationStartingCard
                    scopeName={
                      activeScopeDef?.id !== GLOBAL_SCOPE
                        ? activeScopeDef?.name
                        : undefined
                    }
                  />
                ) : (
                  <>
                    {/* Input */}
                    <motion.div
                      variants={staggerItem}
                      className="w-full mx-auto relative"
                      style={{ marginBottom: 24 }}
                      onFocusCapture={() => setIsInputFocused(true)}
                      onBlurCapture={() => setIsInputFocused(false)}
                    >
                      <PromptInput
                        userId={userId}
                        placeholder=" "
                        size="large"
                        enableAttachments={canUseChatAttachments}
                        enableVoice={canUseChatVoice}
                        onSendingStateChange={handleSendingStateChange}
                        activeProjectId={activeProjectId}
                        activeProjectName={activeProjectName}
                        activeScope={activeScope}
                        activeScopeName={activeScopeDef?.name}
                        activeScopeIcon={activeScopeDef?.icon}
                        isScopeLocked={isScopeLocked}
                        runtimeStateLabel={promptRuntimeState.label}
                        runtimeStateTone={promptRuntimeState.tone}
                      />
                      {/* Typewriter rotating placeholder — hides on focus or when typing */}
                      {!promptValue && !isInputFocused && (
                        <RotatingPlaceholder
                          hidden={!!promptValue || isInputFocused}
                          className="left-16 right-28 top-8 bottom-0"
                          scopeId={activeScopeDef?.id}
                          scopeName={activeScopeDef?.name}
                          scopeDescription={activeScopeDef?.description}
                          generatedPrompts={activeScopePrompts}
                        />
                      )}
                    </motion.div>

                    {/* Scope-aware suggestion cards */}
                    <SuggestionGrid
                      prompts={activeScopePrompts}
                      onSelect={handleSuggestion}
                      disabled={isAgentBusy}
                      className="mb-8"
                    />
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Right Sidebar - Traces */}
      {taskID && canUseActivityPanel && (
        <ErrorBoundary componentName="Activity Panel" variant="inline">
          <TracesSidebar
            isOpen={isTracesSidebarOpen}
            onToggle={toggleTracesSidebar}
            messageId={selectedMessageId}
            taskId={taskID}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
