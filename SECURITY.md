# Security Policy

HKI is a reference implementation for isolation-sensitive agentic systems.
Please do not file public issues for exploitable vulnerabilities.

## Reporting a Vulnerability

Email security reports to the project maintainer listed in the repository
profile or use GitHub private vulnerability reporting when it is enabled.

Include:

- affected service, package, route, or deployment surface
- exact version or commit
- impact and reproduction steps
- whether credentials, tenant data, active-domain labels, caches, traces, tools,
  or publication workflows are involved

## Isolation-Specific Severity

Treat these as high-severity issues unless proven otherwise:

- runtime access without a signed non-global active domain
- missing or nullable domain labels on runtime artifacts
- cache, memory, graph, trace, ingestion, or tool reuse across domains
- body/query parameters overriding the signed scope envelope
- runtime paths invoking admin-plane cross-domain queries
- publication workflows exposing shared objects without target-domain materialization

## Supported Branches

The main branch is the active development branch. Public release branches will
be listed here once the project begins versioned framework releases.
