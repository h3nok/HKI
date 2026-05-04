# Agent Starter Pack vs AI Platform

Date: March 27, 2026
Purpose: Side-by-side adoption checklist to accelerate KAD gap closure using patterns from GoogleCloudPlatform/agent-starter-pack.

Reference:
- https://github.com/GoogleCloudPlatform/agent-starter-pack?tab=readme-ov-file

---

## How to Use This Checklist

- Treat agent-starter-pack as a pattern library, not a direct replacement.
- Prioritize P0 rows first (security and observability controls).
- For each row, assign owner and due date before implementation.

---

## P0 Adoption Matrix (Immediate)

| Area | Current AI Platform State | Starter-Pack Pattern to Borrow | Gap to Close | Recommended Implementation in This Repo |
|---|---|---|---|---|
| AI Gateway governance (AX-KAD) | Orchestrator supports configurable `LLM_GATEWAY_URL`; active path still LiteLLM-first in current posture | Environment-driven deployment templates for multi-environment runtime config | Apigee is not the authoritative production route | Set production env and Terraform var defaults to Apigee endpoint; add deployment verification check that fails if prod is not Apigee URL |
| Logging to SIEM (KAD-04_04/21/23) | Structured JSON logs are emitted; no Chronicle/SCC sink resources found | Production observability/deployment patterns and infrastructure baseline checks | No sink pipeline from Cloud Logging to Chronicle/SCC | Add Terraform module for logging sinks and export pipeline; add post-deploy smoke test for log delivery |
| SAST/SCA in CI (KAD-13/28) | CI workflows are Terraform deploy-centric; no repository-defined SAST/SCA gates | Built-in CI/CD security posture from starter templates | Missing enforced AppSec checks on PR/main | Add GitHub Actions workflow for SAST/SCA + policy gate; block merge on critical/high findings |
| Monitoring controls (KAD-41) | OTel tracing exists; no alerting-as-code/uptime checks | Built-in monitoring/observability deployment posture | Missing SLO-aligned alerts and checks | Add Terraform for uptime checks + alert policies for all public service endpoints |

---

## P1 Adoption Matrix (Next Sprint)

| Area | Current AI Platform State | Starter-Pack Pattern to Borrow | Gap to Close | Recommended Implementation in This Repo |
|---|---|---|---|---|
| IaC scanning (KAD-12) | No IaC scanning stage in CI | CI security stage templates integrated with deployment workflows | Terraform changes can merge without IaC policy check | Add IaC scan job on PR for `apps/**/tf/**` and `lab/**`; fail on policy violations |
| WAAP/WAF (KAD-11) | GLB/IAP exists; Cloud Armor policy bindings not explicit in platform flow | Production hardening defaults in deploy templates | No consistent WAF policy enforcement at edge | Attach Cloud Armor policy to relevant backend services; include managed + custom rules |
| VPC-SC (KAD-10) | VPC egress/Shared VPC exists; no service perimeter resources in app scope | Enterprise-grade deployment controls by environment | Controls not encoded for perimeter governance | Add Access Context Manager perimeters at org infra layer; document exception process where needed |
| RUM (RUM KAD) | Backend observability exists; no browser RUM in agentic client | Full-stack observability orientation | No client-side experience telemetry | Add browser telemetry SDK, define front-end error and latency SLO dashboards |
| Memory compliance (Agentic Memory KAD) | Tiered memory exists; no erasure/audit endpoint | Evaluation and production-readiness discipline | GDPR/retention controls incomplete | Add memory deletion API + immutable audit trail + retention docs |

---

## Proposed KADs: Readiness Lift via Starter-Pack Patterns

| Proposed KAD | Current Readiness | Pattern to Reuse | Concrete Next Step |
|---|---:|---|---|
| AI & MCP Gateway | 85% | Environment-first deployment templates | Add prod runtime assertion for gateway URL and auth policy |
| Agentic AI Model Decision | 70% | Deployment and evaluation maturity flows | Define model approval/versioning SOP + cost budget guardrails |
| Agent Appraisal | 20% | Evaluation-first templates and workflows | Implement LLM-as-judge scoring on sampled traces |
| Agent Evaluation | 35% | Integrated eval + deploy cycle | Add conversation-level KPI suite and release gate |
| Agentic AI Toolset Decision | 40% | Structured productionization checklist | Replace mock tools with SAP/ODS-backed adapters and approval workflow |

---

## Implementation Sequencing (Recommended)

1. Security gates first: add SAST/SCA/IaC in CI.
2. Observability controls second: log sink routing and alerting-as-code.
3. Edge hardening third: Cloud Armor and gateway enforcement checks.
4. Governance and quality fourth: model approval policy and eval gates.
5. Product depth fifth: replace tool stubs and complete memory compliance APIs.

---

## Exit Criteria for KAD Review Readiness

- CI enforces SAST/SCA/IaC policy gates on all PRs.
- Production gateway endpoint is Apigee and verified during deployment.
- Cloud Logging to Chronicle/SCC routing is codified and validated.
- Service uptime/latency/error-rate alerts exist and are actionable.
- Proposed KADs have named owners, target ARB dates, and evidence links.

