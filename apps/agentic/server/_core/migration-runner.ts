import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  createConnection,
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";

export const DEFAULT_LOCAL_DATABASE_URL =
  "mysql://root:root@127.0.0.1:9306/hki_agentic";
export const DEFAULT_MIGRATION_LOCK_NAME = "agentic_schema_migrations";
export const DEFAULT_MIGRATION_TABLE = "appSchemaMigrations";

const RECONCILE_ERROR_CODES = new Set([
  "ER_DUP_FIELDNAME",
  "ER_TABLE_EXISTS_ERROR",
  "ER_DUP_KEYNAME",
  "ER_CANT_DROP_FIELD_OR_KEY",
  "ER_FK_DUP_NAME",
  "ER_DUP_ENTRY",
  "ER_MULTIPLE_PRI_KEY",
]);

const GLOBAL_STREAM_PREREQUISITE_MIGRATION =
  "0022_hvsi_contribution_stream_backfill.sql";

export type MigrationKind = "baseline" | "migration";
export type MigrationOutcome = "applied" | "reconciled";

export interface MigrationLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface MigrationPlanItem {
  id: string;
  fileName: string;
  filePath: string;
  kind: MigrationKind;
  checksum: string;
}

export interface AppliedMigrationRecord {
  id: string;
  fileName: string;
  checksum: string;
  kind: MigrationKind;
  outcome: MigrationOutcome;
  executionTimeMs: number | null;
  details: string | null;
  appliedAt: Date;
}

export interface MigrationStatus {
  databaseUrlRedacted: string;
  trackingTable: string;
  plan: MigrationPlanItem[];
  applied: AppliedMigrationRecord[];
  pending: MigrationPlanItem[];
  drifted: Array<{
    migration: MigrationPlanItem;
    appliedChecksum: string;
  }>;
}

export interface RunMigrationsOptions {
  connectionUri: string;
  migrationsDir: string;
  baselineFileName?: string;
  lockName?: string;
  lockTimeoutSeconds?: number;
  trackingTableName?: string;
  logger?: MigrationLogger;
}

export interface RunMigrationsResult {
  applied: AppliedMigrationRecord[];
  skipped: MigrationPlanItem[];
  drifted: Array<{
    migration: MigrationPlanItem;
    appliedChecksum: string;
  }>;
}

type LockRow = RowDataPacket & { acquired: number | null };
type ReleaseLockRow = RowDataPacket & { released: number | null };
type AppliedRow = RowDataPacket & {
  id: string;
  fileName: string;
  checksum: string;
  kind: MigrationKind;
  outcome: MigrationOutcome;
  executionTimeMs: number | null;
  details: string | null;
  appliedAt: Date;
};

type TableExistsRow = RowDataPacket & { tableExists: number | null };
type ExistingValueStreamRow = RowDataPacket & {
  existingCount: number | null;
};

function defaultLogger(): MigrationLogger {
  const { createLogger } = require("./logger");
  const log = createLogger("migrations");
  return {
    info(message, meta) {
      if (meta) log.info(meta, message);
      else log.info(message);
    },
    warn(message, meta) {
      if (meta) log.warn(meta, message);
      else log.warn(message);
    },
    error(message, meta) {
      if (meta) log.error(meta, message);
      else log.error(message);
    },
  };
}

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizeSql(sql: string): string {
  return sql
    .replace(/^\uFEFF/, "")
    .replace(/;?\s*--> statement-breakpoint\s*/g, ";\n")
    .replace(
      /\bCREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/gi,
      "CREATE $1INDEX"
    )
    .replace(/\bDROP\s+INDEX\s+IF\s+EXISTS\b/gi, "DROP INDEX");
}

function readSqlFile(filePath: string): { sql: string; checksum: string } {
  const raw = fs.readFileSync(filePath, "utf-8");
  const sql = normalizeSql(raw);
  return {
    sql,
    checksum: sha256(raw),
  };
}

function buildMigrationId(kind: MigrationKind, fileName: string): string {
  return `${kind}:${fileName}`;
}

export function redactDatabaseUrl(uri: string): string {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = "******";
    }
    return parsed.toString();
  } catch {
    return uri.replace(/:(.*?)@/, ":******@");
  }
}

