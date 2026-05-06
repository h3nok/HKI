/**
 * Agentic Chat UI Components
 *
 * Production-ready chat interface for the Agentic platform.
 * Features:
 * - Conversation sidebar
 * - Message display with tool execution
 * - Thought trace sidebar
 * - Streaming-ready architecture
 */

// Main layout
export { ChatUIRoot } from "./chat-ui-root";

// Task messages
export { TaskMessages } from "./task-messages/task-messages";
export { TaskMessageTextContent } from "./task-messages/task-message-text-content";
export { TaskMessageToolPair } from "./task-messages/task-message-tool-pair";

// Sidebars
export { TaskSidebar } from "./task-sidebar/task-sidebar";
export { TracesSidebar } from "./traces-sidebar/traces-sidebar";

// Input
export { PromptInput } from "./prompt-input";

// UI components
export { JsonViewer } from "./ui/json-viewer";
export { ShimmeringText } from "./ui/shimmering-text";
export { MarkdownResponse } from "./ui/markdown-response";
export { ThoughtTraceStep } from "./thought-trace/thought-trace-step";
export { ToolExecutionCard } from "@hki/ui";

// Agentic components
export {
  StreamingIndicator,
  StreamingIndicatorCompact,
} from "./ui/streaming-indicator";
export {
  ThinkingAnimation,
  ThinkingInline,
  ThinkingCard,
} from "./ui/thinking-animation";
export { ReasoningCard, InlineReasoning } from "./ui/reasoning-card";
export { TaskProgress, TaskProgressCompact } from "./ui/task-progress";
export { ArtifactViewer, ArtifactList } from "./ui/artifact-viewer";
export { ContextPanel } from "./ui/context-panel";

// Defensive Experience Layer
export { AgentPlanCard } from "./ui/agent-plan-card";
export type { PlannedStep, AgentPlanCardProps } from "./ui/agent-plan-card";
export { ContinuousControlBar } from "./ui/continuous-control-bar";
export type {
  AgentExecutionPhase,
  ContinuousControlBarProps,
} from "./ui/continuous-control-bar";
export { IntentConfirmation } from "./ui/intent-confirmation";
export type {
  IntentConstraint,
  IntentConfirmationProps,
} from "./ui/intent-confirmation";

// Agent visualization
export { MultiAgentDashboard } from "./agents/multi-agent-dashboard";
export { AgentFlowVisualizer } from "./agents/agent-flow-visualizer";
export { AgentConfigPanel } from "./agents/agent-config-panel";
export { GuardrailsIndicator } from "@hki/ui";

// Agent types (using aliasing to avoid conflicts)
export type { Agent as DashboardAgent } from "./agents/multi-agent-dashboard";
export type {
  AgentNode,
  AgentHandoff,
  AgentFlowVisualizerProps,
} from "./agents/agent-flow-visualizer";
export type {
  AgentConfig,
  AgentOption,
  AgentConfigPanelProps,
} from "./agents/agent-config-panel";

// Evidence & Citations
export { EvidenceChip, EvidenceList } from "./ui/evidence-chip";
export type {
  Evidence,
  EvidenceChipProps,
  EvidenceListProps,
} from "./ui/evidence-chip";

// Confidence Indicators
export { ConfidenceIndicator, ConfidenceBar } from "./ui/confidence-indicator";
export type {
  ConfidenceIndicatorProps,
  ConfidenceBarProps,
} from "./ui/confidence-indicator";

// Trust Indicator (unified confidence + citations)
export { TrustIndicator } from "./ui/trust-indicator";
export type { TrustIndicatorProps } from "./ui/trust-indicator";

// Streaming Components
export { StreamingMessage, StreamingText } from "./ui/streaming-message";
export type {
  StreamingMessageProps,
  StreamingTextProps,
} from "./ui/streaming-message";

// Tool Registry
export { ToolRegistryBrowser } from "./tools/tool-registry-browser";
export type {
  Tool,
  ToolParameter,
  ToolUsageStats,
} from "./tools/tool-registry-browser";

// Suggestions
export { SmartSuggestions } from "./suggestions/smart-suggestions";
export { NextQuestionTip } from "./suggestions/next-question-tip";
export { useFollowUpSuggestions } from "./suggestions/use-follow-up-suggestions";
export type {
  FollowUpSuggestion,
  UseFollowUpSuggestionsResult,
} from "./suggestions/use-follow-up-suggestions";
export type { NextQuestionTipProps } from "./suggestions/next-question-tip";

// Footer
export { AppFooter } from "./footer/app-footer";

// Message display
export { MessageBubble } from "./task-messages/message-bubble";

// Hooks
export { useTaskMessages, useSendMessage } from "./hooks/use-task-messages";
export { useTasks, useCreateTask } from "./hooks/use-tasks";
export { useSpans } from "./hooks/use-spans";
export { useLocalStorageState } from "./hooks/use-local-storage-state";
export { useSafeSearchParams, SearchParamKey } from "./hooks/use-search-params";

// Types
export type {
  TaskMessage,
  TaskMessageContent,
  TextContent,
  DataContent,
  ReasoningContent,
  ToolRequestContent,
  ToolResponseContent,
  Task,
  Agent,
  Span,
  SpanEvent,
  JsonValue,
} from "./types";

// Adapters (internal)
export {
  agenticMessageToTaskMessage,
  agenticConversationToTask,
  agenticThoughtTraceToSpans,
} from "./adapters/agentic-adapter";
