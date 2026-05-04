import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../db", () => ({
  getDb: vi.fn(),
  getPreferredUserByEmail: vi.fn(),
}));

vi.mock("../_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn(),
    authenticateRequest: vi.fn(),
  },
}));

type MockResponse = {
  statusCode: number | null;
  body: unknown;
  headers: Map<string, unknown>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
  getHeader: ReturnType<typeof vi.fn>;
  removeHeader: ReturnType<typeof vi.fn>;
  append: ReturnType<typeof vi.fn>;
};

function createMockResponse(): Response & MockResponse {
  const headers = new Map<string, unknown>();
  const response = {
    statusCode: null,
    body: null,
    headers,
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
    getHeader: vi.fn(),
    removeHeader: vi.fn(),
    append: vi.fn(),
  } as unknown as Response & MockResponse;

  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  response.json.mockImplementation((body: unknown) => {
    response.body = body;
    return response;
  });
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
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
  request: Partial<Request>,
  response: Response & MockResponse
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

    const next: NextFunction = error => {
      finish(() => {
        if (error) {
          reject(error as Error);
          return;
        }
        resolve();
      });
    };

    Promise.resolve(
      handler(request as Request, response as Response, next)
    ).then(
      () => finish(resolve),
      error => finish(() => reject(error))
    );
  });
}

async function getRouteLayer(path: string, method: "get" | "post") {
  const routerModule = await import("./google-routes");
  const router = routerModule.default as any;
  const layer = router.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  return layer;
}

function createRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    ip: "127.0.0.1",
    method: "GET",
    url: "/api/auth/google/login",
    originalUrl: "/api/auth/google/login",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" } as Request["socket"],
    ...overrides,
  };
}

describe("google auth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies rate limiting middleware to the flagged auth routes", async () => {
    const loginLayer = await getRouteLayer("/google/login", "get");
    const callbackLayer = await getRouteLayer("/google/callback", "get");
    const logoutLayer = await getRouteLayer("/logout", "post");
    const meLayer = await getRouteLayer("/me", "get");

    expect(loginLayer.route.stack.length).toBeGreaterThan(1);
    expect(callbackLayer.route.stack.length).toBeGreaterThan(1);
    expect(logoutLayer.route.stack.length).toBeGreaterThan(1);
    expect(meLayer.route.stack.length).toBeGreaterThan(1);
  });

  it("blocks repeated login attempts once the limit is exceeded", async () => {
    const loginLayer = await getRouteLayer("/google/login", "get");
    const limiter = loginLayer.route.stack[0]?.handle as (
      req: Request,
      res: Response,
      next: NextFunction
    ) => unknown;

    for (let attempt = 0; attempt < 10; attempt++) {
      await runMiddleware(limiter, createRequest(), createMockResponse());
    }

    const blockedResponse = createMockResponse();
    await runMiddleware(limiter, createRequest(), blockedResponse);

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body).toEqual({
      error:
        "Too many authentication requests. Please try again in a few minutes.",
    });
  });
});
