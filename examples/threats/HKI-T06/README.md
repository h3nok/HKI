# HKI-T06 — MCP tool registered without domain binding

**Severity:** High
**Surface:** MCP gateway.

An MCP server exposes a tool whose `domain` field is missing, `*`, or
`global`. Any agent under any active domain can invoke it, and the tool's
side effects are written without a domain label.

Conformance: HKI-C25 (reject wildcard artifact), HKI-C26 (reject wildcard
gateway target), HKI-C27 (reject wildcard publication).
