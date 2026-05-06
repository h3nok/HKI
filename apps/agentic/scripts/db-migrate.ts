import path from "node:path";

import {
  DEFAULT_LOCAL_DATABASE_URL,
  runPendingMigrations,
  redactDatabaseUrl,
  type MigrationLogger,
} from "../server/_core/migration-runner.ts";

const logger: MigrationLogger = {
  info(message, meta) {
    if (meta) console.log(message, meta);
    else console.log(message);
  },
  warn(message, meta) {
    if (meta) console.warn(message, meta);
    else console.warn(message);
  },
  error(message, meta) {
    if (meta) console.error(message, meta);
    else console.error(message);
  },
};

async function main() {
  const connectionUri = process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
  const migrationsDir = path.resolve(import.meta.dirname, "../drizzle");

  console.log("Running schema migrations...");
  console.log(`Database: ${redactDatabaseUrl(connectionUri)}`);

  const result = await runPendingMigrations({
    connectionUri,
    migrationsDir,
    logger,
  });

  console.log(
    `Migration run complete: ${result.applied.length} applied, ${result.skipped.length} already tracked`
  );

  const reconciled = result.applied.filter(
    migration => migration.outcome === "reconciled"
  );
  if (reconciled.length > 0) {
    console.warn(
      `Recovered ${reconciled.length} legacy migration(s) via reconciled tracking`
    );
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
