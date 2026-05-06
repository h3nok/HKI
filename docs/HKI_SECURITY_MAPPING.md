# HKI Security Mapping

HKI is designed to complement existing agent and AI security work. It should not
compete with MCP, A2A, OWASP, NIST, OAuth, OIDC, or service-mesh controls. HKI
defines the runtime isolation evidence those systems need in enterprise agent
deployments.

## Ecosystem Fit

| Standard or Pattern | What It Covers | HKI Adds |
| --- | --- | --- |
| MCP | Tool/resource protocol and authorization mechanics. | Exact-domain runtime binding for tool catalog, arguments, calls, outputs, and audit. |
| A2A | Agent-to-agent communication and task exchange. | Active-domain envelope preservation across delegation. |
| Agent gateways | Enterprise enforcement chokepoints. | A conformance profile for what must be rejected and traced. |
| OWASP LLM Top 10 | Application-layer LLM risks. | A concrete control for cross-domain data exposure, over-privileged tools, and memory/cache bleed. |
| NIST AI RMF | Risk management vocabulary and governance process. | Testable runtime evidence for mapping, measuring, managing, and governing scoped agent behavior. |
| OAuth/OIDC/JWT | Identity, authorization, and token formats. | The semantic isolation claim that must survive every agentic transformation. |

## Threat Mapping

| HKI Failure | Security Impact | HKI Control |
| --- | --- | --- |
| Missing active domain | Runtime chooses broad or default visibility. | Gateway rejects missing envelope. |
| `global` fallback | Shared corpus becomes implicit wildcard. | Runtime rejects `global` and publication materializes copies. |
| Query rewrite broadening | RAG optimizer crosses boundaries for recall. | Retrieval binds all candidates to `active_domain`. |
| Cache contamination | Domain B answer reused in Domain A. | Cache key includes org, active domain, purpose, policy pack, and context version. |
| Tool overreach | MCP adapter reads broader backend data. | Gateway filters catalog and rejects conflicting tool args. |
| Delegated-agent drift | A2A task loses original domain. | Delegation carries envelope or fails closed. |
| Graph edge bleed | Derived graph traversal enters another domain. | Nodes and edges require exact-domain labels. |
| Admin-plane reuse | Cross-domain admin query leaks into runtime. | Admin routes, telemetry, and authz are separate. |

## Control Families

HKI controls fall into seven families:

1. **Scope resolution** — choose one active domain at the edge.
2. **Envelope integrity** — sign and preserve the runtime envelope.
3. **Artifact labeling** — require one domain label on every runtime artifact.
4. **Exact-domain enforcement** — reject null/global/wildcard runtime visibility.
5. **Gateway mediation** — constrain tools, agents, models, memory, and cache.
6. **Publication** — share by materializing target-domain artifacts.
7. **Audit evidence** — emit traces and conformance reports.

## References

- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- Linux Foundation A2A project announcement: https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications
- OWASP Agentic Skills Top 10: https://owasp.org/www-project-agentic-skills-top-10/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework

