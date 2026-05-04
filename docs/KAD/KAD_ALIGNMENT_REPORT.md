# Agentic AI Platform — KAD Alignment Report

**Date**: March 27, 2026  
**Scope**: HKI GCP KAD Tracker vs Agentic AI Platform implementation  
**Author**: Platform Engineering  
**Status**: Living document

---

## Executive Summary

The Agentic AI Platform is operational and strongly aligned with core foundation patterns (hub/spoke networking, IAP front door, IAM RBAC, Secret Manager, AlloyDB). The largest compliance gaps are still in security and observability controls rather than service functionality.

Primary blockers for broader rollout:

1. **Apigee routing** is not the active LLM production path yet (`LLM_GATEWAY_URL` still points to LiteLLM path in current deployment model).
2. **Logging-to-SIEM** is incomplete (structured logs exist, but no Chronicle/SCC sink pipeline is provisioned in Terraform).
3. **Security scanning** in CI is not wired (SAST/DAST/SCA/IaC scanning are not defined in repo workflows).
4. **Monitoring controls** (alerting, uptime checks, RUM) lag approved KAD direction.
5. **Eight Agentic AI KADs remain proposed** and need owners, KAD numbers, and ARB scheduling.

---

## 1) Foundation KAD Alignment

### 1.1 Aligned

| KAD | Name | Status | Current Alignment |
|---|---|---|---|
| KAD-01 | Org Resource Hierarchy | ARB Approved | Hub/spoke model is in use (`p-642-cilab-infrastructure` + spoke projects). |
| KAD-06 | Networking VPC Design | ARB Approved | Shared VPC host, subnet strategy, PGA and flow logs are implemented in `lab/`. |
| KAD-30 | Secure Access (IAP) | EARC/VP Approved | GLB + IAP pattern implemented; Cloud Run services configured for IAP fronting (`invoker_iam_disabled`). |
| KAD-04_01 | IAM RBAC | ARB Approved | Role hierarchy (`admin`, `manager`, `operator`, `viewer`) is enforced in app middleware. |
| KAD-20 | IAM Secrets Management | ARB Approved | Secret Manager used across services and Terraform deployment wiring. |
| KAD-47 | ODS / AlloyDB Decision | EARC Approved | AlloyDB + `pgvector` is the primary knowledge store implementation. |
| KAD-16 | Data/DSPM (baseline controls) | ARB Approved | Tenant scoping and PII guardrails are present at application level. |
| KAD-09 | CI/CD | ARB Approved | Terraform deployment pipeline exists with Workload Identity Federation. |

### 1.2 Partial Alignment / Gaps

| KAD | Name | Status | Gap | Severity |
|---|---|---|---|---|
| AX-KAD-01..17 | Apigee X architecture/security/network flows | Mixed (Approved/In Review) | LLM path is not fully routed through approved Apigee endpoint yet. | High |
| KAD-04_04 + KAD-21 + KAD-23 | Logging/SIEM/Chronicle | ARB Approved / In Review | Structured stdout logging exists but no Cloud Logging sink to Chronicle/SCC in Terraform. | High |
| KAD-13 + KAD-25 + KAD-28 | SAST/DAST/SCA | ARB Approved | No security scan stages in repo CI workflows. Manual/local audit scripts exist only. | High |
| KAD-12 | IaC Scanning | ARB Approved | No Terraform/IaC scanning stage in CI pipeline. | Medium |
| KAD-11 | WAAP/WAF | ARB Approved | No explicit Cloud Armor policy bindings found for platform LB backends. | Medium |
| KAD-02_03 | IAM SSO/SAML | ARB Approved | Platform auth flow is Google OAuth-centric; Ping federation alignment is pending. | Medium |
| KAD-10 | VPC-SC | EARC Approved | VPC access is configured; Access Context Manager/VPC-SC perimeter resources are not present in app Terraform. | Medium |
| KAD-24 | Backup/DR | Backlog | Backups exist, but no complete cross-region DR posture (Redis HA tier and wider DR pattern pending). | Medium |
| KAD-41 | Monitoring | VP Approved | Tracing exists, but no alerting-as-code/uptime checks in Terraform. | High |
| KAD-49 | Monitoring & Logging Framework | Backlog | Framework-level observability standardization is incomplete. | Medium |
| Observability RUM KAD | Real User Monitoring | EARC Approved | No browser RUM implementation found in `agentic` client. | Medium |
| SDP-DLP | Data Protection Controls | EARC Approved | PII detection is regex/prompt based; no GCP Sensitive Data Protection API integration found. | Medium |

### 1.3 Not Applicable / Out of Scope

| KAD | Reason |
|---|---|
| KAD-26 (MAST) | No mobile application in current AI platform scope. |
| KAD-04_02 (VM patching) | Platform runs serverless/containerized workloads rather than VM fleet. |
| Azure/Sustainability KAD items | Different value stream/application area. |
| Google Workspace Add-On KAD items | Different product scope. |

