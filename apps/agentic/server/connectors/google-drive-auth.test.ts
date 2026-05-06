import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  getDb: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: {
    authenticateRequest: mocks.authenticateRequest,
  },
}));

vi.mock("../db", () => ({
  getDb: mocks.getDb,
}));

type MockResponse = {
  statusCode: number | null;
  body: unknown;
  redirectTarget: string | null;
  headers: Map<string, unknown>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  redirect: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  getHeader: ReturnType<typeof vi.fn>;
  removeHeader: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
};

function createMockResponse(): MockResponse {
  const headers = new Map<string, unknown>();
  const response: MockResponse = {
    statusCode: null,
    body: null,
    redirectTarget: null,
    headers,
    status: vi.fn(),
    json: vi.fn(),
    redirect: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
    append: vi.fn(),
  };

  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });
  response.redirect.mockImplementation(
    (...args: [number, string] | [string]) => {
      if (typeof args[0] === "number") {
        response.statusCode = args[0];
        response.redirectTarget = args[1];
        return response;
      }

      response.redirectTarget = args[0];
      return response;
    }
  );
  response.setHeader.mockImplementation((name: string, value: unknown) => {
    headers.set(name.toLowerCase(), value);
    return response;
  });
  response.getHeader.mockImplementation((name: string) =>
    headers.get(name.toLowerCase())
  );
  response.removeHeader.mockImplementation((name: string) => {
    headers.delete(name.toLowerCase());
  });
  response.append.mockImplementation((name: string, value: unknown) => {
    headers.set(name.toLowerCase(), value);
    return response;
  });

  return response;
}

async function runMiddleware(
  handler: (req: any, res: any, next: (error?: unknown) => void) => unknown,
  req: Record<string, unknown>,
  res: MockResponse
) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      callback();
    };

    Promise.resolve(
      handler(req, res, error => {
        finish(() => {
          if (error) {
            reject(error as Error);
            return;
          }
          resolve();
        });
      })
    ).then(
      () => finish(resolve),
      error => finish(() => reject(error))
    );
  });
}

async function getRouteLayer(path: string) {
  const routerModule = await import("./google-drive-auth");
  const router = routerModule.default as any;
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.get
  );

  if (!layer) {
    throw new Error(`Route ${path} not found`);
  }

  return layer;
}

function getRouteHandler(path: string) {
  return async () => {
    const layer = await getRouteLayer(path);
    return layer.route.stack.at(-1)?.handle as (
      req: Record<string, unknown>,
      res: MockResponse
    ) => Promise<void>;
  };
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    orgId: "default",
    role: "manager",
    valueStreams: "pharmacy,optical",
    ...overrides,
  };
}

async function encodeState(payload: Record<string, unknown>) {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || "dev-jwt-secret-change-me"
  );

  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);
}

describe("google drive auth route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDb.mockResolvedValue(null);
  });

  it("applies rate limiting middleware to the OAuth routes", async () => {
    const authLayer = await getRouteLayer("/auth");
    const callbackLayer = await getRouteLayer("/callback");
    const callbackCompleteLayer = await getRouteLayer("/callback/complete");
    const statusLayer = await getRouteLayer("/status");

    expect(authLayer.route.stack.length).toBeGreaterThan(1);
    expect(callbackLayer.route.stack.length).toBeGreaterThan(1);
    expect(callbackCompleteLayer.route.stack.length).toBeGreaterThan(1);
    expect(statusLayer.route.stack.length).toBeGreaterThan(1);
  });

  it("blocks repeated OAuth initiation requests once the limit is exceeded", async () => {
    const authLayer = await getRouteLayer("/auth");
    const limiter = authLayer.route.stack[0]?.handle as (
      req: Record<string, unknown>,
      res: MockResponse,
      next: (error?: unknown) => void
    ) => unknown;

    for (let attempt = 0; attempt < 10; attempt++) {
      await runMiddleware(
        limiter,
        {
          ip: "127.0.0.1",
          method: "GET",
          url: "/api/connectors/google-drive/auth",
          originalUrl: "/api/connectors/google-drive/auth",
          headers: {},
          socket: { remoteAddress: "127.0.0.1" },
        },
        createMockResponse()
      );
    }

    const blockedResponse = createMockResponse();
    await runMiddleware(
      limiter,
      {
        ip: "127.0.0.1",
        method: "GET",
        url: "/api/connectors/google-drive/auth",
        originalUrl: "/api/connectors/google-drive/auth",
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      },
      blockedResponse
    );

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body).toEqual({
      error:
        "Too many Google Drive authorization requests. Please try again in a few minutes.",
    });
  });

  it("returns 400 when auth starts without an explicit stream", async () => {
    mocks.authenticateRequest.mockResolvedValue(makeUser());
    const handler = await getRouteHandler("/auth")();
    const response = createMockResponse();

    await handler(
      {
        query: {
          name: "Drive Connector",
          syncInterval: "30",
        },
      },
      response
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      error: "Select a value stream before connecting Google Drive",
    });
  });

  it("bridges callback query parameters through a one-time handoff id", async () => {
    const handler = await getRouteHandler("/callback")();
    const response = createMockResponse();
    const state = await encodeState({
      userId: 1,
      orgId: "default",
      connectorName: "Drive Connector",
      syncInterval: 30,
      streamId: "pharmacy",
    });

    await handler(
      {
        headers: {},
        query: {
          code: "oauth-code",
          state,
        },
      },
      response
    );

    expect(response.statusCode).toBe(303);
    const redirectUrl = new URL(
      response.redirectTarget || "",
      "https://example.test"
    );
    expect(redirectUrl.pathname).toBe(
      "/api/connectors/google-drive/callback/complete"
    );
    expect(redirectUrl.searchParams.get("handoff")).toBeTruthy();
  });

  it("redirects callback completion requests with missing stream ownership", async () => {
    const bridgeHandler = await getRouteHandler("/callback")();
    const completeHandler = await getRouteHandler("/callback/complete")();
    const bridgeResponse = createMockResponse();
    const state = await encodeState({
      userId: 1,
      orgId: "default",
      connectorName: "Drive Connector",
      syncInterval: 30,
    });

    await bridgeHandler(
      {
        headers: {},
        query: {
          code: "oauth-code",
          state,
        },
      },
      bridgeResponse
    );

    const redirectUrl = new URL(
      bridgeResponse.redirectTarget || "",
      "https://example.test"
    );
    const handoffId = redirectUrl.searchParams.get("handoff");
    expect(handoffId).toBeTruthy();

    const completeResponse = createMockResponse();
    await completeHandler(
      {
        query: {
          handoff: handoffId,
        },
      },
      completeResponse
    );

    expect(completeResponse.redirectTarget).toBe(
      "/knowledge?error=missing_stream"
    );
  });
});
