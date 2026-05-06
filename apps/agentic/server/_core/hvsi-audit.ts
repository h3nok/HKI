import { count, sql } from "drizzle-orm";

import {
  knowledgeContributions,
  knowledgeDocumentImpact,
} from "../../drizzle/schema";
import { getDb } from "../db";
import { isKbHermeticIsolationEnabled } from "./env";

export interface HvsiAuditStatus {
  enabled: boolean;
  ready: boolean;
  issues: Record<string, number>;
  summary: string;
}

async function countMissingStreamRows(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  table: typeof knowledgeContributions | typeof knowledgeDocumentImpact,
  column:
    | typeof knowledgeContributions.valueStreamId
    | typeof knowledgeDocumentImpact.valueStreamId
): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(table)
    .where(sql`COALESCE(TRIM(${column}), '') = ''`);

  return Number(row?.count ?? 0);
}

export function summarizeHvsiIssues(issues: Record<string, number>): string {
  const entries = Object.entries(issues).filter(([, value]) => value > 0);
  if (entries.length === 0) {
    return "HVSI strict-mode audit passed";
  }

  const summary = entries.map(([key, value]) => `${key}=${value}`).join(", ");

  return `HVSI strict-mode blocked by legacy null-stream artifacts: ${summary}`;
}

export async function buildLocalHvsiAuditStatus(): Promise<HvsiAuditStatus> {
  if (!isKbHermeticIsolationEnabled()) {
    return {
      enabled: false,
      ready: true,
      issues: {},
      summary: "HVSI strict mode disabled",
    };
  }

  const db = await getDb();
  if (!db) {
    const issues = { database_unavailable: 1 };
    return {
      enabled: true,
      ready: false,
      issues,
      summary:
        "HVSI strict-mode audit unavailable because the database is offline",
    };
  }

  const [contributionsMissingStream, documentImpactMissingStream] =
    await Promise.all([
      countMissingStreamRows(
        db,
        knowledgeContributions,
        knowledgeContributions.valueStreamId
      ),
      countMissingStreamRows(
        db,
        knowledgeDocumentImpact,
        knowledgeDocumentImpact.valueStreamId
      ),
    ]);

  const issues = Object.fromEntries(
    Object.entries({
      contributions_missing_stream: contributionsMissingStream,
      document_impact_missing_stream: documentImpactMissingStream,
    }).filter(([, value]) => value > 0)
  );

  return {
    enabled: true,
    ready: Object.keys(issues).length === 0,
    issues,
    summary: summarizeHvsiIssues(issues),
  };
}

export async function buildAgenticReadinessPayload(): Promise<{
  status: "ready" | "blocked";
  service: "agentic";
  hvsi?: HvsiAuditStatus;
}> {
  const hvsi = await buildLocalHvsiAuditStatus();
  if (!hvsi.enabled) {
    return {
      status: "ready",
      service: "agentic",
    };
  }

  return {
    status: hvsi.ready ? "ready" : "blocked",
    service: "agentic",
    hvsi,
  };
}
