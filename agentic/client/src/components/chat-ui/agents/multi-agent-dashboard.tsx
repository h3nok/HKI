/**
 * MultiAgentDashboard - World-Class Agent Swarm Visualization
 * 
 * Features:
 * - CSS variable theming for light/dark modes
 * - Real-time status indicators
 * - Progress visualization
 * - Smooth animations with Framer Motion
 */

import { motion } from 'framer-motion';
import { Brain, Search, Wrench, MessageSquare, Shield, Activity, Zap } from 'lucide-react';
import { cn } from '@hki/ui';

// ============================================================================
// TYPES
// ============================================================================

export interface Agent {
  id: string;
  name: string;
  type: 'supervisor' | 'router' | 'tool-use' | 'generation' | 'retail' | 'feedback';
  status: 'idle' | 'active' | 'busy' | 'error';
  currentTask?: string;
  tasksCompleted: number;
  successRate: number;
}

interface MultiAgentDashboardProps {
  agents: Agent[];
  activeAgentId?: string;
}

// ============================================================================
// DESIGN CONFIG
// ============================================================================

const agentIcons = {
  supervisor: Brain,
  router: Activity,
  'tool-use': Wrench,
  generation: MessageSquare,
  retail: Search,
  feedback: Shield,
};

const statusConfig = {
  idle: {
    color: 'var(--muted-foreground)',
    bgColor: 'color-mix(in srgb, var(--muted) 100%, transparent)',
    label: 'Idle',
  },
  active: {
    color: 'var(--primary)',
    bgColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
    label: 'Active',
  },
  busy: {
    color: 'var(--warning, #d97706)',
    bgColor: 'color-mix(in srgb, var(--warning, #d97706) 12%, transparent)',
    label: 'Busy',
  },
  error: {
    color: 'var(--destructive)',
    bgColor: 'color-mix(in srgb, var(--destructive) 12%, transparent)',
    label: 'Error',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MultiAgentDashboard({ agents, activeAgentId }: MultiAgentDashboardProps) {
  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className="p-1.5 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
        >
          <Brain className="h-4 w-4" style={{ color: 'var(--primary)' }} />
        </div>
        <h3
          className="text-sm font-semibold"
          style={{ color: 'var(--foreground)' }}
        >
          Agent Swarm
        </h3>
      </div>

      {/* Agent Cards */}
      <div className="space-y-2.5">
        {agents.map((agent, index) => {
          const Icon = agentIcons[agent.type];
          const config = statusConfig[agent.status];
          const isActive = agent.id === activeAgentId;

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative rounded-xl border p-3 transition-all duration-200"
              style={{
                background: isActive
                  ? 'color-mix(in srgb, var(--primary) 5%, var(--card))'
                  : 'var(--card)',
                borderColor: isActive
                  ? 'color-mix(in srgb, var(--primary) 30%, var(--border))'
                  : 'var(--border)',
                boxShadow: isActive
                  ? '0 2px 8px -2px color-mix(in srgb, var(--primary) 15%, transparent)'
                  : 'none',
              }}
            >
              {/* Active Indicator Line */}
              {isActive && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full"
                  style={{ background: 'var(--primary)' }}
                />
              )}

              <div className="flex items-start gap-3 pl-1">
                {/* Icon */}
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors"
                  style={{
                    background: isActive
                      ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                      : config.bgColor,
                  }}
                >
                  <Icon
                    className="h-4 w-4"
                    style={{ color: isActive ? 'var(--primary)' : config.color }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 space-y-1.5 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 justify-between">
                    <h4
                      className="font-semibold text-xs truncate"
                      style={{
                        color: isActive
                          ? 'var(--primary)'
                          : 'var(--foreground)',
                      }}
                    >
                      {agent.name}
                    </h4>
                    <span
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize"
                      style={{
                        background: config.bgColor,
                        color: config.color,
                      }}
                    >
                      {config.label}
                    </span>
                  </div>

                  {agent.currentTask && (
                    <p
                      className="text-[11px] leading-relaxed line-clamp-2"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {agent.currentTask}
                    </p>
                  )}

                  {/* Progress Bar */}
                  <div className="flex items-center gap-3 pt-1">
                    <div
                      className="flex-1 h-1 rounded-full overflow-hidden"
                      style={{ background: 'color-mix(in srgb, var(--muted) 100%, transparent)' }}
                    >
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'var(--success, #16a34a)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.successRate * 100}%` }}
                        transition={{ duration: 0.5, delay: index * 0.1 }}
                      />
                    </div>
                    <span
                      className="text-[10px] font-medium whitespace-nowrap"
                      style={{ color: 'var(--muted-foreground)' }}
                    >
                      {agent.tasksCompleted} tasks
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { label: 'Agents', value: agents.length, color: 'var(--foreground)' },
          { label: 'Active', value: agents.filter((a) => a.status === 'active' || a.status === 'busy').length, color: 'var(--primary)' },
          { label: 'Tasks', value: agents.reduce((sum, a) => sum + a.tasksCompleted, 0), color: 'var(--success, #16a34a)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl p-3 text-center"
            style={{
              background: 'color-mix(in srgb, var(--muted) 50%, transparent)',
              border: '1px solid var(--border)',
            }}
          >
            <div
              className="text-[10px] uppercase tracking-wider font-bold mb-1"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {stat.label}
            </div>
            <div
              className="text-lg font-bold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
