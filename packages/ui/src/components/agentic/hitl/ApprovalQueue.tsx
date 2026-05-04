/**
 * ApprovalQueue Component
 *
 * Category: hitl
 * Priority: P0 (Core)
 * Complexity: High
 *
 * Human-in-the-loop approval queue for agent actions requiring human review.
 * - Enterprise Agentic UI aesthetics (glassmorphism, crisp data grid borders)
 * - Animated expansions and elegant risk-scoring visualization
 * - Supports batch operations, priority sorting, and keyboard navigation.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  Filter,
  CheckSquare,
  Square,
  Zap,
  Shield,
  Wrench,
  ShieldAlert,
} from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Types
// ============================================================================

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type ApprovalPriority = 'critical' | 'high' | 'medium' | 'low';
export type ApprovalType = 'tool_execution' | 'data_access' | 'external_api' | 'sensitive_action';

export interface ApprovalItem {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  agentName: string;
  priority: ApprovalPriority;
  status: ApprovalStatus;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  riskScore?: number;
}

export interface ApprovalQueueProps {
  items: ApprovalItem[];
  onApprove?: (ids: string[]) => void;
  onReject?: (ids: string[], reason?: string) => void;
  onItemClick?: (item: ApprovalItem) => void;
  className?: string;
  emptyMessage?: string;
  showBatchActions?: boolean;
  showFilters?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const priorityConfig: Record<ApprovalPriority, {
  colorClass: string;
  bgClass: string;
  borderClass: string;
  label: string;
  order: number;
}> = {
  critical: {
    colorClass: 'text-destructive',
    bgClass: 'bg-destructive/10',
    borderClass: 'border-destructive/20',
    label: 'Critical',
    order: 0,
  },
  high: {
    colorClass: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    label: 'High',
    order: 1,
  },
  medium: {
    colorClass: 'text-amber-600/80 dark:text-amber-500/80',
    bgClass: 'bg-amber-500/5',
    borderClass: 'border-amber-500/10',
    label: 'Medium',
    order: 2,
  },
  low: {
    colorClass: 'text-muted-foreground',
    bgClass: 'bg-muted/50',
    borderClass: 'border-border',
    label: 'Low',
    order: 3,
  },
};

const typeConfig: Record<ApprovalType, { icon: React.ElementType; label: string }> = {
  tool_execution: { icon: Wrench, label: 'Tool Execution' },
  data_access: { icon: Shield, label: 'Data Access' },
  external_api: { icon: Zap, label: 'External API' },
  sensitive_action: { icon: AlertTriangle, label: 'Sensitive Action' },
};

const statusConfig: Record<ApprovalStatus, { icon: React.ElementType; colorClass: string }> = {
  pending: { icon: Clock, colorClass: 'text-amber-600 dark:text-amber-500' },
  approved: { icon: CheckCircle2, colorClass: 'text-emerald-600 dark:text-emerald-500' },
  rejected: { icon: XCircle, colorClass: 'text-destructive' },
  expired: { icon: Clock, colorClass: 'text-muted-foreground' },
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ApprovalItemRowProps {
  item: ApprovalItem;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClick?: ((item: ApprovalItem) => void) | undefined;
}

const ApprovalItemRow: React.FC<ApprovalItemRowProps> = ({
  item,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
  onApprove,
  onReject,
  onClick,
}) => {
  const priority = priorityConfig[item.priority];
  const type = typeConfig[item.type];
  const status = statusConfig[item.status];
  const TypeIcon = type.icon;
  const StatusIcon = status.icon;

  const isPending = item.status === 'pending';
  const timeRemaining = item.expiresAt
    ? Math.max(0, new Date(item.expiresAt).getTime() - Date.now())
    : null;
  const isExpiring = timeRemaining !== null && timeRemaining < 5 * 60 * 1000;

  return (
    <div
      className={cn(
        'group transition-colors border-b border-border/40',
        isSelected ? 'bg-primary/5' : 'hover:bg-muted/10'
      )}
      role="row"
      aria-selected={isSelected}
    >
      <div className="flex items-center gap-4 px-5 py-3.5">
        {/* Selection Checkbox */}
        {isPending && (
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className="shrink-0 transition-transform active:scale-90"
            aria-label={isSelected ? 'Deselect item' : 'Select item'}
          >
            {isSelected ? (
              <CheckSquare className="h-[18px] w-[18px] text-primary" />
            ) : (
              <Square className="h-[18px] w-[18px] text-muted-foreground/50 hover:text-primary transition-colors" />
            )}
          </button>
        )}

        {/* Type Icon */}
        <div className={cn('shrink-0 rounded-xl p-2.5 shadow-sm border', priority.bgClass, priority.borderClass)}>
          <TypeIcon className={cn('h-4 w-4', priority.colorClass)} />
        </div>

        {/* Content */}
        <div
          className="flex-1 min-w-0 cursor-pointer py-1"
          onClick={() => onClick?.(item)}
        >
          <div className="flex items-center gap-2.5">
            <h4 className="font-semibold text-[13px] text-foreground/90 truncate tracking-wide">
              {item.title}
            </h4>
            <span
              className={cn(
                'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border',
                priority.bgClass,
                priority.colorClass,
                priority.borderClass
              )}
            >
              {priority.label}
            </span>
            {isExpiring && isPending && (
              <span className="text-[10px] uppercase font-bold tracking-wider text-destructive animate-pulse bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20">
                Expiring
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium text-muted-foreground/70 truncate mt-1 tracking-wide uppercase">
            {item.agentName} • {type.label}
          </p>
        </div>

        {/* Status */}
        <div className="shrink-0 flex items-center gap-4">
          <StatusIcon className={cn('h-4 w-4', status.colorClass)} />

          {/* Actions for pending items */}
          {isPending && (
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onApprove(item.id)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-500/20 hover:scale-105 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                aria-label={`Approve: ${item.title}`}
              >
                <CheckCircle2 className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => onReject(item.id)}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 hover:scale-105 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
                aria-label={`Reject: ${item.title}`}
              >
                <XCircle className="h-[18px] w-[18px]" />
              </button>
            </div>
          )}

          {/* Expand Button */}
          <button
            type="button"
            onClick={() => onToggleExpand(item.id)}
            className="p-1.5 transition-colors rounded-lg hover:bg-muted/50 outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
            </motion.div>
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden bg-muted/5 border-t border-border/20 shadow-inner"
          >
            <div className="px-5 py-4 ml-[52px] mr-5 space-y-4">
              <p className="text-[13px] leading-relaxed text-foreground/80 font-medium">
                {item.description}
              </p>
              
              {item.riskScore !== undefined && (
                <div className="flex items-center gap-3 bg-card/60 border border-border/40 p-3 rounded-xl max-w-sm">
                  <ShieldAlert className={cn('h-4 w-4', item.riskScore > 0.7 ? 'text-destructive' : item.riskScore > 0.4 ? 'text-amber-500' : 'text-emerald-500')} />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Risk Assessment:
                  </span>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted/60 relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${item.riskScore * 100}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="absolute left-0 top-0 bottom-0 rounded-full"
                      style={{
                        background:
                          item.riskScore > 0.7
                            ? 'var(--destructive)'
                            : item.riskScore > 0.4
                            ? 'var(--warning, #d97706)'
                            : 'var(--success, #16a34a)',
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-extrabold text-foreground/90">
                    {Math.round(item.riskScore * 100)}
                  </span>
                </div>
              )}

              {item.metadata && Object.keys(item.metadata).length > 0 && (
                <details className="text-xs group/metadata">
                  <summary className="cursor-pointer font-bold uppercase tracking-widest text-[10px] text-muted-foreground hover:text-primary transition-colors outline-none list-none flex items-center gap-2">
                    <ChevronDown className="h-3 w-3 group-open/metadata:rotate-180 transition-transform" />
                    Invocation Context
                  </summary>
                  <motion.pre
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 p-3.5 rounded-xl text-[11px] overflow-auto bg-card border border-border/50 shadow-sm text-foreground/80 font-mono tracking-tight"
                  >
                    {JSON.stringify(item.metadata, null, 2)}
                  </motion.pre>
                </details>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({
  items,
  onApprove,
  onReject,
  onItemClick,
  className,
  emptyMessage = 'No items awaiting approval',
  showBatchActions = true,
  showFilters = true,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<ApprovalPriority | 'all'>('all');
  const [filterType, setFilterType] = useState<ApprovalType | 'all'>('all');

  // Filter and sort items
  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        if (filterPriority !== 'all' && item.priority !== filterPriority) return false;
        if (filterType !== 'all' && item.type !== filterType) return false;
        return true;
      })
      .sort((a, b) => {
        // Pending first, then by priority, then by created date
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        const priorityDiff = priorityConfig[a.priority].order - priorityConfig[b.priority].order;
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [items, filterPriority, filterType]);

  const pendingItems = useMemo(
    () => filteredItems.filter(item => item.status === 'pending'),
    [filteredItems]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === pendingItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingItems.map(item => item.id)));
    }
  }, [pendingItems, selectedIds.size]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleApprove = useCallback((id: string) => {
    onApprove?.([id]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onApprove]);

  const handleReject = useCallback((id: string) => {
    onReject?.([id]);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, [onReject]);

  const handleBatchApprove = useCallback(() => {
    if (selectedIds.size > 0) {
      onApprove?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [onApprove, selectedIds]);

  const handleBatchReject = useCallback(() => {
    if (selectedIds.size > 0) {
      onReject?.(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }, [onReject, selectedIds]);

  if (items.length === 0) {
    return (
      <div
        className={cn('flex flex-col items-center justify-center py-20 text-center rounded-2xl border border-border/40 bg-card/40 backdrop-blur-xl', className)}
        role="status"
        aria-live="polite"
      >
        <div className="h-16 w-16 mb-5 rounded-full bg-muted/40 flex items-center justify-center border border-border/50 shadow-inner">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-widest mb-1.5">{emptyMessage}</h3>
        <p className="text-xs text-muted-foreground/70 font-medium">All agentic actions have been reviewed.</p>
      </div>
    );
  }

  return (
    <div
      className={cn('rounded-2xl overflow-hidden border border-border/50 shadow-lg bg-card/60 backdrop-blur-2xl', className)}
      data-component="ApprovalQueue"
      role="table"
      aria-label="Approval queue"
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {pendingItems.length} items pending approval
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 border-b border-border/40 bg-muted/10 relative">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-[13px] uppercase tracking-widest text-foreground">
            Action Queue
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 shadow-sm">
            {pendingItems.length} Actions
          </span>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="flex items-center gap-2.5">
            <Filter className="h-[14px] w-[14px] text-muted-foreground/60" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as ApprovalPriority | 'all')}
              className="text-[11px] font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 outline-none bg-card/60 backdrop-blur-sm border border-border/60 text-foreground/80 hover:bg-muted/50 transition-colors focus:ring-2 focus:ring-primary/40 appearance-none shadow-sm cursor-pointer"
              aria-label="Filter by priority"
            >
              <option value="all">Priority: All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ApprovalType | 'all')}
              className="text-[11px] font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 outline-none bg-card/60 backdrop-blur-sm border border-border/60 text-foreground/80 hover:bg-muted/50 transition-colors focus:ring-2 focus:ring-primary/40 appearance-none shadow-sm cursor-pointer"
              aria-label="Filter by type"
            >
              <option value="all">Type: All</option>
              <option value="tool_execution">Tool Execution</option>
              <option value="data_access">Data Access</option>
              <option value="external_api">External API</option>
              <option value="sensitive_action">Sensitives</option>
            </select>
          </div>
        )}
      </div>

      {/* Batch Actions */}
      <AnimatePresence>
        {showBatchActions && pendingItems.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-border/40 bg-primary/5"
          >
            <div className="flex items-center gap-4 px-5 py-3">
              <button
                type="button"
                onClick={handleSelectAll}
                className="group flex flex-col uppercase font-bold text-[10px] tracking-widest text-muted-foreground hover:text-primary transition-colors outline-none"
              >
                {selectedIds.size === pendingItems.length ? 'Deselect All' : 'Select All'}
                <div className="h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left mt-0.5" />
              </button>

              {selectedIds.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 ml-2"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60 bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    {selectedIds.size} Target{selectedIds.size > 1 ? 's' : ''}
                  </span>
                  
                  <button
                    type="button"
                    onClick={handleBatchApprove}
                    className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 shadow-sm"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={handleBatchReject}
                    className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider text-destructive bg-destructive/10 hover:bg-destructive/20 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 shadow-sm"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Items List */}
      <div role="rowgroup" className="divide-y divide-border/20 bg-background/30 backdrop-blur-xl">
        {filteredItems.map(item => (
          <ApprovalItemRow
            key={item.id}
            item={item}
            isSelected={selectedIds.has(item.id)}
            isExpanded={expandedIds.has(item.id)}
            onSelect={handleSelect}
            onToggleExpand={handleToggleExpand}
            onApprove={handleApprove}
            onReject={handleReject}
            onClick={onItemClick}
          />
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-12 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground/60 bg-muted/5">
          Validation Filter Empty
        </div>
      )}
    </div>
  );
};

ApprovalQueue.displayName = 'ApprovalQueue';

export default ApprovalQueue;
