import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const createConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("mysql2/promise", () => ({
  createConnection: createConnectionMock,
}));

import {
  buildMigrationPlan,
  runPendingMigrations,
  type AppliedMigrationRecord,
  type MigrationLogger,
} from "./migration-runner";

const testLogger: MigrationLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

interface MockQueryResponse {
  rows?: unknown;
  error?: {
    code: string;
    sqlMessage?: string;
    message?: string;
  };
}

interface MockConnection {
  query: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

function createTempMigrationsDir(files: Record<string, string>): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentic-migrations-"));
  for (const [fileName, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(tempDir, fileName), contents, "utf-8");
  }
  return tempDir;
}

function createMockConnection(
  responses: MockQueryResponse[],
  executedStatements: string[]
): MockConnection {
  return {
    query: vi.fn(async (sql: string) => {
      executedStatements.push(sql);
      const response = responses.shift();
      if (!response) {
        throw new Error(`Unexpected query: ${sql}`);
      }
      if (response.error) {
        const error = new Error(
          response.error.sqlMessage ??
            response.error.message ??
            response.error.code
        ) as Error & {
          code?: string;
          sqlMessage?: string;
        };
        error.code = response.error.code;
        error.sqlMessage = response.error.sqlMessage;
        throw error;
      }
      return [response.rows ?? [], undefined] as const;
    }),
    end: vi.fn(async () => undefined),
  };
}

