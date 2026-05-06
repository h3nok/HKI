import path from "node:path";

import {
  DEFAULT_LOCAL_DATABASE_URL,
  getMigrationStatus,
  runPendingMigrations,
  type MigrationLogger,
} from "../server/_core/migration-runner.ts";

const logger: MigrationLogger = {
  info(message, meta) {
    if (meta && Object.keys(meta).length > 0) {
      console.log(`${message} ${JSON.stringify(meta)}`);
      return;
    }
    console.log(message);
  },
  warn(message, meta) {
    if (meta && Object.keys(meta).length > 0) {
      console.warn(`${message} ${JSON.stringify(meta)}`);
      return;
    }
    console.warn(message);
  },
  error(message, meta) {
    if (meta && Object.keys(meta).length > 0) {
      console.error(`${message} ${JSON.stringify(meta)}`);
      return;
    }
    console.error(message);
  },
};

async function main() {
  const connectionUri = process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
  const migrationsDir = path.resolve(import.meta.dirname, "../drizzle");

  console.log("=========================================");
  console.log("AGENTIC DB PREFLIGHT");
  console.log("=========================================");

  const status = await getMigrationStatus({
    connectionUri,
    migrationsDir,
  });

  console.log(`Database: ${status.databaseUrlRedacted}`);
  console.log(`Tracked migrations: ${status.applied.length}`);
  console.log(`Pending migrations: ${status.pending.length}`);
  console.log(`Drifted migrations: ${status.drifted.length}`);

  if (status.drifted.length > 0) {
    console.error("");
    console.error(
      "Migration drift detected. A tracked migration file has changed since it was recorded in the local database."
    );
    for (const drift of status.drifted) {
      console.error(
        `  - ${drift.migration.fileName}: tracked checksum ${drift.appliedChecksum}, current checksum ${drift.migration.checksum}`
      );
    }
    console.error("");
    console.error("Resolve drift before starting the agentic UI:");
    console.error(
      "  1. Restore the migration file to the version that was already applied, or"
    );
    console.error(
      "  2. If the database already matches the current file and this is local-only, repair the local migration record after review."
    );
    console.error(
      "  3. Re-run `make db-migrate-status` to confirm the drift is gone."
    );
    process.exitCode = 1;
    return;
  }

  if (status.pending.length === 0) {
    console.log("");
    console.log("Schema is current. No pending migrations.");
    return;
  }

  console.log("");
  console.log(`Applying ${status.pending.length} pending migration(s)...`);

  const result = await runPendingMigrations({
    connectionUri,
    migrationsDir,
    logger,
  });

  const appliedCount = result.applied.filter(
    migration => migration.outcome === "applied"
  ).length;
  const reconciledCount = result.applied.filter(
    migration => migration.outcome === "reconciled"
  ).length;

  console.log("");
  console.log(
    `Migration preflight complete: ${appliedCount} applied, ${reconciledCount} reconciled.`
  );
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration preflight failed: ${message}`);
  process.exitCode = 1;
});