export function buildMigrationPlan(
  migrationsDir: string,
  baselineFileName = "init-tables.sql"
): MigrationPlanItem[] {
  const resolvedDir = path.resolve(migrationsDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Migration directory not found: ${resolvedDir}`);
  }

  const plan: MigrationPlanItem[] = [];
  const baselinePath = path.join(resolvedDir, baselineFileName);
  if (fs.existsSync(baselinePath)) {
    const { checksum } = readSqlFile(baselinePath);
    plan.push({
      id: buildMigrationId("baseline", baselineFileName),
      fileName: baselineFileName,
      filePath: baselinePath,
      kind: "baseline",
      checksum,
    });
  }

  const migrationFiles = fs
    .readdirSync(resolvedDir)
    .filter(fileName => /^\d{4}.*\.sql$/.test(fileName))
    .sort((left, right) => left.localeCompare(right));

  for (const fileName of migrationFiles) {
    const filePath = path.join(resolvedDir, fileName);
    const { checksum } = readSqlFile(filePath);
    plan.push({
      id: buildMigrationId("migration", fileName),
      fileName,
      filePath,
      kind: "migration",
      checksum,
    });
  }

  return plan;
}

async function openMigrationConnection(
  connectionUri: string
): Promise<Connection> {
  const connection = await createConnection({
    uri: connectionUri,
    multipleStatements: true,
    charset: "utf8mb4",
  });
  await connection.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  return connection;
}

async function ensureTrackingTable(
  connection: Connection,
  trackingTableName: string
): Promise<void> {
  await connection.query(
    `
      CREATE TABLE IF NOT EXISTS \`${trackingTableName}\` (
        \`id\` varchar(255) NOT NULL,
        \`fileName\` varchar(255) NOT NULL,
        \`checksum\` char(64) NOT NULL,
        \`kind\` enum('baseline','migration') NOT NULL,
        \`outcome\` enum('applied','reconciled') NOT NULL DEFAULT 'applied',
        \`executionTimeMs\` int DEFAULT NULL,
        \`details\` text,
        \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `
  );
}

async function loadAppliedMigrations(
  connection: Connection,
  trackingTableName: string
): Promise<AppliedMigrationRecord[]> {
  const [rows] = await connection.query<AppliedRow[]>(
    `SELECT id, fileName, checksum, kind, outcome, executionTimeMs, details, appliedAt
       FROM \`${trackingTableName}\`
      ORDER BY appliedAt ASC, id ASC`
  );
  return rows.map(row => ({
    id: row.id,
    fileName: row.fileName,
    checksum: row.checksum,
    kind: row.kind,
    outcome: row.outcome,
    executionTimeMs: row.executionTimeMs,
    details: row.details,
    appliedAt: new Date(row.appliedAt),
  }));
}

function isRecoverableLegacyError(error: unknown): error is {
  code: string;
  errno?: number;
  sqlMessage?: string;
  message?: string;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    RECONCILE_ERROR_CODES.has((error as { code: string }).code)
  );
}

async function acquireMigrationLock(
  connection: Connection,
  lockName: string,
  timeoutSeconds: number
): Promise<void> {
  const [rows] = await connection.query<LockRow[]>(
    "SELECT GET_LOCK(?, ?) AS acquired",
    [lockName, timeoutSeconds]
  );
  const acquired = Number(rows[0]?.acquired ?? 0);
  if (acquired !== 1) {
    throw new Error(
      `Timed out acquiring migration lock "${lockName}" after ${timeoutSeconds}s`
    );
  }
}

