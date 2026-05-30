import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signRequestJwtWithEnvelope: vi.fn(),
}));

vi.mock("./auth/sign-request-jwt", () => ({
  signRequestJwtWithEnvelope: mocks.signRequestJwtWithEnvelope,
}));

import { serviceJson } from "./service-client";

const ctx = {
  user: {
    id: 1,
    name: "Service Client Test",
    role: "admin",
    orgId: "hki",
  },
  scopes: ["pharmacy"],
};

async function expectServiceJsonError() {
  try {
    await serviceJson("http://knowledge-api.test/v1/stats", ctx);
  } catch (error) {
    return error as { code: string; message: string };
  }

  throw new Error("Expected serviceJson to reject");
}

describe("serviceJson", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mocks.signRequestJwtWithEnvelope.mockResolvedValue({
      token: "signed-request-token",
      envelope: {},
      hkiEnvelope: undefined,
    });
    fetchMock = vi.fn();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps downstream service-auth 401s to internal service failures", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          detail: "Invalid request token: Signature verification failed",
        }),
        { status: 401, statusText: "Unauthorized" }
      )
    );

    const error = await expectServiceJsonError();

    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("Downstream service authentication failed");
    expect(error.message).not.toContain("Signature verification failed");
    expect(warnSpy).toHaveBeenCalledWith(
      "[ServiceClient] Downstream service request failed",
      expect.objectContaining({
        status: 401,
        url: "http://knowledge-api.test/v1/stats",
        detail: expect.stringContaining("Signature verification failed"),
      })
    );
  });

  it("preserves not-found semantics without returning raw service details", async () => {
    fetchMock.mockResolvedValue(
      new Response("document abc123 was not found", {
        status: 404,
        statusText: "Not Found",
      })
    );

    const error = await expectServiceJsonError();

    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Downstream service resource not found");
    expect(error.message).not.toContain("abc123");
  });

  it("sanitizes service transport failures", async () => {
    fetchMock.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED with noisy details"), {
        cause: { code: "ECONNREFUSED" },
      })
    );

    const error = await expectServiceJsonError();

    expect(error.code).toBe("INTERNAL_SERVER_ERROR");
    expect(error.message).toBe("Downstream service is unreachable");
    expect(error.message).not.toContain("ECONNREFUSED");
  });
});
