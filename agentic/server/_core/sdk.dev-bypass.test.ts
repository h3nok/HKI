import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";
import { COOKIE_NAME } from "@shared/const";

const dbMocks = vi.hoisted(() => ({
  getUserByOpenId: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("../db", () => dbMocks);

vi.mock("./env", () => ({
  ENV: {
    appId: "agentic",
    cookieSecret: "test-session-secret-min-32-characters",
    devBypassEnabled: true,
    oAuthServerUrl: "",
  },
}));

vi.mock("./logger", () => ({
  createLogger: vi.fn(() => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  })),
}));

function makeRequest(cookie?: string): Request {
  return {
    headers: cookie ? { cookie } : {},
  } as Request;
}

function makeDevUser() {
  return {
    id: 1,
    openId: "dev-user-123",
    name: "Henok Ghebrechristos",
    email: "hghebrechristos@hki.com",
    loginMethod: "dev-bypass",
    pngId: "PNG12345",
    role: "admin",
    department: "Innovation Lab",
    orgId: "hki",
    valueStreams: null,
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
}

describe("sdk dev bypass authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not authenticate dev bypass requests without a session cookie", async () => {
    const { sdk } = await import("./sdk");

    await expect(sdk.authenticateRequest(makeRequest())).rejects.toThrow(
      "Invalid session cookie"
    );
  });

  it("authenticates dev bypass requests with a valid session cookie", async () => {
    const { sdk } = await import("./sdk");
    const devUser = makeDevUser();
    dbMocks.getUserByOpenId.mockResolvedValue(devUser);

    const token = await sdk.createSessionToken(devUser.openId, {
      name: devUser.name,
      expiresInMs: 60_000,
    });

    await expect(
      sdk.authenticateRequest(makeRequest(`${COOKIE_NAME}=${token}`))
    ).resolves.toMatchObject({
      openId: devUser.openId,
      email: devUser.email,
      role: devUser.role,
    });
  });
});
