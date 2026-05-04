/**
 * Knowledge Shared Context — Connects sidebar, breadcrumb, and content.
 *
 * Extracted from index.tsx for single-responsibility modularity.
 */

import { createContext, useContext } from "react";
import type { GovernSection, KnowledgeTab } from "../types";

export interface KnowledgeState {
  tab: KnowledgeTab;
  setTab: (t: KnowledgeTab) => void;
  governSection: GovernSection;
  setGovernSection: (section: GovernSection) => void;
  selectedStream: string;
  setSelectedStream: (s: string) => void;
  streamLabel: string;
  isStreamLocked: boolean;
  isAdmin: boolean;
  onOpenGuide: () => void;
  isAttested: boolean;
  isAttestationLoading: boolean;
  attestedAt: string | null;
}

export const KnowledgeCtx = createContext<KnowledgeState>(null!);

export function useKB() {
  return useContext(KnowledgeCtx);
}