---

## 2) Proposed Agentic AI KADs (Current Readiness)

| Proposed KAD | Status | Coverage | Current State | Readiness |
|---|---|---:|---|---|
| AI & MCP Gateway | Proposed | 85% | MCP server is implemented in Knowledge API; production gateway governance still needs final Apigee routing posture. | Near-ready |
| Graph Database | Proposed | 50% | Neo4j support exists but no approved Neo4j KAD/production decision. | Not ready |
| Agentic AI Toolset Decision | Proposed | 40% | Tool framework exists; several business tools are still stub/mock. | Not ready |
| Knowledge Representation | Proposed | 90% | Hybrid retrieval architecture is robust and implemented end-to-end. | ARB-ready |
| Agent Appraisal | Proposed | 20% | Trace capture exists; no systematic LLM-as-judge or human rubric process. | Not ready |
| Agent Evaluation | Proposed | 35% | Retrieval evaluation exists; conversation-level outcome evaluation is missing. | Not ready |
| Agentic AI Model Decision | Proposed | 70% | Tiered model strategy exists; formal governance/versioning policy and Apigee finalization pending. | Partial |
| Agentic AI Memory | Proposed | 80% | Multi-tier memory exists; erasure/audit/compliance API and lifecycle controls are incomplete. | Near-ready |

---

## 3) Additional Tracker Callouts (New vs Prior Report)

The following KAD-relevant findings were added in this revision:

- **WAAP/WAF callout**: Cloud Armor control binding is not yet explicit in this scope.
- **Monitoring KAD-41 callout**: tracing/logging are present, but alerting-as-code and uptime checks are not.
- **RUM callout**: no browser-side real-user monitoring implementation in current `agentic` client.
- **IaC scanning callout**: no CI stage for Terraform scanning.
- **DLP callout**: no GCP DLP resource/API integration identified.
- **HA/DR callout**: Redis tier/DR posture requires explicit hardening plan.

---

## 4) Priority Action Plan

### P0 (Before Broader Rollout)

| # | Action | Owner | Effort | KAD(s) |
|---:|---|---|---|---|
| 1 | Switch orchestrator `LLM_GATEWAY_URL` to approved Apigee endpoint and validate routing/keys/policies. | Platform Eng | 0.5 day | AX-KAD series |
| 2 | Provision Cloud Logging sink flow to Chronicle/SCC and validate end-to-end ingestion. | Platform Eng + InfoSec | 1 day | KAD-04_04/21/23 |
| 3 | Add CI security stages for SAST + SCA (and baseline policy gates). | Platform Eng + AppSec | 2 days | KAD-13/28 |
| 4 | Add baseline monitoring alert policies and uptime checks for all critical services. | Platform Eng + SRE | 1-2 days | KAD-41 |

### P1 (Next Sprint)

| # | Action | Owner | Effort | KAD(s) |
|---:|---|---|---|---|
| 5 | Add IaC scanning stage (tfsec/checkov equivalent) in CI. | Platform Eng + AppSec | 1 day | KAD-12 |
| 6 | Define and implement WAF policy set (Cloud Armor) for platform entry points. | Cloud Infra | 1-2 days | KAD-11 |
| 7 | Assign owners/KAD numbers for all proposed Agentic AI KADs and book ARB sequence. | Platform Arch | 2-3 days | Proposed KADs |
| 8 | Finalize Neo4j decision: approve and operationalize, or defer and scope AlloyDB-only MVP. | Platform Arch + Data Arch | 1 day | Graph KAD |
| 9 | Add memory lifecycle controls (erasure API + audit trail). | Platform Eng | 2 days | Agentic Memory |

### P2 (Planned Follow-On)

| # | Action | Owner | Effort | KAD(s) |
|---:|---|---|---|---|
| 10 | Add DAST stage for externally reachable surfaces. | AppSec | 2-3 days | KAD-25 |
| 11 | Add browser RUM instrumentation to agentic client and define SLO dashboards. | Frontend + SRE | 2 days | RUM KAD |
| 12 | Implement conversation-level evaluation + quality score workflows. | Platform Eng | 3-5 days | Appraisal/Evaluation KADs |
| 13 | Validate and implement VPC-SC perimeter controls where required. | Cloud Infra | 1 sprint | KAD-10 |
| 14 | Formalize HA/DR target posture for Redis/AlloyDB and runbook approval. | Cloud Infra + Platform Arch | 1 sprint | KAD-24 |

---

## 5) Current Readiness Snapshot

| Area | Rating |
|---|---|
| Core platform architecture | Green |
| Identity and access model | Green/Amber |
| Security controls and scanning | Amber/Red |
| Logging, SIEM, and monitoring | Amber/Red |
| Data protection and compliance controls | Amber |
| Proposed Agentic AI governance KADs | Amber |

Overall platform readiness is **functionally strong but governance-control incomplete**. The fastest path to compliance lift is to complete P0 security/observability actions and then close P1 governance gaps.
