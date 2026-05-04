import path from "node:path";

import {
  DEFAULT_LOCAL_DATABASE_URL,
  runPendingMigrations,
  type MigrationLogger,
} from "./migration-runner";

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
  console.log("AGENTIC DB MIGRATION");
  console.log("=========================================");

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

  console.log(
    `Migration run complete: ${appliedCount} applied, ${reconciledCount} reconciled, ${result.skipped.length} already tracked.`
  );
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
