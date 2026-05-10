import {
  validateEnvelope,
  type HkiEnvelope,
  type HkiValidationResult,
} from "@hki/runtime";
import type {
  DomainRegistry,
  FilteredRegistry,
  HkiMcpAuditRecord,
  HkiMcpServerOptions,
  McpPrompt,
  McpResource,
  McpTool,
  McpToolResult,
} from "./types";

/** Helper to get current Unix timestamp in seconds. */
function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Core filtering logic: given a domain registry and active domain,
 * return only the tools/resources/prompts published to that domain.
 */
export function filterRegistryByDomain(
  registry: DomainRegistry,
  activeDomain: string
): FilteredRegistry {
  const domainEntry = registry[activeDomain];
  return {
    tools: domainEntry?.tools ?? [],
    resources: domainEntry?.resources ?? [],
    prompts: domainEntry?.prompts ?? [],
  };
}

/**
 * Validate an HKI envelope for use in an MCP operation.
 * Checks signature validity, expiry, and domain restrictions.
 *
 * Returns a validation result. On failure, the caller should reject the
 * operation with a 401 (Unauthorized) or 403 (Forbidden) response.
 */
export function validateMcpEnvelope(
  envelope: HkiEnvelope
): HkiValidationResult {
  // Delegate to the runtime validator
  const result = validateEnvelope(envelope, {
    now: nowSec(),
    requireSignature: true,
  });
  return result;
}

/**
 * Check if a tool call argument contains a scope override.
 *
 * Non-conformant pattern: arguments = { scope: "other-domain" }
 * or arguments = { active_domain: "other-domain" }
 *
 * Returns true if the argument set contains a conflicting scope field.
 */
export function hasScopeOverride(
  args: Record<string, unknown> | undefined
): boolean {
  if (!args || typeof args !== "object") return false;
  // Reject any explicit scope or active_domain in the arguments
  return "scope" in args || "active_domain" in args;
}

/**
 * Check if a tool result (output) attempts to reference an artifact
 * from a different domain.
 *
 * Best-effort check: if the tool returns a resource URI or explicit domain
 * reference, validate it matches the active domain.
 *
 * Returns true if the output appears to cross domain boundaries.
 */
export function isToolOutputCrossDomain(
  result: McpToolResult,
  activeDomain: string
): boolean {
  // If the tool output includes a URI, check if it might be cross-domain
  if (result.uri) {
    // Simple heuristic: check if URI starts with a different domain
    // e.g., "iris://..." vs current active domain
    const uriPrefix = result.uri.split("://")[0];
    if (uriPrefix && uriPrefix !== activeDomain) {
      return true;
    }
  }
  return false;
}

/**
 * Create an HKI-aware MCP server wrapper.
 *
 * This factory function takes a domain registry and optional audit callback,
 * then returns an object with domain-filtered methods that can wrap
 * an underlying MCP server implementation.
 *
 * Usage:
 * ```ts
 * const hkiMcp = createHkiMcpServer({
 *   domainRegistry: {
 *     iris: {
 *       tools: [{ name: "search_iris_docs", ... }],
 *       resources: [{ uri: "iris://vault", ... }],
 *     },
 *     pulse: { tools: [...], resources: [...] },
 *   },
 *   onAudit: (record) => logger.info(record),
 * });
 *
 * // Wrap your MCP server's tool listing
 * const toolList = hkiMcp.filterTools(envelope, baseServerTools);
 * ```
 */
