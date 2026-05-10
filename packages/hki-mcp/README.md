# @hki/mcp

Hermetic Knowledge Isolation (HKI) middleware for Model Context Protocol (MCP) servers.

Enforces domain binding on tool, resource, and prompt registries, preventing tools from leaking knowledge across domains.

## Installation

```bash
npm install @hki/mcp @hki/runtime
```

For MCP server support, also install the MCP SDK:

```bash
npm install @modelcontextprotocol/sdk
```

## Quick start

```typescript
import { createHkiMcpServer } from "@hki/mcp";

const hkiMcp = createHkiMcpServer({
  domainRegistry: {
    iris: {
      tools: [
        { name: "search_iris_docs", description: "Search Iris domain documents" },
      ],
      resources: [{ uri: "iris://vault/contracts" }],
      prompts: [{ name: "iris_incident_response" }],
    },
    pulse: {
      tools: [
        { name: "search_pulse_docs", description: "Search Pulse domain documents" },
      ],
      resources: [],
      prompts: [],
    },
  },
  onAudit: (record) => {
    console.log("HKI decision:", record);
  },
});

// Usage in your MCP server
const toolsResult = await hkiMcp.filterTools(envelope, baseServerTools);
if (!toolsResult.allowed) {
  return { error: toolsResult.reason };
}
// Return toolsResult.tools to the client
```

## How it works

1. **Domain Registry** — You provide a mapping of active domains to their published tools, resources, and prompts.

2. **Envelope Validation** — Before every operation, the envelope is validated (signature, expiry, domain restrictions).

3. **Filtering** — Only tools/resources/prompts published into the active domain are returned.

4. **Scope Override Prevention** — Tool arguments are checked to prevent callers from injecting a different domain via `scope` or `active_domain` fields.

5. **Audit** — Every decision (allow/deny) is logged to your audit callback.

## API

### `createHkiMcpServer(options)`

Creates an HKI-aware MCP server wrapper.

**Options:**

- `domainRegistry: DomainRegistry` — Mapping of domains to their tools/resources/prompts.
- `onAudit?: (record: HkiMcpAuditRecord) => void | Promise<void>` — Optional audit callback.
- `debug?: boolean` — Enable console logging.

**Returns:**

An object with the following methods:

#### `filterTools(envelope, baseTools)`

Filter tools by active domain. Returns `{ tools, allowed, reason? }`.

#### `filterResources(envelope, baseResources)`

Filter resources by active domain. Returns `{ resources, allowed, reason? }`.

#### `filterPrompts(envelope, basePrompts)`

Filter prompts by active domain. Returns `{ prompts, allowed, reason? }`.

#### `validateToolCall(envelope, toolName, args?)`

Validate a tool call request. Checks envelope validity, scope overrides, and domain membership.

Returns `{ allowed, reason? }`.

#### `validateResourceRead(envelope, resourceUri)`

Validate a resource read request. Checks envelope validity and domain membership.

Returns `{ allowed, reason? }`.

#### `validateToolOutput(envelope, toolName, result)`

Validate tool output to ensure it does not reference cross-domain artifacts.

Returns `{ safe, reason? }`.

## Threat model

**HKI-T06: MCP Tool Without Scope Binding**

An MCP client calls a tool without including the active domain, and the tool leaks data from multiple domains in its response.

**Mitigation:**

@hki/mcp enforces that:
- Only tools published into the active domain are advertised.
- Tool call arguments cannot override the domain via a `scope` field.
- Tool output is validated for cross-domain references (best-effort).

## Related

- **@hki/runtime** — Core envelope types and validation.
- **@hki/conformance** — Conformance test suite.
- **spec/HKI-Agent-Gateway-Profile.md** — Full gateway specification.
