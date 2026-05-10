/**
 * HKI + MCP server example — domain-scoped tool registry.
 *
 * Every tool is registered with a domain tag. When an agent calls a tool,
 * the HKI guard checks that the envelope's active_domain matches the tool's
 * domain. Cross-domain tool calls are rejected before the handler runs.
 *
 * Run:
 *   pnpm install && pnpm ts-node server.ts
 *
 * Or build and run:
 *   pnpm build && node dist/server.js
 *
 * Send a tool call over stdio (MCP protocol), or use the stub client below.
 */

import { mintEnvelope } from "@hki/sdk/client";
import {
  evaluateGatewayTarget,
  HKI_VERSION,
  type HkiEnvelope,
  type HkiGatewayTarget,
} from "@hki/runtime";

// ---------------------------------------------------------------------------
// Minimal in-process MCP-like tool registry (replace with FastMCP / MCP SDK)
// ---------------------------------------------------------------------------

interface ToolDefinition {
  name: string;
  domain: string;
  description: string;
  handler: (args: Record<string, unknown>, envelope: HkiEnvelope) => unknown;
}

const registry: ToolDefinition[] = [
  {
    name: "payments.get_refund_limit",
    domain: "payments",
    description: "Returns the refund limit for the authenticated account.",
    handler: (_args, envelope) => ({
      domain: envelope.active_domain,
      limit_usd: 500,
      currency: "USD",
    }),
  },
  {
    name: "payments.submit_refund",
    domain: "payments",
    description: "Submits a refund request for a transaction.",
    handler: (args, envelope) => ({
      domain: envelope.active_domain,
      transaction_id: args.transaction_id,
      status: "queued",
    }),
  },
  {
    name: "hr.get_pto_balance",
    domain: "hr",
    description: "Returns the PTO balance for the authenticated employee.",
    handler: (_args, envelope) => ({
      domain: envelope.active_domain,
      days_remaining: 12.5,
      accrual_rate: "1.5 days/month",
    }),
  },
  {
    name: "hr.submit_time_off",
    domain: "hr",
    description: "Submits a time-off request.",
    handler: (args, envelope) => ({
      domain: envelope.active_domain,
      dates: args.dates,
      status: "pending_approval",
    }),
  },
];

// ---------------------------------------------------------------------------
// HKI gateway check for tool calls
// ---------------------------------------------------------------------------

function callTool(
  toolName: string,
  args: Record<string, unknown>,
  envelope: HkiEnvelope
): unknown {
  const tool = registry.find(t => t.name === toolName);
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  const target: HkiGatewayTarget = {
    type: "tool",
    id: tool.name,
    domain: tool.domain,
    published_domains: [],
  };

  const decision = evaluateGatewayTarget(envelope, target);
  if (!decision.allowed) {
    throw new Error(
      `HKI: tool '${toolName}' (domain=${tool.domain}) rejected — ` +
      `envelope active_domain='${envelope.active_domain}': ${decision.reason}`
    );
  }

  return tool.handler(args, envelope);
}

// ---------------------------------------------------------------------------
// Demo: run two tool calls, one allowed, one rejected
// ---------------------------------------------------------------------------

async function main() {
  const now = Math.floor(Date.now() / 1000);

  // Envelope scoped to "payments"
  const envelope = mintEnvelope({
    orgId: "acme",
    subjectId: "user:42",
    activeDomain: "payments",
    authorizedDomains: ["payments"],
    purpose: "tool-call",
    riskTier: "write",
    policyPackId: "payments@2026-05",
    issuer: "example-gateway",
    signature: "demo",
    ttl: 300,
  });

  console.log(`\nEnvelope active_domain: ${envelope.active_domain}\n`);

  // ✅ Allowed: payments tool with payments envelope
  try {
    const result = callTool("payments.get_refund_limit", {}, envelope);
    console.log("[PASS] payments.get_refund_limit →", JSON.stringify(result));
  } catch (err) {
    console.error("[FAIL] payments.get_refund_limit:", (err as Error).message);
  }

  // ⛔ Rejected: hr tool with payments envelope
  try {
    const result = callTool("hr.get_pto_balance", {}, envelope);
    console.log("[FAIL — should have been rejected] hr.get_pto_balance →", result);
  } catch (err) {
    console.log("[PASS] hr.get_pto_balance correctly rejected:", (err as Error).message);
  }

  // ✅ Allowed: payments submit with correct args
  try {
    const result = callTool(
      "payments.submit_refund",
      { transaction_id: "txn_abc123" },
      envelope
    );
    console.log("[PASS] payments.submit_refund →", JSON.stringify(result));
  } catch (err) {
    console.error("[FAIL] payments.submit_refund:", (err as Error).message);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
