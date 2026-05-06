/**
 * AgentFlowVisualizer - Real-time Agent Collaboration Visualization
 *
 * Shows how requests flow through the agent hierarchy:
 * User → Supervisor Agent → Router Agent → Worker Agents
 *
 * Features:
 * - Animated flow paths between agents
 * - Real-time status indicators
 * - Agent handoff notifications
 * - Visual feedback for active agents
 */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Activity,
  Wrench,
  MessageSquare,
  Search,
  Shield,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@hki/ui";

// ============================================================================
// TYPES
// ============================================================================

export type AgentType =
  | "supervisor"
  | "router"
  | "tool-use"
  | "generation"
  | "retail"
  | "feedback"
  | "guardrails";

export type AgentStatus = "idle" | "active" | "completed" | "error";

export interface AgentNode {
  id: string;
  type: AgentType;
  name: string;
  status: AgentStatus;
  startTime?: number;
  endTime?: number;
  message?: string;
}

export interface AgentHandoff {
  from: AgentType;
  to: AgentType;
  timestamp: number;
  reason?: string;
}

export interface AgentFlowVisualizerProps {
  agents: AgentNode[];
  currentAgent?: AgentType;
  handoffs: AgentHandoff[];
  layout?: "horizontal" | "vertical";
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const agentConfig = {
  supervisor: {
    icon: Brain,
    color: "var(--primary)",
    label: "Supervisor",
    description: "Orchestrates the agent workflow",
  },
  router: {
    icon: Activity,
    color: "#8b5cf6",
    label: "Router",
    description: "Routes requests to specialized agents",
  },
  "tool-use": {
    icon: Wrench,
    color: "#16a34a",
    label: "Tool Use",
    description: "Executes external tools",
  },
  generation: {
    icon: MessageSquare,
    color: "var(--primary)",
    label: "Generation",
    description: "Generates natural language responses",
  },
  retail: {
    icon: Search,
    color: "color-mix(in srgb, var(--primary) 72%, var(--foreground))",
    label: "Retail",
    description: "Handles retail-specific queries",
  },
  feedback: {
    icon: Shield,
    color: "#ec4899",
    label: "Feedback",
    description: "Collects and processes feedback",
  },
  guardrails: {
    icon: Shield,
    color: "#64748b",
    label: "Guardrails",
    description: "Safety and compliance checks",
  },
};

const statusConfig = {
  idle: {
    color: "var(--muted-foreground)",
    bgColor: "var(--muted)",
    icon: Clock,
  },
  active: {
    color: "var(--primary)",
    bgColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
    icon: Activity,
  },
  completed: {
    color: "#16a34a",
    bgColor: "color-mix(in srgb, #16a34a 15%, transparent)",
    icon: CheckCircle2,
  },
  error: {
    color: "var(--destructive)",
    bgColor: "color-mix(in srgb, var(--destructive) 15%, transparent)",
    icon: AlertCircle,
  },
};

// ============================================================================
// COMPONENTS
// ============================================================================

function AgentCard({
  agent,
  isActive,
}: {
  agent: AgentNode;
  isActive: boolean;
}) {
  const config = agentConfig[agent.type];
  const statusCfg = statusConfig[agent.status];
  const Icon = config.icon;
  const StatusIcon = statusCfg.icon;

  const duration =
    agent.startTime && agent.endTime
      ? ((agent.endTime - agent.startTime) / 1000).toFixed(2)
      : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: isActive
          ? `0 0 0 3px color-mix(in srgb, ${config.color} 25%, transparent)`
          : "0 1px 3px rgba(0, 0, 0, 0.1)",
      }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-xl p-4 border",
        "transition-all duration-300",
        isActive && "scale-105"
      )}
      style={{
        background: isActive
          ? `color-mix(in srgb, ${config.color} 8%, var(--card))`
          : "var(--card)",
        borderColor: isActive
          ? `color-mix(in srgb, ${config.color} 40%, var(--border))`
          : "var(--border)",
      }}
    >
      {/* Status Badge */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="absolute -top-2 -right-2 p-1.5 rounded-full border-2"
        style={{
          background: statusCfg.bgColor,
          borderColor: "var(--card)",
        }}
      >
        <StatusIcon className="h-3 w-3" style={{ color: statusCfg.color }} />
      </motion.div>

      {/* Icon */}
      <div
        className="inline-flex p-2.5 rounded-lg mb-3"
        style={{
          background: `color-mix(in srgb, ${config.color} 15%, transparent)`,
        }}
      >
        <Icon className="h-5 w-5" style={{ color: config.color }} />
      </div>

      {/* Content */}
      <div>
        <h4
          className="font-semibold text-sm mb-0.5"
          style={{ color: "var(--foreground)" }}
        >
          {config.label}
        </h4>
        <p
          className="text-xs mb-2"
          style={{ color: "var(--muted-foreground)" }}
        >
          {config.description}
        </p>

        {/* Message */}
        {agent.message && (
          <p
            className="text-xs font-medium mt-2 p-2 rounded bg-muted/50"
            style={{ color: "var(--foreground)" }}
          >
            {agent.message}
          </p>
        )}

        {/* Duration */}
        {duration && (
          <div className="flex items-center gap-1 mt-2 text-xs">
            <Clock
              className="h-3 w-3"
              style={{ color: "var(--muted-foreground)" }}
            />
            <span style={{ color: "var(--muted-foreground)" }}>
              {duration}s
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FlowArrow({ isActive }: { isActive: boolean }) {
  return (
    <motion.div
      animate={{
        opacity: isActive ? [0.5, 1, 0.5] : 0.3,
        scale: isActive ? [1, 1.1, 1] : 1,
      }}
      transition={{
        duration: 1.5,
        repeat: isActive ? Infinity : 0,
        ease: "easeInOut",
      }}
      className="flex items-center justify-center"
    >
      <ArrowRight
        className="h-5 w-5"
        style={{
          color: isActive ? "var(--primary)" : "var(--muted-foreground)",
        }}
      />
    </motion.div>
  );
}

function HandoffNotification({ handoff }: { handoff: AgentHandoff }) {
  const fromConfig = agentConfig[handoff.from];
  const toConfig = agentConfig[handoff.to];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-3 p-3 rounded-lg border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="p-1.5 rounded-md"
        style={{
          background: `color-mix(in srgb, ${fromConfig.color} 15%, transparent)`,
        }}
      >
        <fromConfig.icon
          className="h-3.5 w-3.5"
          style={{ color: fromConfig.color }}
        />
      </div>

      <ArrowRight
        className="h-4 w-4"
        style={{ color: "var(--muted-foreground)" }}
      />

      <div
        className="p-1.5 rounded-md"
        style={{
          background: `color-mix(in srgb, ${toConfig.color} 15%, transparent)`,
        }}
      >
        <toConfig.icon
          className="h-3.5 w-3.5"
          style={{ color: toConfig.color }}
        />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-medium"
          style={{ color: "var(--foreground)" }}
        >
          {fromConfig.label} → {toConfig.label}
        </p>
        {handoff.reason && (
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {handoff.reason}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AgentFlowVisualizer({
  agents,
  currentAgent,
  handoffs,
  layout = "horizontal",
}: AgentFlowVisualizerProps) {
  const [recentHandoffs, setRecentHandoffs] = useState<AgentHandoff[]>([]);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Show recent handoffs for 5 seconds, with proper timer cleanup
  useEffect(() => {
    if (handoffs.length > 0) {
      const latest = handoffs[handoffs.length - 1];
      setRecentHandoffs(prev => [...prev, latest]);

      const timer = setTimeout(() => {
        setRecentHandoffs(prev => prev.filter(h => h !== latest));
        timersRef.current.delete(timer);
      }, 5000);
      timersRef.current.add(timer);

      return () => {
        clearTimeout(timer);
        timersRef.current.delete(timer);
      };
    }
  }, [handoffs]);

  // Clear all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);

  const isHorizontal = layout === "horizontal";

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            <Activity className="h-4 w-4" style={{ color: "var(--primary)" }} />
          </div>
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--foreground)" }}
          >
            Agent Workflow
          </h3>
        </div>
        <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {agents.filter(a => a.status === "active").length} active
        </div>
      </div>

      {/* Agent Flow */}
      <div
        className={cn(
          "flex items-center gap-4",
          isHorizontal ? "flex-row overflow-x-auto pb-2" : "flex-col"
        )}
      >
        {agents.map((agent, index) => (
          <div key={agent.id} className="flex items-center gap-4">
            <AgentCard agent={agent} isActive={currentAgent === agent.type} />
            {index < agents.length - 1 && (
              <FlowArrow isActive={currentAgent === agent.type} />
            )}
          </div>
        ))}
      </div>

      {/* Handoff Notifications */}
      <AnimatePresence mode="popLayout">
        {recentHandoffs.length > 0 && (
          <div className="space-y-2">
            {recentHandoffs.map((handoff, index) => (
              <HandoffNotification
                key={`${handoff.from}-${handoff.to}-${handoff.timestamp}-${index}`}
                handoff={handoff}
              />
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
