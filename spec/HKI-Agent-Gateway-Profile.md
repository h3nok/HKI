# HKI Agent Gateway Profile

**Status:** Draft profile for HKI 1.0
**Applies to:** Agent gateways, MCP gateways, A2A ingress/egress gateways,
tool routers, model routers, and enterprise agent control planes

## Goal

Agent gateways are becoming the enterprise chokepoint for agent traffic. HKI
defines what a security-focused gateway must prove before it allows an agentic
request to execute.

The profile is simple:

> A gateway is HKI-conformant only if every runtime request leaves the gateway
> with exactly one signed active domain and no downstream component can widen it.

## Gateway Responsibilities

An HKI gateway **MUST**:

1. Authenticate the caller or upstream agent.
2. Resolve exactly one active domain.
3. Verify the subject is authorized to choose that domain.
4. Sign or bind an HKI runtime envelope.
5. Attach the envelope to each downstream call.
6. Prevent body, query, prompt, tool, or delegated-agent arguments from
   overriding the envelope.
7. Reject missing, null, `global`, wildcard, contradictory, or expired scope.
8. Emit trace and audit evidence for each decision.

## Required Enforcement Points

| Flow | Enforcement |
| --- | --- |
| User to agent | Resolve active domain before orchestration starts. |
| Agent to retrieval | Bind retrieval to `(org_id, active_domain)`. |
| Agent to memory | Bind memory to `(org_id, subject_id, active_domain)`. |
| Agent to cache | Derive cache keys from active domain and policy pack. |
| Agent to MCP tool | Filter tool catalog by active domain and policy. |
| Agent to A2A agent | Include the HKI envelope or a gateway-verified derivative. |
| Tool callback | Validate returned artifacts match the active domain. |
| Admin request | Route through a separate admin plane and mark traces as admin-plane. |

## MCP Binding

For MCP-style tools and resources, the gateway **MUST**:

- expose only tools/resources published into the active domain
- validate the HKI envelope before `tools/call`
- reject tool arguments that contain a conflicting domain/scope
- include active domain in tool call audit records
- prevent tool output from introducing artifacts with another domain

Non-conformant pattern:

```json
{
  "tool": "search_documents",
  "arguments": {
    "scope": "global"
  }
}
```

The gateway must ignore or reject this argument when it conflicts with the
signed envelope.

## A2A Binding

For A2A-style agent delegation, the gateway **MUST**:

- bind every outgoing task to the caller's active domain
- require receiving agents to acknowledge the envelope or reject the task
- prevent delegated agents from selecting broader domains
- stamp every task lifecycle event with envelope id and active domain

If the receiving agent cannot preserve the envelope, the gateway **MUST** treat
the remote agent as non-HKI-conformant for runtime traffic.

## Gateway Policy Decision

An allow decision requires:

```text
valid_signature(envelope)
AND now < expires_at
AND active_domain != 'global'
AND active_domain in authorized_domains
AND requested_operation allowed by policy_pack_id
AND target published into active_domain
AND no request argument widens scope
```

Everything else fails closed.

## Audit Fields

Each gateway decision **SHOULD** emit:

- `hki.version`
- `hki.envelope_id`
- `hki.org_id`
- `hki.active_domain`
- `hki.subject_id`
- `hki.purpose`
- `hki.risk_tier`
- `hki.policy_pack_id`
- `hki.gateway.decision`
- `hki.gateway.reason`
- `hki.target.type`
- `hki.target.id`
- `hki.target.domain`

## Certification Evidence

An HKI gateway claim should include:

- denied examples for missing/global/conflicting scope
- denied MCP tool outside active domain
- denied A2A delegation without envelope preservation
- denied body/query override
- accepted in-domain tool call with trace evidence
- cache-key schema showing active-domain binding

