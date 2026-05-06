import { describe, expect, it } from "vitest";

import {
  ensureConnectorAccess,
  isConnectorVisibleToUser,
  normalizeConnectorConfigStream,
  requireConnectorSelectionStreamId,
  requirePersistedConnectorStreamId,
  resolvePersistedConnectorStreamId,
} from "./stream-access";

describe("connector stream access", () => {
  it("defaults scoped connector configs to the caller's assigned stream", () => {
    const normalized = normalizeConnectorConfigStream(
      {
        user: {
          role: "manager",
          valueStreams: "pharmacy,optical",
        },
      },
      {
        folderId: "drive-folder",
      }
    );

    expect(normalized.streamId).toBe("pharmacy");
  });

  it("blocks access to connectors outside the caller's assigned stream", () => {
    expect(() =>
      ensureConnectorAccess(
        {
          user: {
            role: "manager",
            valueStreams: "pharmacy",
          },
        },
        { streamId: "optical" }
      )
    ).toThrow('You do not have access to value stream "optical"');
  });

  it("hides unscoped connectors from non-global managers", () => {
    expect(
      isConnectorVisibleToUser(
        {
          user: {
            role: "manager",
            valueStreams: "pharmacy",
          },
        },
        {}
      )
    ).toBe(false);
  });

  it("allows global admins to access unscoped connectors", () => {
    expect(
      isConnectorVisibleToUser(
        {
          user: {
            role: "admin",
            valueStreams: "pharmacy",
          },
        },
        {}
      )
    ).toBe(true);
  });

  it("requires an explicit non-global stream when selecting a connector scope", () => {
    expect(() =>
      requireConnectorSelectionStreamId(
        {
          user: {
            role: "manager",
            valueStreams: "pharmacy,optical",
          },
        },
        undefined,
        "Select a value stream before connecting Google Drive"
      )
    ).toThrow(/Select a value stream before connecting Google Drive/);

    expect(() =>
      requireConnectorSelectionStreamId(
        {
          user: {
            role: "admin",
            valueStreams: "global",
          },
        },
        "global"
      )
    ).toThrow(/global knowledge scope/);
  });

  it("resolves persisted connector stream ownership from the row or config", () => {
    expect(
      resolvePersistedConnectorStreamId({
        streamId: "pharmacy",
        config: { streamId: "optical" },
      })
    ).toBe("pharmacy");

    expect(
      resolvePersistedConnectorStreamId({
        config: { streamId: "optical" },
      })
    ).toBe("optical");
  });

  it("rejects persisted connectors that are unscoped or global", () => {
    expect(() => requirePersistedConnectorStreamId({ streamId: null })).toThrow(
      /missing a non-global value stream assignment/
    );

    expect(() =>
      requirePersistedConnectorStreamId({
        streamId: "global",
      })
    ).toThrow(/missing a non-global value stream assignment/);
  });
});