async function releaseMigrationLock(
  connection: Connection,
  lockName: string,
  logger: MigrationLogger
): Promise<void> {
  try {
    const [rows] = await connection.query<ReleaseLockRow[]>(
      "SELECT RELEASE_LOCK(?) AS released",
      [lockName]
    );
    const released = Number(rows[0]?.released ?? 0);
    if (released !== 1) {
      logger.warn("Migration lock release returned unexpected state", {
        lockName,
        released,
      });
    }
  } catch (error) {
    logger.warn("Failed to release migration lock", {
      lockName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function recordAppliedMigration(
  connection: Connection,
  trackingTableName: string,
  migration: MigrationPlanItem,
  outcome: MigrationOutcome,
  executionTimeMs: number,
  details: string | null
): Promise<AppliedMigrationRecord> {
  await connection.query<ResultSetHeader>(
    `INSERT INTO \`${trackingTableName}\`
      (id, fileName, checksum, kind, outcome, executionTimeMs, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      migration.id,
      migration.fileName,
      migration.checksum,
      migration.kind,
      outcome,
      executionTimeMs,
      details,
    ]
  );

  return {
    id: migration.id,
    fileName: migration.fileName,
    checksum: migration.checksum,
    kind: migration.kind,
    outcome,
    executionTimeMs,
    details,
    appliedAt: new Date(),
  };
}

async function prepareMigrationPrerequisites(
  connection: Connection,
  migration: MigrationPlanItem,
  logger: MigrationLogger
): Promise<void> {
  if (migration.fileName !== GLOBAL_STREAM_PREREQUISITE_MIGRATION) {
    return;
  }

  const [tables] = await connection.query<TableExistsRow[]>(
    `SELECT COUNT(*) AS tableExists
       FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'valueStreams'`
  );

  if (Number(tables[0]?.tableExists ?? 0) === 0) {
    return;
  }

  const [rows] = await connection.query<ExistingValueStreamRow[]>(
    "SELECT COUNT(*) AS existingCount FROM `valueStreams` WHERE `id` = ?",
    ["global"]
  );

  if (Number(rows[0]?.existingCount ?? 0) > 0) {
    return;
  }

  await connection.query<ResultSetHeader>(
    "INSERT INTO `valueStreams` (`id`, `name`) VALUES (?, ?)",
    ["global", "Global"]
  );

  logger.warn("Seeded canonical global value stream prerequisite", {
    migrationId: migration.id,
    fileName: migration.fileName,
    streamId: "global",
  });
}

export async function getMigrationStatus(
  options: RunMigrationsOptions
): Promise<MigrationStatus> {
  const trackingTableName =
    options.trackingTableName ?? DEFAULT_MIGRATION_TABLE;
  const connection = await openMigrationConnection(options.connectionUri);
  try {
    await ensureTrackingTable(connection, trackingTableName);
    const plan = buildMigrationPlan(
      options.migrationsDir,
      options.baselineFileName
    );
    const applied = await loadAppliedMigrations(connection, trackingTableName);
    const appliedMap = new Map(applied.map(item => [item.id, item]));
    const pending: MigrationPlanItem[] = [];
    const drifted: Array<{
      migration: MigrationPlanItem;
      appliedChecksum: string;
    }> = [];

    for (const migration of plan) {
      const existing = appliedMap.get(migration.id);
      if (!existing) {
        pending.push(migration);
        continue;
      }
      if (existing.checksum !== migration.checksum) {
        drifted.push({
          migration,
          appliedChecksum: existing.checksum,
        });
      }
    }

    return {
      databaseUrlRedacted: redactDatabaseUrl(options.connectionUri),
      trackingTable: trackingTableName,
      plan,
      applied,
      pending,
      drifted,
    };
  } finally {
    await connection.end();
  }
}

export async function runPendingMigrations(
  options: RunMigrationsOptions
): Promise<RunMigrationsResult> {
  const logger = options.logger ?? defaultLogger();
  const lockName = options.lockName ?? DEFAULT_MIGRATION_LOCK_NAME;
  const trackingTableName =
    options.trackingTableName ?? DEFAULT_MIGRATION_TABLE;
  const timeoutSeconds = options.lockTimeoutSeconds ?? 30;
  const connection = await openMigrationConnection(options.connectionUri);

  try {
    await ensureTrackingTable(connection, trackingTableName);
    await acquireMigrationLock(connection, lockName, timeoutSeconds);

    const plan = buildMigrationPlan(
      options.migrationsDir,
      options.baselineFileName
    );
    const appliedRecords = await loadAppliedMigrations(
      connection,
      trackingTableName
    );
    const appliedMap = new Map(appliedRecords.map(item => [item.id, item]));

    const skipped: MigrationPlanItem[] = [];
    const drifted: Array<{
      migration: MigrationPlanItem;
      appliedChecksum: string;
    }> = [];
    const newlyApplied: AppliedMigrationRecord[] = [];

    for (const migration of plan) {
      const existing = appliedMap.get(migration.id);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          drifted.push({
            migration,
            appliedChecksum: existing.checksum,
          });
        } else {
          skipped.push(migration);
        }
      }
    }

    if (drifted.length > 0) {
      throw new Error(
        `Migration drift detected for ${drifted.length} tracked file(s): ` +
          drifted.map(item => item.migration.fileName).join(", ")
      );
    }

    for (const migration of plan) {
      if (appliedMap.has(migration.id)) continue;

      await prepareMigrationPrerequisites(connection, migration, logger);

      const { sql } = readSqlFile(migration.filePath);
      const startedAt = Date.now();

      try {
        await connection.query(sql);
        const record = await recordAppliedMigration(
          connection,
          trackingTableName,
          migration,
          "applied",
          Date.now() - startedAt,
          null
        );
        newlyApplied.push(record);
        logger.info("Applied migration", {
          migrationId: migration.id,
          fileName: migration.fileName,
          kind: migration.kind,
        });
      } catch (error) {
        if (isRecoverableLegacyError(error)) {
          const details = `${error.code}: ${error.sqlMessage ?? error.message ?? "recoverable legacy conflict"}`;
          const record = await recordAppliedMigration(
            connection,
            trackingTableName,
            migration,
            "reconciled",
            Date.now() - startedAt,
            details
          );
          newlyApplied.push(record);
          logger.warn("Reconciled legacy migration conflict", {
            migrationId: migration.id,
            fileName: migration.fileName,
            code: error.code,
          });
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Migration ${migration.fileName} failed: ${message}`);
      }
    }

    return {
      applied: newlyApplied,
      skipped,
      drifted,
    };
  } finally {
    await releaseMigrationLock(connection, lockName, logger);
    await connection.end();
  }
}
