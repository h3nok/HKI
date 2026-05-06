import { createConnection } from "mysql2/promise";

import { DEFAULT_LOCAL_DATABASE_URL } from "../server/_core/migration-runner.ts";

type CountRow = { count: number };
type SampleRow = { id: string };

async function countQuery(connectionUri: string, sql: string) {
  const connection = await createConnection({
    uri: connectionUri,
    multipleStatements: false,
    charset: "utf8mb4",
  });

  try {
    const [rows] = await connection.query<CountRow[]>(sql);
    return Number(rows[0]?.count ?? 0);
  } finally {
    await connection.end();
  }
}

async function sampleIds(connectionUri: string, sql: string) {
  const connection = await createConnection({
    uri: connectionUri,
    multipleStatements: false,
    charset: "utf8mb4",
  });

  try {
    const [rows] = await connection.query<SampleRow[]>(sql);
    return rows.map(row => row.id);
  } finally {
    await connection.end();
  }
}

async function main() {
  const connectionUri = process.env.DATABASE_URL || DEFAULT_LOCAL_DATABASE_URL;

  const checks = [
    {
      name: "connectors_missing_stream_column",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeConnectors WHERE streamId IS NULL OR TRIM(streamId) = ''",
      sampleSql:
        "SELECT id FROM knowledgeConnectors WHERE streamId IS NULL OR TRIM(streamId) = '' LIMIT 10",
    },
    {
      name: "connectors_missing_config_stream",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeConnectors WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config, '$.streamId')), '') IS NULL",
      sampleSql:
        "SELECT id FROM knowledgeConnectors WHERE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config, '$.streamId')), '') IS NULL LIMIT 10",
    },
    {
      name: "connector_stream_mismatches",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeConnectors WHERE streamId <> COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config, '$.streamId')), ''), 'global')",
      sampleSql:
        "SELECT id FROM knowledgeConnectors WHERE streamId <> COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(config, '$.streamId')), ''), 'global') LIMIT 10",
    },
    {
      name: "syncs_missing_stream",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeConnectorSyncs WHERE streamId IS NULL OR TRIM(streamId) = ''",
      sampleSql:
        "SELECT id FROM knowledgeConnectorSyncs WHERE streamId IS NULL OR TRIM(streamId) = '' LIMIT 10",
    },
    {
      name: "contributions_missing_stream",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeContributions WHERE valueStreamId IS NULL OR TRIM(valueStreamId) = ''",
      sampleSql:
        "SELECT id FROM knowledgeContributions WHERE valueStreamId IS NULL OR TRIM(valueStreamId) = '' LIMIT 10",
    },
    {
      name: "document_impact_missing_stream",
      countSql:
        "SELECT COUNT(*) AS count FROM knowledgeDocumentImpact WHERE valueStreamId IS NULL OR TRIM(valueStreamId) = ''",
      sampleSql:
        "SELECT documentId AS id FROM knowledgeDocumentImpact WHERE valueStreamId IS NULL OR TRIM(valueStreamId) = '' LIMIT 10",
    },
  ];

  console.log("=========================================");
  console.log("HVSI INVENTORY");
  console.log("=========================================");
  console.log(`Database: ${connectionUri.replace(/:(.*?)@/, ":******@")}`);

  let hasIssues = false;

  for (const check of checks) {
    const count = await countQuery(connectionUri, check.countSql);
    console.log(`${check.name}: ${count}`);
    if (count > 0) {
      hasIssues = true;
      const ids = await sampleIds(connectionUri, check.sampleSql);
      console.log(`  sample ids: ${ids.join(", ") || "<none>"}`);
    }
  }

  if (hasIssues) {
    console.error("HVSI inventory found legacy stream gaps.");
    process.exitCode = 1;
    return;
  }

  console.log("HVSI inventory clean.");
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`HVSI inventory failed: ${message}`);
  process.exitCode = 1;
});
