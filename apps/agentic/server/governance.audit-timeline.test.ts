import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TrpcContext } from "./_core/context";
import type { User } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({
  serviceJson: vi.fn(),
}));

vi.mock("./service-client", () => ({
  serviceJson: mocks.serviceJson,
  ANALYTICS_URL: "http://analytics.test",
}));

vi.mock("./db", () => ({
  getDb: vi.fn(),
}));

import { governanceRouter } from "./governance";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "audit-user",
    name: "Audit Admin",
    email: "audit@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "admin",
    department: null,
    orgId: "default",
    valueStreams: "pharmacy,optical",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

function makeCtx(user: User = makeUser()): TrpcContext {
  return {
    user,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { host: "localhost" },
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
      cookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("governance.auditTimeline", () => {
  beforeEach(() => {
    mocks.serviceJson.mockReset();
  });

  it("proxies a named-domain audit timeline using a narrowed service token", async () => {
    mocks.serviceJson.mockResolvedValue({
      total: 1,
      events: [
        {
          event_type: "agent.chat",
          user_id: "7",
          org_id: "default",
          service: "orchestrator-service",
          scope: "pharmacy",
          timestamp: 1778889600,
          ingested_at: 1778889601,
          payload: {
            schema: "hki.audit.event.v1",
            event_id: "evt-chat-1",
            occurred_at: "2026-05-16T00:00:00.000Z",
            source: { service: "orchestrator-service" },
            actor: { subject_id: "7" },
            boundary: { active_domain: "pharmacy", org_id: "default" },
            operation: {
              type: "agent.chat",
              name: "orchestrator.chat",
              target_domain: "pharmacy",
            },
            decision: { outcome: "allow", reason: "chat.completed" },
            evidence: {
              message_hash: "sha256:abc",
              redaction_profile: "metadata-only",
            },
          },
        },
      ],
    });

    const caller = governanceRouter.createCaller(makeCtx());
    const result = await caller.auditTimeline({ scope: "pharmacy" });

    expect(mocks.serviceJson).toHaveBeenCalledWith(
      expect.stringContaining(
        "http://analytics.test/v1/events/recent?limit=50&org_id=default&stream_id=pharmacy"
      ),
      expect.objectContaining({ scopes: ["pharmacy"], isGlobalScope: false })
    );
    expect(result.unavailable).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      id: "evt-chat-1",
      eventType: "agent.chat",
      service: "orchestrator-service",
      scope: "pharmacy",
      decision: "allow",
      operationName: "orchestrator.chat",
      targetDomain: "pharmacy",
      payloadHash: "sha256:abc",
      metadataOnly: true,
    });
    expect(result.summary.byDecision).toEqual({ allow: 1 });
  });

  it("rejects global audit timeline requests", async () => {
    const caller = governanceRouter.createCaller(makeCtx());

    await expect(
      caller.auditTimeline({ scope: "global" })
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.serviceJson).not.toHaveBeenCalled();
  });
});