describe("migration-runner", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.clearAllMocks();
    createConnectionMock.mockReset();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds a migration plan with baseline first and sorted migration files", () => {
    const migrationsDir = createTempMigrationsDir({
      "0010_zeta.sql": "SELECT 10;",
      "0002_beta.sql": "SELECT 2;",
      "init-tables.sql": "CREATE TABLE test (id INT);",
    });
    tempDirs.push(migrationsDir);

    const plan = buildMigrationPlan(migrationsDir);

    expect(plan.map(item => item.fileName)).toEqual([
      "init-tables.sql",
      "0002_beta.sql",
      "0010_zeta.sql",
    ]);
    expect(plan[0]?.kind).toBe("baseline");
    expect(plan[1]?.kind).toBe("migration");
  });

  it("normalizes legacy SQL and records applied migrations", async () => {
    const migrationsDir = createTempMigrationsDir({
      "init-tables.sql":
        "CREATE TABLE test (id INT PRIMARY KEY);--> statement-breakpoint",
      "0001_add_index.sql":
        "CREATE INDEX IF NOT EXISTS idx_test_id ON test (id);",
    });
    tempDirs.push(migrationsDir);

    const executedStatements: string[] = [];
    const connection = createMockConnection(
      [
        {},
        {},
        { rows: [{ acquired: 1 }] },
        { rows: [] },
        {},
        {},
        {},
        {},
        { rows: [{ released: 1 }] },
      ],
      executedStatements
    );
    createConnectionMock.mockResolvedValue(connection);

    const result = await runPendingMigrations({
      connectionUri: "mysql://root:root@127.0.0.1:9306/test_db",
      migrationsDir,
      logger: testLogger,
    });

    expect(result.applied.map(item => item.fileName)).toEqual([
      "init-tables.sql",
      "0001_add_index.sql",
    ]);
    const executedSql = executedStatements.join("\n");
    const migrationSql = executedStatements.find(statement =>
      statement.includes("CREATE INDEX")
    );
    expect(executedSql).not.toContain("statement-breakpoint");
    expect(migrationSql).toBeDefined();
    expect(migrationSql).not.toContain("IF NOT EXISTS");
    expect(migrationSql).toContain("CREATE INDEX idx_test_id ON test (id);");
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it("reconciles duplicate legacy errors instead of failing the run", async () => {
    const migrationsDir = createTempMigrationsDir({
      "init-tables.sql": "CREATE TABLE test (id INT PRIMARY KEY);",
      "0001_duplicate_column.sql": "ALTER TABLE test ADD COLUMN id INT;",
    });
    tempDirs.push(migrationsDir);

    const executedStatements: string[] = [];
    const connection = createMockConnection(
      [
        {},
        {},
        { rows: [{ acquired: 1 }] },
        { rows: [] },
        {},
        {},
        { error: { code: "ER_DUP_FIELDNAME", sqlMessage: "Duplicate column" } },
        {},
        { rows: [{ released: 1 }] },
      ],
      executedStatements
    );
    createConnectionMock.mockResolvedValue(connection);

    const result = await runPendingMigrations({
      connectionUri: "mysql://root:root@127.0.0.1:9306/test_db",
      migrationsDir,
      logger: testLogger,
    });

    const duplicateMigration = result.applied.find(
      item => item.fileName === "0001_duplicate_column.sql"
    );
    expect(duplicateMigration?.outcome).toBe("reconciled");
    expect(duplicateMigration?.details).toContain("ER_DUP_FIELDNAME");
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it("fails on checksum drift before applying new migrations", async () => {
    const migrationsDir = createTempMigrationsDir({
      "init-tables.sql": "CREATE TABLE test (id INT PRIMARY KEY);",
    });
    tempDirs.push(migrationsDir);

    const [trackedBaseline] = buildMigrationPlan(migrationsDir);
    expect(trackedBaseline).toBeDefined();

    const executedStatements: string[] = [];
    const appliedAt = new Date("2026-04-03T00:00:00Z");
    const connection = createMockConnection(
      [
        {},
        {},
        { rows: [{ acquired: 1 }] },
        {
          rows: [
            {
              id: trackedBaseline!.id,
              fileName: trackedBaseline!.fileName,
              checksum: "deadbeef",
              kind: trackedBaseline!.kind,
              outcome: "applied",
              executionTimeMs: 1,
              details: null,
              appliedAt,
            } satisfies AppliedMigrationRecord,
          ],
        },
        { rows: [{ released: 1 }] },
      ],
      executedStatements
    );
    createConnectionMock.mockResolvedValue(connection);

    await expect(
      runPendingMigrations({
        connectionUri: "mysql://root:root@127.0.0.1:9306/test_db",
        migrationsDir,
        logger: testLogger,
      })
    ).rejects.toThrow(/Migration drift detected/);

    expect(executedStatements.join("\n")).not.toContain(
      "CREATE TABLE test (id INT PRIMARY KEY);"
    );
    expect(connection.end).toHaveBeenCalledTimes(1);
  });

  it("seeds the canonical global value stream before migration 0022", async () => {
    const migrationsDir = createTempMigrationsDir({
      "0022_hvsi_contribution_stream_backfill.sql":
        "UPDATE `knowledgeContributions` SET `valueStreamId` = 'global' WHERE `valueStreamId` IS NULL;",
    });
    tempDirs.push(migrationsDir);

    const executedStatements: string[] = [];
    const connection = createMockConnection(
      [
        {},
        {},
        { rows: [{ acquired: 1 }] },
        { rows: [] },
        { rows: [{ tableExists: 1 }] },
        { rows: [{ existingCount: 0 }] },
        {},
        {},
        {},
        { rows: [{ released: 1 }] },
      ],
      executedStatements
    );
    createConnectionMock.mockResolvedValue(connection);

    const result = await runPendingMigrations({
      connectionUri: "mysql://root:root@127.0.0.1:9306/test_db",
      migrationsDir,
      logger: testLogger,
    });

    expect(result.applied.map(item => item.fileName)).toEqual([
      "0022_hvsi_contribution_stream_backfill.sql",
    ]);

    const seedIndex = executedStatements.findIndex(statement =>
      statement.includes("INSERT INTO `valueStreams`")
    );
    const migrationIndex = executedStatements.findIndex(statement =>
      statement.includes("UPDATE `knowledgeContributions`")
    );

    expect(seedIndex).toBeGreaterThan(-1);
    expect(migrationIndex).toBeGreaterThan(seedIndex);
  });
});
