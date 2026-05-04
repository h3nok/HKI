import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "http";
import type { AddressInfo } from "net";
import WebSocket from "ws";

import { COOKIE_NAME } from "@shared/const";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  getUserByOpenId: vi.fn(),
  verifySession: vi.fn(),
}));

vi.mock("./db", () => ({
  getDb: mocks.getDb,
  getUserByOpenId: mocks.getUserByOpenId,
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    verifySession: mocks.verifySession,
  },
}));

vi.mock("./_core/env", () => ({
  ENV: {
    devBypassEnabled: false,
  },
}));

vi.mock("ioredis", () => {
  const Redis = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(1),
    on: vi.fn(),
    disconnect: vi.fn(),
    quit: vi.fn(),
  }));
  return { default: Redis };
});

type ConversationRecord = {
  userId: number;
  scope: string;
};

function makeDbMock(record: ConversationRecord | null) {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn().mockResolvedValue(record ? [record] : []),
  };
  return chain;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.listen(0, "127.0.0.1", err => {
      if (err) reject(err);
      else resolve();
    });
  });

  return (server.address() as AddressInfo).port;
}

async function closeServer(server: Server, sockets: WebSocket[]) {
  await Promise.all(
    sockets.map(
      socket =>
        new Promise<void>(resolve => {
          if (
            socket.readyState === WebSocket.CLOSED ||
            socket.readyState === WebSocket.CLOSING
          ) {
            resolve();
            return;
          }
          socket.once("close", () => resolve());
          socket.close();
        })
    )
  );

  await new Promise<void>(resolve => server.close(() => resolve()));
}

describe("integration: websocket value-stream isolation", () => {
  const sockets: WebSocket[] = [];
  let server: Server | null = null;
  let restoreSetInterval: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreSetInterval = vi
      .spyOn(global, "setInterval")
      .mockReturnValue({} as ReturnType<typeof setInterval>);
    mocks.verifySession.mockResolvedValue({
      openId: "ws-open-id",
      appId: "app-id",
      name: "Scoped User",
    });
    mocks.getUserByOpenId.mockResolvedValue({
      id: 7201,
      role: "manager",
      valueStreams: "fraud",
    });
  });

  afterEach(async () => {
    if (server) {
      await closeServer(server, sockets.splice(0, sockets.length));
      server = null;
    }
    restoreSetInterval?.mockRestore();
    restoreSetInterval = null;
  });

  it("accepts a trace connection when the conversation stays inside the user's stream", async () => {
    mocks.getDb.mockResolvedValue(makeDbMock({ userId: 7201, scope: "fraud" }));

    const { setupWebSocket } = await import("./websocket");
    server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    setupWebSocket(server);
    const port = await listen(server);

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?conversationId=conv-fraud`,
      {
        headers: {
          Cookie: `${COOKIE_NAME}=valid-session-token`,
        },
      }
    );
    sockets.push(ws);

    const payload = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for websocket connection"));
      }, 3000);

      ws.once("message", data => {
        clearTimeout(timer);
        resolve(data.toString());
      });
      ws.once("error", err => {
        clearTimeout(timer);
        reject(err);
      });
    });

    expect(JSON.parse(payload)).toEqual({
      type: "connected",
      conversationId: "conv-fraud",
    });
  });

  it("rejects a trace connection when the conversation belongs to an inaccessible stream", async () => {
    mocks.getDb.mockResolvedValue(
      makeDbMock({ userId: 7201, scope: "innovation" })
    );

    const { setupWebSocket } = await import("./websocket");
    server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    setupWebSocket(server);
    const port = await listen(server);

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?conversationId=conv-innovation`,
      {
        headers: {
          Cookie: `${COOKIE_NAME}=valid-session-token`,
        },
      }
    );
    sockets.push(ws);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for websocket rejection"));
      }, 3000);

      ws.once("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        try {
          expect(res.statusCode).toBe(403);
          res.resume();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ws.once("open", () => {
        clearTimeout(timer);
        reject(new Error("WebSocket connection unexpectedly succeeded"));
      });

      ws.on("error", () => {
        // The ws client also emits an error after the unexpected response; the
        // assertion is handled above so this can be ignored.
      });
    });
  });

  it("rejects a trace connection when the conversation falls back to global for a scoped user", async () => {
    mocks.getDb.mockResolvedValue(
      makeDbMock({ userId: 7201, scope: "global" })
    );

    const { setupWebSocket } = await import("./websocket");
    server = createServer((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    setupWebSocket(server);
    const port = await listen(server);

    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/ws?conversationId=conv-global`,
      {
        headers: {
          Cookie: `${COOKIE_NAME}=valid-session-token`,
        },
      }
    );
    sockets.push(ws);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for websocket rejection"));
      }, 3000);

      ws.once("unexpected-response", (_req, res) => {
        clearTimeout(timer);
        try {
          expect(res.statusCode).toBe(403);
          res.resume();
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      ws.once("open", () => {
        clearTimeout(timer);
        reject(new Error("WebSocket connection unexpectedly succeeded"));
      });

      ws.on("error", () => {
        // The ws client also emits an error after the unexpected response; the
        // assertion is handled above so this can be ignored.
      });
    });
  });
});
