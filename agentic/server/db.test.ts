import { beforeEach, describe, expect, it, vi } from "vitest";

const createPoolMock = vi.hoisted(() => vi.fn());
const drizzleMock = vi.hoisted(() => vi.fn());
const runPendingMigrationsMock = vi.hoisted(() => vi.fn());
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("mysql2", () => ({
  createPool: createPoolMock,
}));

vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: drizzleMock,
}));

vi.mock("./_core/env", () => ({
  ENV: {
    databaseUrl: "mysql://root:root@127.0.0.1:9306/test_db",
    dbAutoMigrate: true,
  },
}));

vi.mock("./_core/logger", () => ({
  createLogger: vi.fn(() => loggerMock),
}));

vi.mock("./_core/migration-runner", () => ({
  runPendingMigrations: runPendingMigrationsMock,
}));

describe("db", () => {
  beforeEach(() => {
    vi.resetModules();
    createPoolMock.mockReset();
    drizzleMock.mockReset();
    runPendingMigrationsMock.mockReset();
    loggerMock.info.mockReset();
    loggerMock.warn.mockReset();
    loggerMock.error.mockReset();
  });

  it("retries auto-migrations after a failed initialization attempt", async () => {
    const failedPool = {
      on: vi.fn(),
      end: vi.fn(async () => undefined),
    };
    const healthyPool = {
      on: vi.fn(),
      end: vi.fn(async () => undefined),
    };
    const healthyDb = { ok: true };

    createPoolMock
      .mockReturnValueOnce(failedPool)
      .mockReturnValueOnce(healthyPool);
    drizzleMock
      .mockReturnValueOnce({ failed: true })
      .mockReturnValueOnce(healthyDb);
    runPendingMigrationsMock
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        applied: [],
        skipped: [],
        drifted: [],
      });

    const { getDb } = await import("./db");

    await expect(getDb()).resolves.toBeNull();
    await expect(getDb()).resolves.toBe(healthyDb);

    expect(runPendingMigrationsMock).toHaveBeenCalledTimes(2);
    expect(failedPool.end).toHaveBeenCalledTimes(1);
    expect(healthyPool.on).toHaveBeenCalledWith(
      "connection",
      expect.any(Function)
    );
  });

  it("logs migration drift as an initialization problem instead of a raw connection failure", async () => {
    const pool = {
      on: vi.fn(),
      end: vi.fn(async () => undefined),
    };

    createPoolMock.mockReturnValue(pool);
    drizzleMock.mockReturnValue({ ok: true });
    runPendingMigrationsMock.mockRejectedValueOnce(
      new Error(
        "Migration drift detected for 1 tracked file(s): 0001_agent_release_readiness.sql"
      )
    );

    const { getDb } = await import("./db");

    await expect(getDb()).resolves.toBeNull();

    expect(loggerMock.warn).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
      },
      "Database initialization blocked by migration drift; run `make db-migrate-status` before starting the app"
    );
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
