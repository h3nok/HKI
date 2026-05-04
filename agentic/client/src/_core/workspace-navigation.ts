import { GLOBAL_SCOPE } from "@shared/value-streams";

const KNOWLEDGE_ACTIVE_TAB_KEY = "knowledge-active-tab";
const KB_FOCUS_DOCUMENT_KEY = "kb-focus-document-id";
const KNOWLEDGE_TAB_QUERY_KEY = "tab";
const KNOWLEDGE_DOCUMENT_QUERY_KEY = "doc";
const KNOWLEDGE_WORKSPACE_WINDOW_NAME = "agentic-knowledge-workspace";

export type KnowledgeNavigationTarget = {
  tab: string | null;
  documentId: string | null;
};

export function normalizeWorkspaceScope(
  scopeId?: string | null
): string | null {
  const normalized = scopeId?.trim();

  if (!normalized || normalized === GLOBAL_SCOPE) {
    return null;
  }

  return normalized;
}

export function extractWorkspaceScopeFromSearch(
  search?: string | null
): string | null {
  if (!search) {
    return null;
  }

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  return normalizeWorkspaceScope(params.get("scope") ?? params.get("stream"));
}

export function buildChatWorkspaceHref(scopeId?: string | null): string {
  const normalized = normalizeWorkspaceScope(scopeId);

  if (!normalized) {
    return "/chat";
  }

  return `/chat?scope=${encodeURIComponent(normalized)}`;
}

export function buildKnowledgeWorkspaceHref(
  scopeId?: string | null,
  options?: {
    tab?: string | null;
    documentId?: string | null;
  }
): string {
  const normalized = normalizeWorkspaceScope(scopeId);

  const params = new URLSearchParams();
  if (normalized) {
    params.set("stream", normalized);
  }

  const normalizedTab = options?.tab?.trim();
  if (normalizedTab) {
    params.set(KNOWLEDGE_TAB_QUERY_KEY, normalizedTab);
  }

  const normalizedDocumentId = options?.documentId?.trim();
  if (normalizedDocumentId) {
    params.set(KNOWLEDGE_DOCUMENT_QUERY_KEY, normalizedDocumentId);
  }

  const query = params.toString();
  if (!query) {
    return "/knowledge";
  }

  return `/knowledge?${query}`;
}

export function buildKnowledgeLibraryHref(
  scopeId?: string | null,
  documentId?: string | null
): string {
  return buildKnowledgeWorkspaceHref(scopeId, {
    tab: "library",
    documentId,
  });
}

export function extractKnowledgeNavigationFromSearch(
  search?: string | null
): KnowledgeNavigationTarget {
  if (!search) {
    return { tab: null, documentId: null };
  }

  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );

  return {
    tab: params.get(KNOWLEDGE_TAB_QUERY_KEY)?.trim() || null,
    documentId: params.get(KNOWLEDGE_DOCUMENT_QUERY_KEY)?.trim() || null,
  };
}

export function claimKnowledgeWorkspaceWindow(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.name = KNOWLEDGE_WORKSPACE_WINDOW_NAME;
}

export function openKnowledgeWorkspaceWindow(href: string): Window | null {
  if (typeof window === "undefined") {
    return null;
  }

  const knowledgeWindow = window.open(href, KNOWLEDGE_WORKSPACE_WINDOW_NAME);
  knowledgeWindow?.focus();
  return knowledgeWindow;
}

export function prepareKnowledgeLibraryNavigation(
  documentId?: string | null
): void {
  if (typeof window === "undefined") {
    return;
  }

  const normalizedDocumentId = documentId?.trim();

  try {
    window.sessionStorage.setItem(KNOWLEDGE_ACTIVE_TAB_KEY, "library");

    if (normalizedDocumentId) {
      window.sessionStorage.setItem(
        KB_FOCUS_DOCUMENT_KEY,
        normalizedDocumentId
      );
      return;
    }

    window.sessionStorage.removeItem(KB_FOCUS_DOCUMENT_KEY);
  } catch {
    // Ignore storage errors. The navigation still falls back to the KB shell.
  }
}
