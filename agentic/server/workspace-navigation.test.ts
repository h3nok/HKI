import { describe, expect, it, vi } from "vitest";

import {
  buildChatWorkspaceHref,
  buildKnowledgeLibraryHref,
  buildKnowledgeWorkspaceHref,
  claimKnowledgeWorkspaceWindow,
  extractKnowledgeNavigationFromSearch,
  extractWorkspaceScopeFromSearch,
  normalizeWorkspaceScope,
  openKnowledgeWorkspaceWindow,
  prepareKnowledgeLibraryNavigation,
} from "../client/src/_core/workspace-navigation";

describe("workspace navigation", () => {
  it("normalizes empty and global scopes to an unscoped workspace", () => {
    expect(normalizeWorkspaceScope(undefined)).toBeNull();
    expect(normalizeWorkspaceScope("")).toBeNull();
    expect(normalizeWorkspaceScope("global")).toBeNull();
  });

  it("preserves explicit stream scope across chat and knowledge hops", () => {
    expect(buildKnowledgeWorkspaceHref("pharmacy")).toBe(
      "/knowledge?stream=pharmacy"
    );
    expect(buildChatWorkspaceHref("pharmacy")).toBe("/chat?scope=pharmacy");
  });

  it("primes KB library navigation with the focused document", () => {
    const storage = new Map<string, string>();
    const sessionStorage = {
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
    };

    vi.stubGlobal("window", { sessionStorage });

    try {
      prepareKnowledgeLibraryNavigation("doc-123");

      expect(buildKnowledgeLibraryHref("pharmacy", "doc-123")).toBe(
        "/knowledge?stream=pharmacy&tab=library&doc=doc-123"
      );
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "knowledge-active-tab",
        "library"
      );
      expect(sessionStorage.setItem).toHaveBeenCalledWith(
        "kb-focus-document-id",
        "doc-123"
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("derives scope from either chat or knowledge URL params", () => {
    expect(extractWorkspaceScopeFromSearch("?scope=optical")).toBe("optical");
    expect(extractWorkspaceScopeFromSearch("?stream=fresh-foods")).toBe(
      "fresh-foods"
    );
  });

  it("extracts KB tab and document targets from the URL", () => {
    expect(
      extractKnowledgeNavigationFromSearch(
        "?stream=pharmacy&tab=library&doc=doc-55"
      )
    ).toEqual({
      tab: "library",
      documentId: "doc-55",
    });
  });

  it("reuses a named KB browser tab when opening Knowledge", () => {
    const focus = vi.fn();
    const open = vi.fn(() => ({ focus }));
    const windowStub = {
      name: "",
      open,
    };

    vi.stubGlobal("window", windowStub);

    try {
      claimKnowledgeWorkspaceWindow();

      expect(windowStub.name).toBe("agentic-knowledge-workspace");

      openKnowledgeWorkspaceWindow("/knowledge?stream=pharmacy");

      expect(open).toHaveBeenCalledWith(
        "/knowledge?stream=pharmacy",
        "agentic-knowledge-workspace"
      );
      expect(focus).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("fails closed to unscoped routes when the URL does not carry a non-global stream", () => {
    expect(
      buildKnowledgeWorkspaceHref(extractWorkspaceScopeFromSearch(""))
    ).toBe("/knowledge");
    expect(
      buildKnowledgeWorkspaceHref(
        extractWorkspaceScopeFromSearch("?scope=global")
      )
    ).toBe("/knowledge");
    expect(
      buildChatWorkspaceHref(extractWorkspaceScopeFromSearch("?stream=global"))
    ).toBe("/chat");
  });
});