export function createHkiMcpServer(options: HkiMcpServerOptions) {
  const { domainRegistry, onAudit, debug } = options;

  function log(msg: string, obj?: unknown): void {
    if (debug) {
      console.log(`[hki-mcp] ${msg}`, obj ?? "");
    }
  }

  async function audit(record: HkiMcpAuditRecord): Promise<void> {
    log("audit", record);
    if (onAudit) {
      await onAudit(record);
    }
  }

  return {
    /**
     * Filter the tools list to only those published into the active domain.
     * Validates the envelope first. Emits an audit record.
     */
    async filterTools(
      envelope: HkiEnvelope,
      _baseTools: McpTool[]
    ): Promise<{ tools: McpTool[]; allowed: boolean; reason?: string }> {
      const validation = validateMcpEnvelope(envelope);
      const record: HkiMcpAuditRecord = {
        timestamp: new Date().toISOString(),
        envelope_id: envelope.envelope_id,
        active_domain: envelope.active_domain,
        operation: "tools.list",
        allowed: false,
      };

      if (!validation.ok) {
        record.reason = `envelope validation failed: ${validation.issues.map(i => i.code).join(",")}`;
        await audit(record);
        return { tools: [], allowed: false, reason: record.reason };
      }

      const filtered = filterRegistryByDomain(
        domainRegistry,
        envelope.active_domain
      );
      record.allowed = true;
      await audit(record);
      return { tools: filtered.tools, allowed: true };
    },

    /**
     * Filter the resources list to only those published into the active domain.
     * Validates the envelope first. Emits an audit record.
     */
    async filterResources(
      envelope: HkiEnvelope,
      _baseResources: McpResource[]
    ): Promise<{
      resources: McpResource[];
      allowed: boolean;
      reason?: string;
    }> {
      const validation = validateMcpEnvelope(envelope);
      const record: HkiMcpAuditRecord = {
        timestamp: new Date().toISOString(),
        envelope_id: envelope.envelope_id,
        active_domain: envelope.active_domain,
        operation: "resources.list",
        allowed: false,
      };

      if (!validation.ok) {
        record.reason = `envelope validation failed: ${validation.issues.map(i => i.code).join(",")}`;
        await audit(record);
        return { resources: [], allowed: false, reason: record.reason };
      }

      const filtered = filterRegistryByDomain(
        domainRegistry,
        envelope.active_domain
      );
      record.allowed = true;
      await audit(record);
      return { resources: filtered.resources, allowed: true };
    },

    /**
     * Filter the prompts list to only those published into the active domain.
     * Validates the envelope first. Emits an audit record.
     */
    async filterPrompts(
      envelope: HkiEnvelope,
      _basePrompts: McpPrompt[]
    ): Promise<{ prompts: McpPrompt[]; allowed: boolean; reason?: string }> {
      const validation = validateMcpEnvelope(envelope);
      const record: HkiMcpAuditRecord = {
        timestamp: new Date().toISOString(),
        envelope_id: envelope.envelope_id,
        active_domain: envelope.active_domain,
        operation: "prompts.list",
        allowed: false,
      };

      if (!validation.ok) {
        record.reason = `envelope validation failed: ${validation.issues.map(i => i.code).join(",")}`;
        await audit(record);
        return { prompts: [], allowed: false, reason: record.reason };
      }

      const filtered = filterRegistryByDomain(
        domainRegistry,
        envelope.active_domain
      );
      record.allowed = true;
      await audit(record);
      return { prompts: filtered.prompts, allowed: true };
    },

    /**
     * Validate a tool call before allowing it to execute.
     * Checks:
     * - Envelope is valid
     * - Tool is in the active domain registry
     * - Arguments do not contain scope override
     *
     * Emits an audit record. Returns an allow/deny decision.
     */
    async validateToolCall(
      envelope: HkiEnvelope,
      toolName: string,
      args?: Record<string, unknown>
    ): Promise<{ allowed: boolean; reason?: string }> {
      const validation = validateMcpEnvelope(envelope);
      const record: HkiMcpAuditRecord = {
        timestamp: new Date().toISOString(),
        envelope_id: envelope.envelope_id,
        active_domain: envelope.active_domain,
        operation: "tools.call",
        tool_name: toolName,
        allowed: false,
      };

      if (!validation.ok) {
        record.reason = `envelope validation failed`;
        await audit(record);
        return { allowed: false, reason: record.reason };
      }

      // Check if arguments contain scope override
      if (hasScopeOverride(args)) {
        record.reason = "tool arguments contain scope override";
        await audit(record);
        return { allowed: false, reason: record.reason };
      }

      // Check if the tool is in the domain registry
      const filtered = filterRegistryByDomain(
        domainRegistry,
        envelope.active_domain
      );
      const toolExists = filtered.tools.some(t => t.name === toolName);
      if (!toolExists) {
        record.reason = `tool '${toolName}' not published into domain '${envelope.active_domain}'`;
        await audit(record);
        return { allowed: false, reason: record.reason };
      }

      record.allowed = true;
      await audit(record);
      return { allowed: true };
    },

    /**
     * Validate a resource read before allowing access.
     * Checks:
     * - Envelope is valid
     * - Resource is in the active domain registry
     *
     * Emits an audit record. Returns an allow/deny decision.
     */
    async validateResourceRead(
      envelope: HkiEnvelope,
      resourceUri: string
    ): Promise<{ allowed: boolean; reason?: string }> {
      const validation = validateMcpEnvelope(envelope);
      const record: HkiMcpAuditRecord = {
        timestamp: new Date().toISOString(),
        envelope_id: envelope.envelope_id,
        active_domain: envelope.active_domain,
        operation: "resources.read",
        resource_uri: resourceUri,
        allowed: false,
      };

      if (!validation.ok) {
        record.reason = `envelope validation failed`;
        await audit(record);
        return { allowed: false, reason: record.reason };
      }

      // Check if the resource is in the domain registry
      const filtered = filterRegistryByDomain(
        domainRegistry,
        envelope.active_domain
      );
      const resourceExists = filtered.resources.some(
        r => r.uri === resourceUri
      );
      if (!resourceExists) {
        record.reason = `resource '${resourceUri}' not published into domain '${envelope.active_domain}'`;
        await audit(record);
        return { allowed: false, reason: record.reason };
      }

      record.allowed = true;
      await audit(record);
      return { allowed: true };
    },

    /**
     * Validate tool output to ensure it does not introduce cross-domain artifacts.
     * Best-effort heuristic check.
     *
     * Emits an audit record if output appears cross-domain.
     */
    async validateToolOutput(
      envelope: HkiEnvelope,
      toolName: string,
      result: McpToolResult
    ): Promise<{ safe: boolean; reason?: string }> {
      const isCrossDomain = isToolOutputCrossDomain(
        result,
        envelope.active_domain
      );

      if (isCrossDomain) {
        const record: HkiMcpAuditRecord = {
          timestamp: new Date().toISOString(),
          envelope_id: envelope.envelope_id,
          active_domain: envelope.active_domain,
          operation: "tools.call",
          tool_name: toolName,
          allowed: false,
          reason: "tool output references cross-domain artifact",
        };
        await audit(record);
        return {
          safe: false,
          reason: "tool output references cross-domain artifact",
        };
      }

      return { safe: true };
    },
  };
}
