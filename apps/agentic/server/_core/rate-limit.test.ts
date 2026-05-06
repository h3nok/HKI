import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { createRouteRateLimiter } from "./rate-limit";

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
  handler: ReturnType<typeof createRouteRateLimiter>,
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

function createRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    ip: "127.0.0.1",
    method: "GET",
    url: "/test",
    originalUrl: "/test",
    headers: {},
    socket: { remoteAddress: "127.0.0.1" } as Request["socket"],
    ...overrides,
  };
}

describe("createRouteRateLimiter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 after the configured request limit is exceeded", async () => {
    const limiter = createRouteRateLimiter({
      identifier: "test-rate-limit",
      windowMs: 60_000,
      limit: 2,
      message: "Too many requests.",
    });

    await runMiddleware(limiter, createRequest(), createMockResponse());
    await runMiddleware(limiter, createRequest(), createMockResponse());

    const blockedResponse = createMockResponse();
    await runMiddleware(limiter, createRequest(), blockedResponse);

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body).toEqual({ error: "Too many requests." });
  });

  it("uses the custom key builder when one is provided", async () => {
    const limiter = createRouteRateLimiter({
      identifier: "test-custom-rate-limit",
      windowMs: 60_000,
      limit: 1,
      message: "Too many requests.",
      keyBuilder: request => {
        const rawHeader = request.headers["x-goog-authenticated-user-email"];
        const email = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
        return email ? `iap:${email}` : undefined;
      },
    });

    await runMiddleware(
      limiter,
      createRequest({
        headers: { "x-goog-authenticated-user-email": "user-a@hki.com" },
      }),
      createMockResponse()
    );

    await runMiddleware(
      limiter,
      createRequest({
        headers: { "x-goog-authenticated-user-email": "user-b@hki.com" },
      }),
      createMockResponse()
    );

    const blockedResponse = createMockResponse();
    await runMiddleware(
      limiter,
      createRequest({
        headers: { "x-goog-authenticated-user-email": "user-a@hki.com" },
      }),
      blockedResponse
    );

    expect(blockedResponse.statusCode).toBe(429);
    expect(blockedResponse.body).toEqual({ error: "Too many requests." });
  });
});
