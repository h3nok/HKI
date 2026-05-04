import {
  hasKnowledgeManageAccess,
  hasKnowledgeReadAccess,
  hasKnowledgeWriteAccess,
  type Role,
} from "@shared/access-control";
import type { KnowledgeTab } from "@/pages/knowledge/types";

const READER_TABS: KnowledgeTab[] = [
  "overview",
  "library",
  "validate",
  "activity",
];
const WRITER_TABS: KnowledgeTab[] = [
  "overview",
  "ingest",
  "library",
  "validate",
  "activity",
];
const MANAGER_TABS: KnowledgeTab[] = [
  "overview",
  "ingest",
  "library",
  "validate",
  "govern",
  "pipelines",
  "activity",
];

export function canAccessKnowledgeWorkspace(role: Role | null | undefined) {
  return hasKnowledgeReadAccess(role);
}

export function canWriteKnowledgeWorkspace(role: Role | null | undefined) {
  return hasKnowledgeWriteAccess(role);
}

export function canManageKnowledgeWorkspace(role: Role | null | undefined) {
  return hasKnowledgeManageAccess(role);
}

export function getAllowedKnowledgeTabs(
  role: Role | null | undefined
): KnowledgeTab[] {
  if (canManageKnowledgeWorkspace(role)) {
    return MANAGER_TABS;
  }
  if (canWriteKnowledgeWorkspace(role)) {
    return WRITER_TABS;
  }
  if (canAccessKnowledgeWorkspace(role)) {
    return READER_TABS;
  }
  return [];
}

export function isKnowledgeTabAllowed(
  role: Role | null | undefined,
  tab: KnowledgeTab
): boolean {
  return getAllowedKnowledgeTabs(role).includes(tab);
}

export function getDefaultKnowledgeTab(
  role: Role | null | undefined
): KnowledgeTab {
  return getAllowedKnowledgeTabs(role)[0] ?? "overview";
}

export function canSwitchKnowledgeStreams(role: Role | null | undefined) {
  return role === "admin" || role === "manager";
}
