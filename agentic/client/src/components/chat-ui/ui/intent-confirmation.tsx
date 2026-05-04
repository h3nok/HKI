/**
 * IntentConfirmation — Defensive Principle #3: Explicit Intent
 *
 * After the user submits a message, this component briefly shows a
 * rephrased version of their intent + inferred constraints / success
 * criteria. The user can confirm, edit, or cancel before the agent
 * begins processing.
 *
 * Surfaces as a collapsible banner between the message list and the
 * input area.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  XCircle,
  Edit3,
  Target,
  Tag,
} from 'lucide-react';
import { cn } from '@hki/ui';

// ── Types ───────────────────────────────────────────────────────────────

export interface IntentConstraint {
  label: string;
  type: 'scope' | 'data-source' | 'time-range' | 'format';
}

export interface IntentConfirmationProps {
  /** The agent's rephrased interpretation of the user's intent */
  rephrasedIntent: string;
  /** Inferred constraints from the user's message */
  constraints: IntentConstraint[];
  /** Called when user confirms the intent */
  onConfirm: () => void;
  /** Called when user wants to rephrase */
  onEdit: () => void;
  /** Called when user cancels entirely */
  onCancel: () => void;
  className?: string;
}

// ── Constraint colors ───────────────────────────────────────────────────

const constraintColors: Record<IntentConstraint['type'], string> = {
  scope: 'var(--primary)',
  'data-source': 'var(--success, #16a34a)',
  'time-range': 'var(--warning, #d97706)',
  format: 'var(--info, #0284c7)',
};

// ── Component ───────────────────────────────────────────────────────────

export function IntentConfirmation({
  rephrasedIntent,
  constraints,
  onConfirm,
  onEdit,
  onCancel,
  className,
}: IntentConfirmationProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={cn('rounded-xl border overflow-hidden', className)}
      style={{
        background: 'var(--card)',
        borderColor: 'color-mix(in srgb, var(--primary) 25%, var(--border))',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent), 0 4px 12px -4px color-mix(in srgb, var(--neutral-900) 6%, transparent)',
      }}
      role="alert"
      aria-label="Intent confirmation"
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-2.5"
        style={{
          background: 'color-mix(in srgb, var(--primary) 5%, transparent)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <Target className="w-4 h-4 shrink-0" style={{ color: 'var(--primary)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
          I understand your request as:
        </span>
      </div>

      {/* Rephrased intent */}
      <div className="px-3.5 py-3">
        <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
          {rephrasedIntent}
        </p>

        {/* Constraint chips */}
        {constraints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {constraints.map((c, i) => {
              const color = constraintColors[c.type];
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{
                    background: `color-mix(in srgb, ${color} 10%, transparent)`,
                    color,
                    border: `1px solid color-mix(in srgb, ${color} 20%, var(--border))`,
                  }}
                >
                  <Tag className="w-2.5 h-2.5" />
                  {c.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-2 px-3.5 py-2.5"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ background: 'var(--primary)', color: 'white' }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Looks right, proceed
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border"
          style={{
            background: 'transparent',
            color: 'var(--foreground)',
            borderColor: 'var(--border)',
          }}
        >
          <Edit3 className="w-3.5 h-3.5" />
          Rephrase
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: 'color-mix(in srgb, var(--destructive) 10%, transparent)',
            color: 'var(--destructive)',
          }}
        >
          <XCircle className="w-3.5 h-3.5" />
          Cancel
        </button>
      </div>
    </motion.div>
  );
}
