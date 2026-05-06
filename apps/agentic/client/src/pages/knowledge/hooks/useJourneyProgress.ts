/**
 * useJourneyProgress — Centralized journey state for the Knowledge Platform
 *
 * Single source of truth for step completion. Used by:
 *   - OverviewTab (renders the journey map)
 *   - index.tsx (passes onStepComplete to child tabs)
 *   - IngestTab, ValidateTab, etc. (call onStepComplete after actions)
 *
 * Persistence: localStorage keyed by stream. Auto-detects data-driven completion.
 * Toast feedback on every step transition with next-step guidance.
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNotifications } from "@hki/ui";

// ── Step definitions ─────────────────────────────────────────────────────────
export const STEP_IDS = [
  "guidelines",
  "gap-analysis",
  "first-ingest",
  "verify",
  "test",
  "iterate",
] as const;

export type StepId = (typeof STEP_IDS)[number];

interface StepMeta {
  id: StepId;
  step: number;
  label: string;
  phase: 1 | 2;
  nextMessage: string; // toast shown after completing this step
}

export const STEP_META: StepMeta[] = [
  {
    id: "guidelines",
    step: 1,
    label: "Read the Guide",
    phase: 1,
    nextMessage: "Next: Find out what content your agent needs.",
  },
  {
    id: "gap-analysis",
    step: 2,
    label: "Find What\u2019s Missing",
    phase: 1,
    nextMessage:
      "Now upload your first document \u2014 a file, text, or Google Drive link.",
  },
  {
    id: "first-ingest",
    step: 3,
    label: "Upload Your First Document",
    phase: 1,
    nextMessage:
      "Phase 1 done! Review extracted pages, text, and metadata before you test answers.",
  },
  {
    id: "verify",
    step: 4,
    label: "Check Your Content",
    phase: 2,
    nextMessage:
      "Looks good! Try asking your agent a question to see how it responds.",
  },
  {
    id: "test",
    step: 5,
    label: "Try Asking a Question",
    phase: 2,
    nextMessage:
      "Nice! Keep adding content and improving as your team\u2019s needs grow.",
  },
  {
    id: "iterate",
    step: 6,
    label: "Add More & Improve",
    phase: 2,
    nextMessage:
      "All steps complete \u2014 your domain library is ready for your team!",
  },
];

// ── localStorage helpers ─────────────────────────────────────────────────────
function storageKey(streamKey: string) {
  return `kb-journey-${streamKey}`;
}

function readSteps(streamKey: string): StepId[] {
  try {
    const raw = localStorage.getItem(storageKey(streamKey));
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((s: string) => STEP_IDS.includes(s as StepId))
      : [];
  } catch {
    return [];
  }
}

function writeSteps(streamKey: string, steps: StepId[]) {
  try {
    localStorage.setItem(storageKey(streamKey), JSON.stringify(steps));
  } catch {}
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export interface JourneyProgress {
  completedSteps: Set<StepId>;
  currentStep: StepMeta | null;
  doneCount: number;
  phase1Complete: boolean;
  allComplete: boolean;
  completeStep: (stepId: string) => void;
  isStepComplete: (stepId: string) => boolean;
  isStepLocked: (stepId: string) => boolean;
}

export function useJourneyProgress(
  streamKey: string,
  data: { docCount: number; chunkCount: number; entityCount: number }
): JourneyProgress {
  const { docCount, chunkCount, entityCount } = data;

  // ── State from localStorage ──
  const [manualSteps, setManualSteps] = useState<StepId[]>(() =>
    readSteps(streamKey)
  );

  // Re-read on stream change
  useEffect(() => {
    setManualSteps(readSteps(streamKey));
  }, [streamKey]);

  // ── Data-driven auto-detection (supplements manual) ──
  const autoDetected = useMemo(() => {
    const auto = new Set<StepId>();
    if (docCount > 0) auto.add("first-ingest");
    if (chunkCount > 0) auto.add("verify");
    // "test" requires meaningful content: at least 5 docs with 100+ passages
    if (docCount >= 5 && chunkCount >= 100) auto.add("test");
    // "iterate" requires sustained effort: 20+ docs with 200+ passages and some entities
    if (docCount >= 20 && chunkCount >= 200) auto.add("iterate");
    return auto;
  }, [docCount, chunkCount, entityCount]);

  // ── Merged completed set ──
  const completedSteps = useMemo(() => {
    const merged = new Set<StepId>(manualSteps);
    autoDetected.forEach(s => merged.add(s));
    return merged;
  }, [manualSteps, autoDetected]);

  // ── Complete a step (with notification + persist) ──
  const { notify } = useNotifications();
  const completeStep = useCallback(
    (stepId: string) => {
      if (!STEP_IDS.includes(stepId as StepId)) return; // Invalid step
      const id = stepId as StepId;
      setManualSteps(prev => {
        if (prev.includes(id)) return prev; // Already done

        const next = [...prev, id];
        writeSteps(streamKey, next);

        const meta = STEP_META.find(s => s.id === id);
        if (meta) {
          notify({
            title: `Step ${meta.step}: ${meta.label}`,
            description: `Next → ${meta.nextMessage}`,
            severity: "success",
            group: "journey",
          });
        }

        return next;
      });
    },
    [streamKey, notify]
  );

  // ── Derived state ──
  const currentStep = useMemo(() => {
    return STEP_META.find(s => !completedSteps.has(s.id)) ?? null;
  }, [completedSteps]);

  const doneCount = STEP_META.filter(s => completedSteps.has(s.id)).length;
  const phase1Complete = STEP_META.filter(s => s.phase === 1).every(s =>
    completedSteps.has(s.id)
  );
  const allComplete = doneCount === STEP_META.length;

  const isStepComplete = useCallback(
    (stepId: string) => completedSteps.has(stepId as StepId),
    [completedSteps]
  );

  const isStepLocked = useCallback(
    (stepId: string) => {
      const meta = STEP_META.find(s => s.id === stepId);
      if (!meta) return true;
      if (meta.step === 1) return false; // First step never locked
      // Check if previous step is complete
      const prevMeta = STEP_META.find(s => s.step === meta.step - 1);
      if (prevMeta && !completedSteps.has(prevMeta.id)) return true;
      // Phase 2 locked if Phase 1 incomplete
      if (meta.phase === 2 && !phase1Complete) return true;
      return false;
    },
    [completedSteps, phase1Complete]
  );

  return {
    completedSteps,
    currentStep,
    doneCount,
    phase1Complete,
    allComplete,
    completeStep,
    isStepComplete,
    isStepLocked,
  };
}
