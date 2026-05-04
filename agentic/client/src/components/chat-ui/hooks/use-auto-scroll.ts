/**
 * useAutoScroll — Smart scroll behavior for chat UIs
 *
 * Industry-standard pattern (ChatGPT / Claude / Slack):
 *   1. Auto-scroll to bottom when new content arrives — but ONLY if user is near bottom
 *   2. If user scrolls up to read, auto-scroll pauses
 *   3. Exposes `isAtBottom` so the parent can show a "scroll to bottom" FAB
 *   4. Provides `scrollToBottom()` for manual jump
 *   5. Resumes auto-scroll when user scrolls back near bottom
 *
 * Two triggers (down from three — MutationObserver removed):
 *   - ResizeObserver on the content wrapper: catches all height growth (streaming tokens,
 *     images loading, animated suggestions) without firing on every character. Browser-
 *     throttled so no debounce needed.
 *   - deps useEffect: handles discrete state transitions (task switch, new message,
 *     streaming start/stop, suggestions appearing).
 *   - IntersectionObserver on bottomRef: reliable at-bottom sentinel complementing
 *     threshold-based detection during rapid streaming height changes.
 *   - Scroll snapshot persisted to sessionStorage per conversation for position restore.
 */

import { useRef, useState, useEffect, useCallback } from "react";

const BOTTOM_THRESHOLD = 96; // px from bottom to consider "at bottom"
const MAGNETIC_FOLLOW_THRESHOLD = 240; // px — reattach live scroll when user drifts near the end
const PROGRAMMATIC_SCROLL_COOLDOWN = 350; // ms — must exceed smooth scroll duration (~300ms)
const AUTO_FOLLOW_DEDUPE_MS = 120;
const MAX_PENDING_UPDATES = 99;
const SCROLL_STORAGE_PREFIX = "agentic-chat-scroll:";

export type ScrollFollowMode = "locked" | "magnetic" | "paused";

export type ScrollSnapshot = {
  top: number;
  distanceFromBottom: number;
  updatedAt: number;
};

type AutoFollowRequest = {
  conversationId: string | null;
  contentVersion: number;
  scrollHeight: number;
  requestedAt: number;
};

type AutoScrollOptions = {
  deps?: unknown[];
  conversationId?: string | null;
  isStreaming?: boolean;
  contentVersion?: number;
};

export function getDistanceFromBottomMetrics(
  scrollHeight: number,
  scrollTop: number,
  clientHeight: number
) {
  return Math.max(0, scrollHeight - scrollTop - clientHeight);
}

export function buildScrollStorageKey(conversationId: string) {
  return `${SCROLL_STORAGE_PREFIX}${conversationId}`;
}

export function deriveScrollFollowMode(
  distanceFromBottom: number,
  options: { isStreaming: boolean; userPaused: boolean }
): ScrollFollowMode {
  if (distanceFromBottom <= BOTTOM_THRESHOLD) return "locked";
  if (
    options.isStreaming &&
    !options.userPaused &&
    distanceFromBottom <= MAGNETIC_FOLLOW_THRESHOLD
  ) {
    return "magnetic";
  }
  return "paused";
}

export function restoreScrollTopFromSnapshot(
  scrollHeight: number,
  clientHeight: number,
  snapshot: Pick<ScrollSnapshot, "top" | "distanceFromBottom">
) {
  const maxTop = Math.max(0, scrollHeight - clientHeight);
  const targetFromDistance = Math.max(
    0,
    maxTop - Math.max(0, snapshot.distanceFromBottom)
  );
  if (!Number.isFinite(targetFromDistance)) {
    return Math.min(maxTop, Math.max(0, snapshot.top));
  }
  return Math.min(maxTop, targetFromDistance);
}

export function shouldDispatchAutoFollow(
  previous: AutoFollowRequest | null,
  next: AutoFollowRequest
) {
  if (!previous) return true;
  if (previous.conversationId !== next.conversationId) return true;
  if (previous.contentVersion !== next.contentVersion) return true;
  if (Math.abs(previous.scrollHeight - next.scrollHeight) > 4) return true;
  return next.requestedAt - previous.requestedAt >= AUTO_FOLLOW_DEDUPE_MS;
}

export function derivePendingUpdateCount(
  currentCount: number,
  options: { isStreaming: boolean }
) {
  if (options.isStreaming) {
    return currentCount > 0 ? currentCount : 1;
  }
  return Math.min(MAX_PENDING_UPDATES, currentCount + 1);
}

function readScrollSnapshot(conversationId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(
      buildScrollStorageKey(conversationId)
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ScrollSnapshot>;
    if (
      typeof parsed.top !== "number" ||
      typeof parsed.distanceFromBottom !== "number" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }
    return parsed as ScrollSnapshot;
  } catch {
    return null;
  }
}

