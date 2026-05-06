import { describe, expect, it } from "vitest";

import {
  buildScrollStorageKey,
  derivePendingUpdateCount,
  deriveScrollFollowMode,
  restoreScrollTopFromSnapshot,
  shouldDispatchAutoFollow,
} from "../client/src/components/chat-ui/hooks/use-auto-scroll";

describe("chat scroll behavior helpers", () => {
  it("locks when the viewport is already near the bottom", () => {
    expect(
      deriveScrollFollowMode(40, { isStreaming: true, userPaused: false })
    ).toBe("locked");
  });

  it("enters magnetic follow when streaming near the live edge", () => {
    expect(
      deriveScrollFollowMode(180, { isStreaming: true, userPaused: false })
    ).toBe("magnetic");
  });

  it("stays paused when the user intentionally scrolled away", () => {
    expect(
      deriveScrollFollowMode(180, { isStreaming: true, userPaused: true })
    ).toBe("paused");
    expect(
      deriveScrollFollowMode(320, { isStreaming: true, userPaused: false })
    ).toBe("paused");
  });

  it("restores a saved distance from the bottom", () => {
    expect(
      restoreScrollTopFromSnapshot(2400, 800, {
        top: 0,
        distanceFromBottom: 300,
      })
    ).toBe(1300);
  });

  it("builds a stable storage key per conversation", () => {
    expect(buildScrollStorageKey("task-123")).toBe(
      "agentic-chat-scroll:task-123"
    );
  });

  it("dedupes automatic follow requests for the same content burst", () => {
    const previous = {
      conversationId: "task-123",
      contentVersion: 9,
      scrollHeight: 2800,
      requestedAt: 1000,
    };

    expect(
      shouldDispatchAutoFollow(previous, {
        conversationId: "task-123",
        contentVersion: 9,
        scrollHeight: 2802,
        requestedAt: 1060,
      })
    ).toBe(false);

    expect(
      shouldDispatchAutoFollow(previous, {
        conversationId: "task-123",
        contentVersion: 10,
        scrollHeight: 2802,
        requestedAt: 1060,
      })
    ).toBe(true);

    expect(
      shouldDispatchAutoFollow(previous, {
        conversationId: "task-123",
        contentVersion: 9,
        scrollHeight: 2860,
        requestedAt: 1060,
      })
    ).toBe(true);
  });

  it("collapses streaming pending updates into a single unseen change", () => {
    expect(derivePendingUpdateCount(0, { isStreaming: true })).toBe(1);
    expect(derivePendingUpdateCount(1, { isStreaming: true })).toBe(1);
    expect(derivePendingUpdateCount(1, { isStreaming: false })).toBe(2);
  });
});
