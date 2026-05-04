import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";
import path from "path";
import * as schema from "../drizzle/schema";
import { InsertUser, User, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { createLogger } from "./_core/logger";
import { runPendingMigrations } from "./_core/migration-runner";

const log = createLogger("database");

const rolePriority: Record<User["role"], number> = {
  admin: 0,
  manager: 1,
  operator: 2,
  viewer: 3,
};

function normalizeEmail(email: string | null | undefined) {
  if (email == null) return email;
  return email.trim().toLowerCase();
}

function getLoginMethodPriority(method: string | null | undefined) {
  if (method === "google") return 0;
  if (method === "google-iap") return 2;
  return 1;
}

function comparePreferredUsers(left: User, right: User) {
  const activityDelta = Number(right.isActive) - Number(left.isActive);
  if (activityDelta !== 0) return activityDelta;

  const methodDelta =
    getLoginMethodPriority(left.loginMethod) -
    getLoginMethodPriority(right.loginMethod);
  if (methodDelta !== 0) return methodDelta;

  const roleDelta = rolePriority[left.role] - rolePriority[right.role];
  if (roleDelta !== 0) return roleDelta;

  return left.id - right.id;
}

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;
let _migrated = false;
let _migrationPromise: Promise<void> | null = null;
let _connectionLogged = false;
let _autoMigrationDisabledLogged = false;

async function runAutoMigrations(): Promise<void> {
  if (_migrated) return;
  if (_migrationPromise) {
    await _migrationPromise;
    return;
  }

  const migrationsDir = path.resolve(import.meta.dirname, "../drizzle");
  _migrationPromise = (async () => {
    const result = await runPendingMigrations({
      connectionUri: ENV.databaseUrl,
      migrationsDir,
      logger: {
        info(message, meta) {
          log.info(meta ?? {}, message);
        },
        warn(message, meta) {
          log.warn(meta ?? {}, message);
        },
        error(message, meta) {
          log.error(meta ?? {}, message);
        },
      },
    });
    _migrated = true;
    log.info(
      {
        applied: result.applied.length,
        reconciled: result.applied.filter(item => item.outcome === "reconciled")
          .length,
        skipped: result.skipped.length,
      },
      "Schema migration check complete"
    );
  })();

  try {
    await _migrationPromise;
  } finally {
    if (!_migrated) {
      _migrationPromise = null;
    }
  }
}

// Lazily create the drizzle instance backed by a mysql2 connection pool.
// Pool config prevents connection exhaustion under concurrent load:
//   - connectionLimit: max simultaneous connections (matches Cloud SQL headroom)
//   - waitForConnections: queue requests instead of failing when pool is full
//   - idleTimeout: release idle connections after 60s
//   - queueLimit: bound the waiting queue to prevent unbounded memory growth
export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    let initPhase: "connect" | "migrate" = "connect";
    try {
      _pool = createPool({
        uri: ENV.databaseUrl,
        connectionLimit: 20,
        waitForConnections: true,
        idleTimeout: 60_000,
        queueLimit: 100,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30_000,
        charset: "utf8mb4",
      });
      // Guarantee utf8mb4 on every new connection — mysql2 may not apply
      // the charset option from the URI. This ensures emojis and non-ASCII
      // characters are read and written correctly.
      _pool.on("connection", conn => {
        conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
      });
      _db = drizzle(_pool, { schema, mode: "default" });
      initPhase = "migrate";
      if (!_connectionLogged) {
        log.info("Connected to MySQL (pooled: limit=20, idle=60s)");
        _connectionLogged = true;
      }
      if (ENV.dbAutoMigrate) {
        try {
          await runAutoMigrations();
        } catch (err) {
          log.error({ err }, "Auto-migration failed");
          throw err;
        }
      } else if (!_autoMigrationDisabledLogged) {
        log.info(
          "Automatic migrations disabled; run `pnpm --dir apps/ai-platform/agentic db:migrate` before starting the app"
        );
        _autoMigrationDisabledLogged = true;
      }
    } catch (error) {
      if (_pool) {
        try {
          await _pool.end();
        } catch (closeError) {
          log.warn(
            { err: closeError },
            "Failed to close pool after init error"
          );
        }
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Migration drift detected")) {
        log.warn(
          { err: error },
          "Database initialization blocked by migration drift; run `make db-migrate-status` before starting the app"
        );
      } else if (initPhase === "migrate") {
        log.warn(
          { err: error },
          "Database initialization failed after connecting (will retry on next call)"
        );
      } else {
        log.warn(
          { err: error },
          "Failed to connect to database (will retry on next call)"
        );
      }
      _pool = null;
      _db = null;
    }
  }
  return _db;
}

// Graceful shutdown — drain pool connections
export async function closeDb() {
  if (_pool) {
    _pool.end();
    _pool = null;
    _db = null;
    log.info("Connection pool closed");
  }
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const normalizedEmail = normalizeEmail(user.email);
  const shouldForceAdmin =
    user.openId === ENV.ownerOpenId ||
    (normalizedEmail != null && ENV.superAdminEmails.includes(normalizedEmail));

  const db = await getDb();
  if (!db) {
    log.warn("Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = [
      "name",
      "email",
      "loginMethod",
      "pngId",
      "department",
      "valueStreams",
    ] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized =
        field === "email" ? (normalizeEmail(value) ?? null) : (value ?? null);
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.orgId !== undefined) {
      values.orgId = user.orgId;
      updateSet.orgId = user.orgId;
    }

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = shouldForceAdmin ? "admin" : user.role;
      updateSet.role = shouldForceAdmin ? "admin" : user.role;
    } else if (shouldForceAdmin) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (user.isActive !== undefined) {
      values.isActive = user.isActive;
      updateSet.isActive = user.isActive;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    log.error({ err: error }, "Failed to upsert user");
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    log.warn("Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUsersByEmail(email: string) {
  const db = await getDb();
  if (!db) {
    log.warn("Cannot get user by email: database not available");
    return [];
  }

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return [];
  }

  return db.select().from(users).where(eq(users.email, normalizedEmail));
}

export async function getPreferredUserByEmail(email: string) {
  const matches = await getUsersByEmail(email);
  if (matches.length === 0) {
    return undefined;
  }

  return [...matches].sort(comparePreferredUsers)[0];
}