function writeScrollSnapshot(conversationId: string, snapshot: ScrollSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      buildScrollStorageKey(conversationId),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore quota/storage errors — scroll state is opportunistic.
  }
}

function getResolvedBehavior(behavior: ScrollBehavior) {
  if (
    behavior === "smooth" &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto";
  }
  return behavior;
}

export function useAutoScroll({
  deps = [],
  conversationId,
  isStreaming = false,
  contentVersion = 0,
}: AutoScrollOptions = {}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [pendingUpdateCount, setPendingUpdateCount] = useState(0);
  const [followMode, setFollowMode] = useState<ScrollFollowMode>("locked");
  const userScrolledRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const lastManualScrollTopRef = useRef(0);
  const programmaticResetRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pendingRestoreRef = useRef<ScrollSnapshot | null>(null);
  const restoredConversationRef = useRef<string | null>(null);
  const lastAutoFollowRef = useRef<AutoFollowRequest | null>(null);

  const getDistanceFromBottom = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 0;
    return getDistanceFromBottomMetrics(
      el.scrollHeight,
      el.scrollTop,
      el.clientHeight
    );
  }, []);

  const persistScrollSnapshot = useCallback(() => {
    const el = containerRef.current;
    if (!el || !conversationId) return;
    writeScrollSnapshot(conversationId, {
      top: el.scrollTop,
      distanceFromBottom: getDistanceFromBottomMetrics(
        el.scrollHeight,
        el.scrollTop,
        el.clientHeight
      ),
      updatedAt: Date.now(),
    });
  }, [conversationId]);

  const syncScrollState = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = getDistanceFromBottomMetrics(
      el.scrollHeight,
      el.scrollTop,
      el.clientHeight
    );
    const nextMode = deriveScrollFollowMode(distance, {
      isStreaming,
      userPaused: userScrolledRef.current,
    });
    const nextAtBottom = nextMode === "locked";
    setIsAtBottom(nextAtBottom);
    setFollowMode(nextMode);
    if (nextAtBottom) {
      setPendingUpdateCount(0);
    }
  }, [isStreaming]);

  const clearProgrammaticReset = useCallback(() => {
    if (programmaticResetRef.current) {
      clearTimeout(programmaticResetRef.current);
      programmaticResetRef.current = null;
    }
  }, []);

  // Scroll to bottom using scrollTo (more reliable than scrollIntoView in flex layouts)
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = containerRef.current;
      if (!el) return;
      clearProgrammaticReset();
      programmaticScrollRef.current = true;
      userScrolledRef.current = false;
      setPendingUpdateCount(0);
      requestAnimationFrame(() => {
        const resolvedBehavior = getResolvedBehavior(behavior);
        el.scrollTo({ top: el.scrollHeight, behavior: resolvedBehavior });
        lastScrollHeightRef.current = el.scrollHeight;
        lastManualScrollTopRef.current = el.scrollTop;
        // Reset flag after animation settles
        programmaticResetRef.current = setTimeout(
          () => {
            programmaticScrollRef.current = false;
            userScrolledRef.current = false;
            syncScrollState();
            persistScrollSnapshot();
          },
          resolvedBehavior === "smooth" ? PROGRAMMATIC_SCROLL_COOLDOWN : 50
        );
      });
    },
    [clearProgrammaticReset, persistScrollSnapshot, syncScrollState]
  );

  const followToBottom = useCallback(
    (nextHeight?: number) => {
      const el = containerRef.current;
      if (!el) return;

      const request: AutoFollowRequest = {
        conversationId: conversationId ?? null,
        contentVersion,
        scrollHeight: nextHeight ?? el.scrollHeight,
        requestedAt: Date.now(),
      };

      if (!shouldDispatchAutoFollow(lastAutoFollowRef.current, request)) {
        return;
      }

      lastAutoFollowRef.current = request;
      scrollToBottom("auto");
    },
    [contentVersion, conversationId, scrollToBottom]
  );

  const restoreSnapshot = useCallback(
    (snapshot: ScrollSnapshot) => {
      const el = containerRef.current;
      if (!el) return false;
      if (contentVersion <= 0 && el.scrollHeight <= el.clientHeight + 8) {
        return false;
      }

      clearProgrammaticReset();
      programmaticScrollRef.current = true;
      const nextTop = restoreScrollTopFromSnapshot(
        el.scrollHeight,
        el.clientHeight,
        snapshot
      );
      el.scrollTo({ top: nextTop, behavior: "auto" });
      lastScrollHeightRef.current = el.scrollHeight;
      lastManualScrollTopRef.current = nextTop;

      const distance = getDistanceFromBottomMetrics(
        el.scrollHeight,
        nextTop,
        el.clientHeight
      );
      const nextMode = deriveScrollFollowMode(distance, {
        isStreaming,
        userPaused: distance > BOTTOM_THRESHOLD,
      });
      userScrolledRef.current = nextMode === "paused";
      setIsAtBottom(nextMode === "locked");
      setFollowMode(nextMode);
      if (nextMode === "locked") {
        setPendingUpdateCount(0);
      }

      programmaticResetRef.current = setTimeout(() => {
        programmaticScrollRef.current = false;
        syncScrollState();
      }, 50);
      return true;
    },
    [clearProgrammaticReset, contentVersion, isStreaming, syncScrollState]
  );

  // Listen to scroll events to detect user scroll
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleScroll = () => {
      if (programmaticScrollRef.current) return;

      const distance = getDistanceFromBottomMetrics(
        el.scrollHeight,
        el.scrollTop,
        el.clientHeight
      );
      const scrollingUp = el.scrollTop < lastManualScrollTopRef.current - 2;
      const scrollingDown = el.scrollTop > lastManualScrollTopRef.current + 2;
      lastManualScrollTopRef.current = el.scrollTop;

      if (distance <= BOTTOM_THRESHOLD) {
        userScrolledRef.current = false;
        setPendingUpdateCount(0);
      } else if (scrollingUp) {
        userScrolledRef.current = true;
      } else if (scrollingDown && distance <= MAGNETIC_FOLLOW_THRESHOLD) {
        userScrolledRef.current = false;
      }

      syncScrollState();
      persistScrollSnapshot();
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [persistScrollSnapshot, syncScrollState]);

  // Bottom sentinel — more reliable than threshold-only detection when streaming causes rapid height changes.
  useEffect(() => {
    const root = containerRef.current;
    const target = bottomRef.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) {
          userScrolledRef.current = false;
          setIsAtBottom(true);
          setFollowMode("locked");
          setPendingUpdateCount(0);
          persistScrollSnapshot();
        } else {
          syncScrollState();
        }
      },
      { root, threshold: 0.98 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [persistScrollSnapshot, syncScrollState]);

  // ResizeObserver — fires when content grows (streaming tokens, images, animated suggestions).
  // Browser-throttled so no debounce needed. Replaces the old MutationObserver which fired
  // on every character during streaming and was fully redundant with resize-based detection.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const newHeight = el.scrollHeight;
      // Only trigger when content grew — shrinks (e.g. suggestion dismissed) need no scroll.
      if (newHeight > lastScrollHeightRef.current + 4) {
        lastScrollHeightRef.current = newHeight;
        const mode = deriveScrollFollowMode(
          getDistanceFromBottomMetrics(
            newHeight,
            el.scrollTop,
            el.clientHeight
          ),
          { isStreaming, userPaused: userScrolledRef.current }
        );
        if (mode === "locked" || mode === "magnetic") {
          followToBottom(newHeight);
        } else {
          setPendingUpdateCount(count =>
            derivePendingUpdateCount(count, { isStreaming })
          );
          syncScrollState();
          persistScrollSnapshot();
        }
      }
    });

    const contentWrapper = el.firstElementChild;
    if (contentWrapper) observer.observe(contentWrapper);

    return () => observer.disconnect();
  }, [followToBottom, isStreaming, persistScrollSnapshot, syncScrollState]);

  useEffect(() => {
    restoredConversationRef.current = null;
    pendingRestoreRef.current = conversationId
      ? readScrollSnapshot(conversationId)
      : null;
    lastAutoFollowRef.current = null;
    setPendingUpdateCount(0);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    if (restoredConversationRef.current === conversationId) return;

    const snapshot = pendingRestoreRef.current;
    if (snapshot && restoreSnapshot(snapshot)) {
      pendingRestoreRef.current = null;
      restoredConversationRef.current = conversationId;
      return;
    }

    if (!snapshot && contentVersion > 0) {
      restoredConversationRef.current = conversationId;
      scrollToBottom("auto");
    }
  }, [
    conversationId,
    contentVersion,
    restoreSnapshot,
    scrollToBottom,
    ...deps,
  ]);

  // Also scroll on explicit dependency changes (taskID switch, streaming state, suggestions)
  useEffect(() => {
    if (pendingRestoreRef.current) return;
    const mode = deriveScrollFollowMode(getDistanceFromBottom(), {
      isStreaming,
      userPaused: userScrolledRef.current,
    });
    if (mode === "locked" || mode === "magnetic") {
      followToBottom();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followToBottom, getDistanceFromBottom, isStreaming, ...deps]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handlePageHide = () => persistScrollSnapshot();
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [persistScrollSnapshot]);

  // Persist scroll position and clean up timers on unmount
  useEffect(() => {
    return () => {
      clearProgrammaticReset();
      persistScrollSnapshot();
    };
  }, [clearProgrammaticReset, persistScrollSnapshot]);

  return {
    containerRef,
    bottomRef,
    isAtBottom,
    pendingUpdateCount,
    followMode,
    scrollToBottom,
  };
}
