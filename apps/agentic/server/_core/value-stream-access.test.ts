import { describe, expect, it } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  ensureManagerHasStreamAccess,
  requireAuthorizedStreamId,
  resolveAuthorizedStreamId,
} from "./value-stream-access";
import {
  canAccessChatScope,
  resolveRequestedChatScope,
} from "./chat-scope-auth";

describe("value stream authorization helpers", () => {
  it("allows managers to resolve an assigned stream", () => {
    const resolved = resolveAuthorizedStreamId(
      {
        user: { role: "manager", valueStreams: "fraud,innovation" },
      },
      "fraud"
    );

    expect(resolved).toBe("fraud");
  });

  it("rejects managers who request an unassigned stream", () => {
    expect(() =>
      resolveAuthorizedStreamId(
        {
          user: { role: "manager", valueStreams: "fraud,innovation" },
        },
        "legal"
      )
    ).toThrow(TRPCError);
  });

  it("rejects managers who request global without global access", () => {
    expect(() =>
      resolveAuthorizedStreamId(
        {
          user: { role: "manager", valueStreams: "fraud,innovation" },
        },
        "global"
      )
    ).toThrow(/global knowledge scope/);
  });

  it("rejects explicit global selection when the caller disables it", () => {
    expect(() =>
      requireAuthorizedStreamId(
        {
          user: { role: "admin", valueStreams: null },
        },
        "global",
        { allowGlobalSelection: false }
      )
    ).toThrow(/global knowledge scope/);
  });

  it("rejects explicit global selection by default", () => {
    expect(() =>
      resolveAuthorizedStreamId(
        {
          user: { role: "admin", valueStreams: null },
        },
        "global"
      )
    ).toThrow(/global knowledge scope/);
  });

  it("allows explicit global selection only when requested by an admin plane caller", () => {
    const resolved = resolveAuthorizedStreamId(
      {
        user: { role: "admin", valueStreams: null },
      },
      "global",
      { allowGlobalSelection: true }
    );

    expect(resolved).toBe("global");
  });

  it("defaults to the first assigned stream when requested", () => {
    const resolved = resolveAuthorizedStreamId(
      {
        user: { role: "manager", valueStreams: "fraud,innovation" },
      },
      undefined,
      { defaultToFirstScoped: true }
    );

    expect(resolved).toBe("fraud");
  });

  it("fails closed under hermetic isolation when a stream is omitted", () => {
    const previous = process.env.KB_HERMETIC_ISOLATION;
    process.env.KB_HERMETIC_ISOLATION = "true";

    try {
      expect(() =>
        requireAuthorizedStreamId(
          {
            user: { role: "manager", valueStreams: "fraud,innovation" },
          },
          undefined,
          { defaultToFirstScoped: true }
        )
      ).toThrow(/Select a value stream explicitly/);
    } finally {
      if (previous === undefined) {
        delete process.env.KB_HERMETIC_ISOLATION;
      } else {
        process.env.KB_HERMETIC_ISOLATION = previous;
      }
    }
  });

  it("lets admins access any explicit stream", () => {
    const resolved = resolveAuthorizedStreamId(
      {
        user: { role: "admin", valueStreams: null },
      },
      "legal"
    );

    expect(resolved).toBe("legal");
  });

  it("blocks manager access checks for unassigned streams", () => {
    expect(() =>
      ensureManagerHasStreamAccess(
        {
          user: { role: "manager", valueStreams: "fraud" },
        },
        "innovation"
      )
    ).toThrow(/assigned value streams/);
  });
});

describe("chat scope authorization helpers", () => {
  it("fails closed when chat scope selection is omitted", () => {
    expect(() => resolveRequestedChatScope(undefined, ["fraud"])).toThrow(
      /Select a value stream before starting a chat/
    );
  });

  it("fails closed for explicit unauthorized chat streams", () => {
    expect(() =>
      resolveRequestedChatScope("legal", ["fraud", "innovation"])
    ).toThrow(/chat stream "legal"/);
  });

  it("recognizes access to assigned chat scopes", () => {
    expect(canAccessChatScope("fraud", ["fraud"])).toBe(true);
    expect(canAccessChatScope("innovation", ["fraud"])).toBe(false);
    expect(canAccessChatScope("global", ["fraud"])).toBe(false);
    expect(canAccessChatScope(undefined, ["fraud"])).toBe(false);
  });
});
