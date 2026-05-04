import path from "node:path";

import {
  DEFAULT_LOCAL_DATABASE_URL,
  getMigrationStatus,
} from "../server/_core/migration-runner.ts";

async function main() {
  const connectionUri = process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;
  const migrationsDir = path.resolve(import.meta.dirname, "../drizzle");
  const status = await getMigrationStatus({
    connectionUri,
    migrationsDir,
  });

  console.log("=========================================");
  console.log("DATABASE MIGRATION STATUS");
  console.log("=========================================");
  console.log(`Database: ${status.databaseUrlRedacted}`);
  console.log(`Tracking table: ${status.trackingTable}`);
  console.log(`Planned files: ${status.plan.length}`);
  console.log(`Tracked migrations: ${status.applied.length}`);
  console.log(`Pending migrations: ${status.pending.length}`);
  console.log(`Drifted migrations: ${status.drifted.length}`);

  if (status.applied.length > 0) {
    console.log("");
    console.log("Tracked migrations:");
    for (const migration of status.applied) {
      console.log(
        `  - ${migration.fileName} [${migration.outcome}] ${migration.appliedAt.toISOString()}`
      );
    }
  }

  if (status.pending.length > 0) {
    console.log("");
    console.log("Pending migrations:");
    for (const migration of status.pending) {
      console.log(`  - ${migration.fileName}`);
    }
  }

  if (status.drifted.length > 0) {
    console.log("");
    console.error("Drift detected:");
    for (const drift of status.drifted) {
      console.error(
        `  - ${drift.migration.fileName}: tracked checksum ${drift.appliedChecksum}, current checksum ${drift.migration.checksum}`
      );
    }
    process.exitCode = 1;
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration status failed: ${message}`);
  process.exitCode = 1;
});
