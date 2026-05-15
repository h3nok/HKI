# HKI Security Mapping

HKI is designed to complement existing agent and AI security work. It should not
compete with MCP, A2A, OWASP, NIST, OAuth, OIDC, or service-mesh controls. HKI
defines the runtime isolation evidence those systems need in enterprise agent
deployments.

## Ecosystem Fit

| Standard or Pattern | What It Covers                                      | HKI Adds                                                                                          |
| ------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| MCP                 | Tool/resource protocol and authorization mechanics. | Exact-domain runtime binding for tool catalog, arguments, calls, outputs, and audit.              |
| A2A                 | Agent-to-agent communication and task exchange.     | Active-domain envelope preservation across delegation.                                            |
| Agent gateways      | Enterprise enforcement chokepoints.                 | A conformance profile for what must be rejected and traced.                                       |
| OWASP LLM Top 10    | Application-layer LLM risks.                        | A concrete control for cross-domain data exposure, over-privileged tools, and memory/cache bleed. |
| NIST AI RMF         | Risk management vocabulary and governance process.  | Testable runtime evidence for mapping, measuring, managing, and governing scoped agent behavior.  |
| OAuth/OIDC/JWT      | Identity, authorization, and token formats.         | The semantic isolation claim that must survive every agentic transformation.                      |

## Threat Mapping

| HKI Failure              | Security Impact                                | HKI Control                                                                       |
| ------------------------ | ---------------------------------------------- | --------------------------------------------------------------------------------- |
| Missing active domain    | Runtime chooses broad or default visibility.   | Gateway rejects missing envelope.                                                 |
| `global` fallback        | Shared corpus becomes implicit wildcard.       | Runtime rejects `global` and publication materializes copies.                     |
| Query rewrite broadening | RAG optimizer crosses boundaries for recall.   | Retrieval binds all candidates to `active_domain`.                                |
| Cache contamination      | Domain B answer reused in Domain A.            | Cache key includes org, active domain, purpose, policy pack, and context version. |
| Tool overreach           | MCP adapter reads broader backend data.        | Gateway filters catalog and rejects conflicting tool args.                        |
| Delegated-agent drift    | A2A task loses original domain.                | Delegation carries envelope or fails closed.                                      |
| Graph edge bleed         | Derived graph traversal enters another domain. | Nodes and edges require exact-domain labels.                                      |
| Admin-plane reuse        | Cross-domain admin query leaks into runtime.   | Admin routes, telemetry, and authz are separate.                                  |

## Control Families

HKI controls fall into seven families:

1. **Scope resolution** — choose one active domain at the edge.
2. **Envelope integrity** — sign and preserve the runtime envelope.
3. **Artifact labeling** — require one domain label on every runtime artifact.
4. **Exact-domain enforcement** — reject null/global/wildcard runtime visibility.
5. **Gateway mediation** — constrain tools, agents, models, memory, and cache.
6. **Publication** — share by materializing target-domain artifacts.
7. **Audit evidence** — emit traces and conformance reports.

## Industry Profile Skeletons

HKI industry profiles should map the same runtime invariant to sector-specific
audit language. Profiles can add evidence requirements, examples, and artifact
classes. They cannot weaken exact-domain enforcement or introduce fallback
visibility.

| Profile                            | Primary concern                                                                             | Likely external mappings                                                        | HKI evidence emphasis                                                                                                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Financial services                 | Material non-public information, customer records, model-risk governance, fraud operations  | GLBA, SOX, SEC/FINRA supervision expectations, SOC 2, ISO 27001                 | Active-domain evidence for customer/account data, cache isolation, tool authorization, admin-plane separation, release evidence tied to change control.                       |
| Healthcare and life sciences       | PHI, clinical operations, safety review, research separation                                | HIPAA, HITRUST, FDA software quality expectations, SOC 2, ISO 27001             | Domain labels for PHI-bearing artifacts, strict retrieval boundaries, trace evidence for clinical context, publication workflow for de-identified or approved shared content. |
| Government and public sector       | Mission data, classified or controlled information, procurement auditability                | FedRAMP, NIST 800-53, NIST AI RMF, CMMC where applicable                        | Envelope integrity, tenant/domain separation, live probe evidence, audit-ready traces, no runtime route to cross-domain admin views.                                          |
| Legal and professional services    | Matter confidentiality, privilege boundaries, conflicts, client data segregation            | ABA confidentiality duties, ISO 27001, SOC 2, GDPR where applicable             | Active-domain as matter/client boundary, memory/cache isolation, explicit publication for shared precedent or approved knowledge.                                             |
| Retail and operations              | Pricing, supplier terms, workforce data, membership/customer records, operational playbooks | PCI DSS for payment-adjacent systems, SOX where applicable, SOC 2, privacy laws | Domain labels across operational functions, tool-scope enforcement, cache contamination tests, publication evidence for shared procedures.                                    |
| Manufacturing and IP-heavy sectors | Trade secrets, product design, supplier networks, plant operations, export controls         | ISO 27001, NIST 800-171/CMMC, export-control programs where applicable          | Artifact labels for engineering/IP repositories, tool and graph traversal boundaries, A2A delegation envelope preservation.                                                   |

Profile non-goals:

- HKI does not replace identity, access management, DLP, encryption, audit logs,
  or regulatory compliance programs.
- HKI does not define sector-specific authorization policy. It defines the
  runtime isolation evidence that policy must preserve.
- HKI profiles should not require a specific cloud, model provider, vector
  store, graph store, or agent framework.

## References

- MCP authorization specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/authorization
- Linux Foundation A2A project announcement: https://www.linuxfoundation.org/press/linux-foundation-launches-the-agent2agent-protocol-project-to-enable-secure-intelligent-communication-between-ai-agents
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications
- OWASP Agentic Skills Top 10: https://owasp.org/www-project-agentic-skills-top-10/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
