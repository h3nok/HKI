# ═══════════════════════════════════════════════════════════════════════════════
# AI Platform — Master Deployment Makefile
# Canonical production deployment path is GKE. Cloud Run paths are legacy-only.
#
# Usage (from the repository root):
#   make                                # Show help (default)
#   make gke-deploy                      # Deploy the production stack to GKE
#   make gke-status                      # Show current GKE rollout status
#   make plan-prod DATABASE_URL=...      # Review DB + Terraform changes
#   make release-prod DATABASE_URL=...   # Migrate DB, deploy stack, verify status
#   make gke-deploy-knowledge-api        # Deploy a single service to GKE
#   make gke-deploy-agentic              # Deploy agentic BFF to GKE
#   make security-audit                  # Check for vulnerabilities
#   make security-fix                    # Fix security vulnerabilities
#   DRY_RUN=true make gke-deploy         # Dry run (shows commands, no execution)
#   make test-prod                       # Run canonical GKE production verification
# ═══════════════════════════════════════════════════════════════════════════════

.DEFAULT_GOAL := help

# ── Configuration ─────────────────────────────────────────────────────────────
HUB_PROJECT_ID   ?= p-642-cilab-infrastructure
SPOKE_PROJECT_ID ?= p-642-cilab-demo
REGION           ?= us-west1
REGISTRY_NAME    ?= demo-registry
DRY_RUN          ?= false
SKIP_IMAGE_BUILD ?= false
RELEASE_TAG      ?= release-$(shell git rev-parse --short=12 HEAD 2>/dev/null || echo dev)-$(shell date -u +%Y%m%d%H%M%S)
POST_DEPLOY_CLEANUP_ARGS ?= --apply --delete-synthetic-users --delete-smoke-streams
KNOWLEDGE_API_IMAGE ?=
ORCHESTRATOR_IMAGE ?=
INGESTION_PIPELINE_IMAGE ?=
ANALYTICS_IMAGE ?=
AGENTIC_IMAGE ?=
ALLOW_LEGACY_CLOUD_RUN ?= false
AGENTIC_PUBLIC_URL ?= https://agentic.cilabs.np.cc-hki.com

REGISTRY   := $(REGION)-docker.pkg.dev/$(SPOKE_PROJECT_ID)/$(REGISTRY_NAME)
URLS_FILE  := $(CURDIR)/deploy/deployed-urls.env
AI_PLATFORM_DIR := $(CURDIR)
AGENTIC_DIR := $(CURDIR)/apps/agentic
COMPOSE_DIR := $(CURDIR)/deploy/compose
BUILD_IMAGE_SCRIPT := $(CURDIR)/scripts/build-and-push-image.sh
DEV_STACK_SCRIPT := $(CURDIR)/scripts/dev-stack.sh
GKE_TERRAFORM_SCRIPT := $(CURDIR)/scripts/gke-terraform.sh
DOCKER_COMPOSE := $(shell if command -v docker-compose >/dev/null 2>&1; then printf '%s' docker-compose; else printf '%s' 'docker compose'; fi)
PYTHON_SERVICES := knowledge-api ingestion-pipeline-service orchestrator-service analytics-service

LEGACY_CLOUD_RUN_TARGETS := \
	add-user \
	list-users \
	plan-all \
	plan-knowledge-api \
	plan-orchestrator \
	plan-ingestion-pipeline \
	plan-analytics \
	plan-agentic \
	deploy-all \
	deploy-knowledge-api \
	deploy-orchestrator \
	deploy-ingestion-pipeline \
	deploy-analytics \
	deploy-agentic \
	rollout-runtime \
	rollout-knowledge-api-runtime \
	rollout-orchestrator-runtime \
	rollout-ingestion-pipeline-runtime \
	rollout-analytics-runtime \
	rollout-agentic-runtime

ifneq ($(ALLOW_LEGACY_CLOUD_RUN),true)
ifneq ($(filter $(LEGACY_CLOUD_RUN_TARGETS),$(MAKECMDGOALS)),)
$(error Cloud Run deployment path is retired; use gke-plan, gke-deploy, gke-deploy-knowledge-api, gke-deploy-orchestrator, gke-deploy-ingestion-pipeline, gke-deploy-agentic, gke-status, or scripts/deploy-k8s.sh. Set ALLOW_LEGACY_CLOUD_RUN=true only for break-glass legacy work)
endif
endif

export RELEASE_TAG SKIP_IMAGE_BUILD
export KNOWLEDGE_API_IMAGE ORCHESTRATOR_IMAGE INGESTION_PIPELINE_IMAGE
export ANALYTICS_IMAGE AGENTIC_IMAGE

# Load previously deployed URLs (no error if file doesn't exist)
-include $(URLS_FILE)

# ── Shell helpers ──────────────────────────────────────────────────────────────
SHELL := /bin/bash
.SHELLFLAGS := -Eeuo pipefail -c
.DELETE_ON_ERROR:

# Save a Cloud Run service URL to deploy/deployed-urls.env
define save-url
	@SERVICE_URL=$$(gcloud run services describe $(2) \
		--region=$(REGION) \
		--project=$(SPOKE_PROJECT_ID) \
		--format='value(status.url)' 2>/dev/null || echo ""); \
	if [ -n "$$SERVICE_URL" ]; then \
		if [ -f $(URLS_FILE) ]; then \
			grep -v "^$(1)=" $(URLS_FILE) > $(URLS_FILE).tmp 2>/dev/null || true; \
			mv $(URLS_FILE).tmp $(URLS_FILE); \
		fi; \
		echo "$(1)=$$SERVICE_URL" >> $(URLS_FILE); \
		echo "  Saved $(1)=$$SERVICE_URL"; \
	fi
endef

define save-static-url
	@if [ -f $(URLS_FILE) ]; then \
		grep -v "^$(1)=" $(URLS_FILE) > $(URLS_FILE).tmp 2>/dev/null || true; \
		mv $(URLS_FILE).tmp $(URLS_FILE); \
	fi; \
	echo "$(1)=$(2)" >> $(URLS_FILE); \
	echo "  Saved $(1)=$(2)"
endef

# Check if a Cloud Run service already exists (returns 0 = exists)
define service-exists
$(shell gcloud run services describe $(1) \
	--region=$(REGION) \
	--project=$(SPOKE_PROJECT_ID) \
	--format="value(name)" 2>/dev/null | grep -q "." && echo "true" || echo "false")
endef

# Wait for a Cloud Run service to become ready
define wait-ready
	@echo "  Waiting for $(1) to be ready..."; \
	for i in $$(seq 1 30); do \
		STATUS=$$(gcloud run services describe $(1) \
			--region=$(REGION) \
			--project=$(SPOKE_PROJECT_ID) \
			--format='value(status.conditions[0].status)' 2>/dev/null || echo "False"); \
		if [ "$$STATUS" = "True" ]; then echo "  $(1) is ready"; break; fi; \
		echo -n "."; sleep 2; \
	done
endef

# Run terraform init + apply in a given directory, passing extra vars
define tf-apply
	cd $(1) && \
	terraform init -upgrade -input=false > /dev/null && \
	terraform apply -auto-approve $(2)
endef

# Run terraform init + plan in a given directory, passing extra vars
define tf-plan
	cd $(1) && \
	terraform init -upgrade -input=false > /dev/null && \
	terraform plan $(2)
endef

# ── Phony targets ──────────────────────────────────────────────────────────────
.PHONY: help help-dev help-test help-deploy build deploy post-deploy-cleanup deploy-all status urls \
        deploy-knowledge-api \
        deploy-orchestrator \
        deploy-ingestion-pipeline \
        deploy-analytics \
        deploy-agentic \
	rollout-runtime \
	rollout-knowledge-api-runtime \
	rollout-orchestrator-runtime \
	rollout-ingestion-pipeline-runtime \
	rollout-analytics-runtime \
	rollout-agentic-runtime \
		gke-deploy gke-plan gke-infra gke-import gke-status gke-build gke-apply \
		gke-tf-bootstrap gke-validate observability-bootstrap observability-validate \
		observability-plan observability-apply \
        gke-credentials gke-deploy-skip-build gke-deploy-knowledge-api gke-deploy-orchestrator \
        gke-deploy-ingestion-pipeline gke-deploy-agentic gke-rollout-restart gke-dry-run \
        check-auth \
        audit security-audit security-fix audit-python \
        add-user list-users \
        plan-knowledge-api plan-orchestrator plan-ingestion-pipeline \
		plan-analytics plan-agentic plan-all plan-prod \
        release-prod \
		db-migrate db-migrate-local db-migrate-prod db-migrate-status db-migrate-preflight db-push \
		init-env validate-env install bootstrap clean-workspace \
        dev-knowledge-api dev-knowledge-api-full \
        dev-ingestion dev-orchestrator dev-analytics dev-services dev-preflight dev-full \
        dev-kb-auth dev-kb-auth-stop \
        dev-stop dev-status dev-restart dev-reset \
        infra-up infra-down infra-reset \
        test-services lint-services hki-check hki-audit hki-runtime-check \
        hki-runtime-py-check hki-conformance-check e2e-test test-prod \
		kb-test-setup kb-test-run kb-test-search kb-acl-smoke kb-ui-e2e kb-user-cleanup \
        kb-reset \
        reset-test-db \
        doctor-dev

# ── Help ───────────────────────────────────────────────────────────────────────
# Use firstword so grep runs only on this Makefile; MAKEFILE_LIST can include
# included files (e.g. deploy/deployed-urls.env) which would make grep prefix lines and break awk.
HELP_MAKEFILE := $(firstword $(MAKEFILE_LIST))
help: ## Show this help message
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Deployment Makefile                          ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Configuration (override with env vars):"
	@echo "  HUB_PROJECT_ID   = $(HUB_PROJECT_ID)"
	@echo "  SPOKE_PROJECT_ID = $(SPOKE_PROJECT_ID)"
	@echo "  REGION           = $(REGION)"
	@echo "  REGISTRY_NAME    = $(REGISTRY_NAME)"
	@echo "  DRY_RUN          = $(DRY_RUN)"
	@echo "  SKIP_IMAGE_BUILD = $(SKIP_IMAGE_BUILD)"
	@echo "  RELEASE_TAG      = $(RELEASE_TAG)"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z0-9_.-]+:.*## ' $(HELP_MAKEFILE) \
		| sort -t: -k1,1 \
		| awk 'BEGIN {FS = ":.*## "}; {gsub(/^[ \t]+|[ \t]+$$/, "", $$2); printf "  %-32s %s\n", $$1, $$2}'
	@echo ""
	@echo "Local quick start:  make doctor-dev && make init-env && make validate-env && make install && make dev-full"
	@echo "Deploy quick start: make check-auth && make deploy"
	@echo ""
	@echo "Release workflow:"
	@echo "  make plan-prod DATABASE_URL=...         Review DB status + GKE infrastructure plan"
	@echo "  make observability-plan                 Review Cloud Ops dashboard, metrics, alerts, IAM"
	@echo "  make release-prod DATABASE_URL=...      Run DB migration, deploy GKE stack, verify"
	@echo "  make deploy                             Run canonical GKE deploy + post-deploy cleanup + status"
	@echo "  make gke-deploy-skip-build              Apply manifests when images already exist"
	@echo "  make test-prod                          Run canonical GKE production verification"
	@echo ""
	@echo "User management:"
	@echo "  GKE web access is managed through IAP/domain access and cluster RBAC, not Cloud Run invoker bindings."
	@echo ""
	@echo "Database migrations:"
	@echo "  make db-migrate-local                   Run migrations on local Docker MySQL"
	@echo "  make db-migrate-prod                    Run migrations on production (with safety checks)"
	@echo "  make db-migrate-status                  Check database migration status and show applied migrations"
	@echo "  make db-migrate DATABASE_URL=...        Run migrations on custom database"
	@echo "  make db-push DATABASE_URL=...           Sync schema using Drizzle (development only)"
	@echo ""
	@echo "Local development:"
	@echo "  make doctor-dev       Validate local toolchain"
	@echo "  make init-env         Copy missing local env files and backfill safe defaults"
	@echo "  make validate-env     Validate local env files and common port mismatches"
	@echo "  make install          Install all deps (Python + Node)"
	@echo "  make clean-workspace  Remove safe local caches and generated metadata"
	@echo "  make infra-up         Start Docker infrastructure"
	@echo "  make dev-preflight    Validate service venvs and Python source syntax"
	@echo "  make dev-full         Restart local stack and launch agentic UI"
	@echo "  make dev-services     Restart local background services"
	@echo "  make dev-kb-auth      Start isolated auth-enabled KB validation stack"
	@echo "  make dev-kb-auth-stop Stop isolated auth-enabled KB validation stack"
	@echo "  make dev-restart      Restart local services without relaunching infra"
	@echo "  make dev-reset        Restart Docker infra and local services"
	@echo "  make dev-status       Show local service port status"
	@echo "  make dev-stop         Stop local services and Docker infra"
	@echo "  make test-services    Run pytest for all services"
	@echo "  make lint-services    Run ruff on all services"
	@echo "  make kb-test-run      Run knowledge base evaluation suite"
	@echo "  make kb-acl-smoke     Run auth-enabled legal ACL smoke test"
	@echo "  make kb-ui-e2e        Run browser e2e for value-stream creation and ingest UX"
	@echo "  make kb-user-cleanup  Preview or deactivate duplicate/HVSI KB users (use ARGS=\"--apply\")"
	@echo ""

help-dev: ## Show curated local development commands
	@echo ""
	@echo "Local development commands"
	@echo ""
	@echo "  make doctor-dev"
	@echo "  make init-env"
	@echo "  make validate-env"
	@echo "  make install"
	@echo "  make clean-workspace"
	@echo "  make infra-up"
	@echo "  make dev-services"
	@echo "  make dev-full"
	@echo "  make dev-status"
	@echo "  make dev-stop"
	@echo ""
	@echo "Docs: docs/FIRST_SETUP.md docs/ENV_SETUP.md"
	@echo ""

help-test: ## Show curated testing commands
	@echo ""
	@echo "Testing commands"
	@echo ""
	@echo "  make test-services"
	@echo "  make lint-services"
	@echo "  make hki-check"
	@echo "  make hki-runtime-py-check"
	@echo "  make e2e-test"
	@echo "  make kb-test-run"
	@echo "  make kb-acl-smoke"
	@echo "  make kb-ui-e2e"
	@echo "  make test-prod"
	@echo ""
	@echo "Docs: docs/TESTING.md"
	@echo ""

help-deploy: ## Show curated deployment commands
	@echo ""
	@echo "Deployment commands"
	@echo ""
	@echo "  make check-auth"
	@echo "  make deploy"
	@echo "  make post-deploy-cleanup"
	@echo "  make observability-validate"
	@echo "  make observability-plan"
	@echo "  make observability-apply"
	@echo "  make gke-plan"
	@echo "  make gke-deploy"
	@echo "  make gke-deploy-knowledge-api"
	@echo "  make gke-deploy-orchestrator"
	@echo "  make gke-deploy-ingestion-pipeline"
	@echo "  make gke-deploy-agentic"
	@echo "  make gke-status"
	@echo "  make urls"
	@echo ""
	@echo "Docs: docs/DEPLOYMENT_AUTOMATION.md docs/DEPLOYMENT_CHECKLIST.md"
	@echo ""

# ── Auth check ─────────────────────────────────────────────────────────────────
check-auth: ## Verify gcloud authentication
	@ACCOUNT=$$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null); \
	if [ -z "$$ACCOUNT" ]; then \
		echo "ERROR: Not authenticated. Run: gcloud auth login"; exit 1; \
	fi; \
	echo "  Authenticated as: $$ACCOUNT"

# ── Status ─────────────────────────────────────────────────────────────────────
status: gke-status ## Show canonical GKE deployment status

deploy: check-auth ## Canonical production deploy: GKE rollout + post-deploy cleanup + status
	$(MAKE) gke-deploy
	@if [ "$(DRY_RUN)" = "true" ]; then \
		echo "Skipping post-deploy cleanup and status checks during dry run"; \
	else \
		$(MAKE) post-deploy-cleanup; \
		$(MAKE) gke-status; \
	fi

post-deploy-cleanup: check-auth gke-credentials ## Run KB synthetic user and smoke-stream cleanup after deployment
	@if [ "$(DRY_RUN)" = "true" ]; then \
		echo "Skipping post-deploy KB user cleanup during dry run"; \
		exit 0; \
	fi
	@echo "Running post-deploy KB user cleanup with ARGS='$(POST_DEPLOY_CLEANUP_ARGS)'"
	@$(MAKE) kb-user-cleanup ARGS='$(POST_DEPLOY_CLEANUP_ARGS)'

urls: ## Show canonical public GKE endpoints
	@echo ""
	@echo "Public GKE endpoints:"
	@echo "  AGENTIC_BASE_URL=https://agentic.cilabs.np.cc-hki.com"
	@echo "  LLM_GATEWAY_URL=https://aigateway.cilabs.np.cc-hki.com/v1"
	@echo "  Internal services (knowledge-api, orchestrator, ingestion-pipeline, analytics) run in-cluster."
	@echo ""

# ── Security ───────────────────────────────────────────────────────────────────
audit: security-audit audit-python ## Run full security audit (npm + Python)

security-audit: ## Run pnpm audit to check for vulnerabilities
	@echo ""
	@echo "━━━ Running security audit ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@pnpm audit --audit-level=high 2>&1 | tail -30
	@echo ""
	@echo "For all severities: pnpm audit --audit-level=low"
	@echo "For full report: pnpm audit"
	@echo ""

security-fix: ## Run automated security vulnerability fixes
	@echo ""
	@echo "━━━ Running security fixes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ ! -x $(CURDIR)/scripts/fix-wiz-vulnerabilities.sh ]; then \
		chmod +x $(CURDIR)/scripts/fix-wiz-vulnerabilities.sh; \
	fi
	@$(CURDIR)/scripts/fix-wiz-vulnerabilities.sh
	@echo ""
	@echo "✅ Security fixes complete. Review changes and commit."
	@echo ""

audit-python: ## Audit Python dependencies for vulnerabilities using pip-audit
	@echo ""
	@echo "━━━ Auditing Python dependencies ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ ! -x $(CURDIR)/scripts/audit-python-deps.sh ]; then \
		chmod +x $(CURDIR)/scripts/audit-python-deps.sh; \
	fi
	@$(CURDIR)/scripts/audit-python-deps.sh
	@echo ""
	@echo "✅ Python dependency audit complete."
	@echo ""

# ── User Management ────────────────────────────────────────────────────────────
add-user: check-auth ## [DEPRECATED] Legacy Cloud Run invoker grants — use IAP/domain access controls instead
	@if [ -z "$(USER)" ] || [ "$(USER)" = "" ] || ! echo "$(USER)" | grep -q "@"; then \
		echo "ERROR: USER parameter required with valid email format"; \
		echo "Usage: make add-user USER=email@hki.com"; \
		echo "       make add-user USER=\"user1@hki.com user2@hki.com\""; \
		exit 1; \
	fi
	@echo ""
	@echo "━━━ Adding users to Cloud Run services ━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Project: $(SPOKE_PROJECT_ID)"
	@echo "  Region:  $(REGION)"
	@echo ""
	@SERVICES=("agentic-bff" "demo" "analytics-service" "knowledge-api" "orchestrator-service" "ingestion-pipeline-service"); \
	for user_email in $(USER); do \
		echo "Adding user: $$user_email"; \
		for service in "$${SERVICES[@]}"; do \
			echo "  → $$service"; \
			gcloud run services add-iam-policy-binding "$$service" \
				--project="$(SPOKE_PROJECT_ID)" \
				--region="$(REGION)" \
				--member="user:$$user_email" \
				--role="roles/run.invoker" \
				--quiet 2>/dev/null || echo "    ⚠️  Already exists or error"; \
		done; \
		echo ""; \
	done
	@echo "✅ Users added to Cloud Run services."
	@echo ""
	@echo "Note: Users may still need IAP access for web domains (*.cilabs.np.cc-hki.com)."
	@echo "      Contact project admins for IAP permissions or add to group:"
	@echo "      gco-iam-grp-innovationlab-editor-lb@hki.com"
	@echo ""

list-users: check-auth ## [DEPRECATED] Legacy Cloud Run invoker visibility — use IAP/domain access controls instead
	@echo ""
	@echo "━━━ Cloud Run Service Access ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Project: $(SPOKE_PROJECT_ID)"
	@echo "  Region:  $(REGION)"
	@echo ""
	@SERVICES=("agentic-bff" "demo" "analytics-service" "knowledge-api" "orchestrator-service" "ingestion-pipeline-service"); \
	for service in "$${SERVICES[@]}"; do \
		echo "Service: $$service"; \
		gcloud run services get-iam-policy "$$service" \
			--project="$(SPOKE_PROJECT_ID)" \
			--region="$(REGION)" \
			--format="table(bindings.members.flatten():label='MEMBERS',bindings.role:label='ROLE')" \
			--filter="bindings.role:roles/run.invoker" 2>/dev/null || echo "  ⚠️  Service not found or no access"; \
		echo ""; \
	done
	@echo "Note: This shows Cloud Run invoker access only. IAP access (for web domains) is managed separately."
	@echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1 — Knowledge API
# ═══════════════════════════════════════════════════════════════════════════════
plan-knowledge-api: check-auth ## [DEPRECATED] Legacy Cloud Run plan — use gke-plan
	@echo ""
	@echo "━━━ PLAN 1: knowledge-api ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@$(call tf-plan,$(AI_PLATFORM_DIR)/services/knowledge-api/tf,\
		$(if $(strip $(KNOWLEDGE_API_IMAGE)),-var="container_image=$(KNOWLEDGE_API_IMAGE)"))
	$(call save-url,KNOWLEDGE_API_URL,knowledge-api)

deploy-knowledge-api: check-auth ## [DEPRECATED] Legacy Cloud Run deploy — use gke-deploy-knowledge-api
	@echo ""
	@echo "━━━ STEP 1: Deploying knowledge-api ━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would build and deploy knowledge-api"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   KNOWLEDGE_API_IMAGE=$(KNOWLEDGE_API_IMAGE)"
else
	@IMAGE="$(KNOWLEDGE_API_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building knowledge-api image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" knowledge-api services/knowledge-api/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "  Skipping knowledge-api image build (SKIP_IMAGE_BUILD=true)"; \
	fi; \
	if [ -n "$$IMAGE" ]; then \
		echo "  Using knowledge-api image: $$IMAGE"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/knowledge-api/tf,-var="container_image=$$IMAGE"); \
	else \
		echo "  Using knowledge-api Terraform default image reference"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/knowledge-api/tf,); \
	fi
	$(call wait-ready,knowledge-api)
	$(call save-url,KNOWLEDGE_API_URL,knowledge-api)
	@echo "  knowledge-api deployed successfully"
endif

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2 — Orchestrator Service
# ═══════════════════════════════════════════════════════════════════════════════
plan-orchestrator: check-auth ## Show Terraform plan for Orchestrator Service
	@echo ""
	@echo "━━━ PLAN 2: orchestrator-service ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -z "$(KNOWLEDGE_API_URL)" ]; then \
		echo "ERROR: KNOWLEDGE_API_URL not set. Run 'make plan-knowledge-api' first or load $(URLS_FILE)."; exit 1; \
	fi
	@$(call tf-plan,$(AI_PLATFORM_DIR)/services/orchestrator-service/tf,\
		$(if $(strip $(ORCHESTRATOR_IMAGE)),-var="container_image=$(ORCHESTRATOR_IMAGE)") \
		-var="knowledge_api_url=$(KNOWLEDGE_API_URL)")
	$(call save-url,ORCHESTRATOR_URL,orchestrator-service)

deploy-orchestrator: check-auth ## [DEPRECATED] Legacy Cloud Run deploy — use gke-deploy-orchestrator
	@echo ""
	@echo "━━━ STEP 2: Deploying orchestrator-service ━━━━━━━━━━━━━━━━━━━━━"
	@if [ -z "$(KNOWLEDGE_API_URL)" ]; then \
		echo "ERROR: KNOWLEDGE_API_URL not set. Run 'make deploy-knowledge-api' first or set the var."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would build and deploy orchestrator-service"
	@echo "[DRY RUN]   KNOWLEDGE_API_URL=$(KNOWLEDGE_API_URL)"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   ORCHESTRATOR_IMAGE=$(ORCHESTRATOR_IMAGE)"
else
	@IMAGE="$(ORCHESTRATOR_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building orchestrator-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" orchestrator-service services/orchestrator-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "  Skipping orchestrator-service image build (SKIP_IMAGE_BUILD=true)"; \
	fi; \
	if [ -n "$$IMAGE" ]; then \
		echo "  Using orchestrator-service image: $$IMAGE"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/orchestrator-service/tf,\
			-var="container_image=$$IMAGE" \
			-var="knowledge_api_url=$(KNOWLEDGE_API_URL)"); \
	else \
		echo "  Using orchestrator-service Terraform default image reference"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/orchestrator-service/tf,\
			-var="knowledge_api_url=$(KNOWLEDGE_API_URL)"); \
	fi
	$(call wait-ready,orchestrator-service)
	$(call save-url,ORCHESTRATOR_URL,orchestrator-service)
	@echo "  orchestrator-service deployed successfully"
endif

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3 — Ingestion Pipeline Service
# ═══════════════════════════════════════════════════════════════════════════════
plan-ingestion-pipeline: check-auth ## Show Terraform plan for Ingestion Pipeline
	@echo ""
	@echo "━━━ PLAN 3: ingestion-pipeline-service ━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ -z "$(KNOWLEDGE_API_URL)" ]; then \
		echo "ERROR: KNOWLEDGE_API_URL not set. Run 'make plan-knowledge-api' first or load $(URLS_FILE)."; exit 1; \
	fi
	@$(call tf-plan,$(AI_PLATFORM_DIR)/services/ingestion-pipeline-service/tf,\
		$(if $(strip $(INGESTION_PIPELINE_IMAGE)),-var="container_image=$(INGESTION_PIPELINE_IMAGE)") \
		-var="knowledge_api_url=$(KNOWLEDGE_API_URL)")
	$(call save-url,INGESTION_PIPELINE_URL,ingestion-pipeline-service)

deploy-ingestion-pipeline: check-auth ## [DEPRECATED] Legacy Cloud Run deploy — use gke-deploy-ingestion-pipeline
	@echo ""
	@echo "━━━ STEP 3: Deploying ingestion-pipeline-service ━━━━━━━━━━━━━━━"
	@if [ -z "$(KNOWLEDGE_API_URL)" ]; then \
		echo "ERROR: KNOWLEDGE_API_URL not set. Run 'make deploy-knowledge-api' first or set the var."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would build and deploy ingestion-pipeline-service"
	@echo "[DRY RUN]   KNOWLEDGE_API_URL=$(KNOWLEDGE_API_URL)"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   INGESTION_PIPELINE_IMAGE=$(INGESTION_PIPELINE_IMAGE)"
else
	@IMAGE="$(INGESTION_PIPELINE_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building ingestion-pipeline-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" ingestion-pipeline-service services/ingestion-pipeline-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "  Skipping ingestion-pipeline-service image build (SKIP_IMAGE_BUILD=true)"; \
	fi; \
	if [ -n "$$IMAGE" ]; then \
		echo "  Using ingestion-pipeline-service image: $$IMAGE"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/ingestion-pipeline-service/tf,\
			-var="container_image=$$IMAGE" \
			-var="knowledge_api_url=$(KNOWLEDGE_API_URL)"); \
	else \
		echo "  Using ingestion-pipeline-service Terraform default image reference"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/ingestion-pipeline-service/tf,\
			-var="knowledge_api_url=$(KNOWLEDGE_API_URL)"); \
	fi
	$(call wait-ready,ingestion-pipeline-service)
	$(call save-url,INGESTION_PIPELINE_URL,ingestion-pipeline-service)
	@echo "  ingestion-pipeline-service deployed successfully"
endif

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 4 — Analytics Service
# ═══════════════════════════════════════════════════════════════════════════════
plan-analytics: check-auth ## Show Terraform plan for Analytics Service
	@echo ""
	@echo "━━━ PLAN 4: analytics-service ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@$(call tf-plan,$(AI_PLATFORM_DIR)/services/analytics-service/tf,\
		$(if $(strip $(ANALYTICS_IMAGE)),-var="container_image=$(ANALYTICS_IMAGE)"))
	$(call save-url,ANALYTICS_URL,analytics-service)

deploy-analytics: check-auth ## [DEPRECATED] Legacy Cloud Run deploy — use scripts/deploy-k8s.sh or gke-deploy
	@echo ""
	@echo "━━━ STEP 4: Deploying analytics-service ━━━━━━━━━━━━━━━━━━━━━━━━━"
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would build and deploy analytics-service"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   ANALYTICS_IMAGE=$(ANALYTICS_IMAGE)"
else
	@IMAGE="$(ANALYTICS_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building analytics-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" analytics-service services/analytics-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "  Skipping analytics-service image build (SKIP_IMAGE_BUILD=true)"; \
	fi; \
	if [ -n "$$IMAGE" ]; then \
		echo "  Using analytics-service image: $$IMAGE"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/analytics-service/tf,-var="container_image=$$IMAGE"); \
	else \
		echo "  Using analytics-service Terraform default image reference"; \
		$(call tf-apply,$(AI_PLATFORM_DIR)/services/analytics-service/tf,); \
	fi
	$(call wait-ready,analytics-service)
	$(call save-url,ANALYTICS_URL,analytics-service)
	@echo "  analytics-service deployed successfully"
endif

# ═══════════════════════════════════════════════════════════════════════════════
# STEP 5 — Agentic BFF
# ═══════════════════════════════════════════════════════════════════════════════
plan-agentic: check-auth ## Agentic Cloud Run Terraform removed; record canonical GKE URL
	@echo ""
	@echo "━━━ PLAN 5: agentic-bff (GKE canonical URL) ━━━━━━━━━━━━━━━━━━"
	@echo "  Agentic no longer has a service-local Terraform directory."
	@echo "  Use 'make gke-deploy-agentic' or scripts/deploy-k8s.sh for rollouts."
	$(call save-static-url,AGENTIC_URL,$(AGENTIC_PUBLIC_URL))

deploy-agentic: check-auth ## Agentic legacy Cloud Run deploy removed; record canonical GKE URL
	@echo ""
	@echo "━━━ STEP 5: Agentic uses the canonical GKE deployment path ━━━"
	@echo "  No legacy Cloud Run Terraform apply was performed."
	@echo "  Use 'make gke-deploy-agentic' for an actual rollout."
	$(call save-static-url,AGENTIC_URL,$(AGENTIC_PUBLIC_URL))

# ═══════════════════════════════════════════════════════════════════════════════
# Runtime-only Cloud Run rollouts (for existing services when infra already exists)
# ═══════════════════════════════════════════════════════════════════════════════
rollout-runtime: rollout-knowledge-api-runtime rollout-orchestrator-runtime rollout-ingestion-pipeline-runtime rollout-analytics-runtime rollout-agentic-runtime ## [DEPRECATED] Legacy Cloud Run image rollout path
	@echo ""
	@echo "✅ Runtime-only rollout complete"

rollout-knowledge-api-runtime: check-auth ## Update knowledge-api image on an existing Cloud Run service
	@echo ""
	@echo "━━━ Runtime rollout: knowledge-api ━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ "$(call service-exists,knowledge-api)" != "true" ]; then \
		echo "ERROR: knowledge-api does not exist. Use 'make deploy-knowledge-api' for first-time provisioning."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would update knowledge-api Cloud Run image only"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   KNOWLEDGE_API_IMAGE=$(KNOWLEDGE_API_IMAGE)"
else
	@IMAGE="$(KNOWLEDGE_API_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building knowledge-api image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" knowledge-api services/knowledge-api/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "ERROR: SKIP_IMAGE_BUILD=true requires KNOWLEDGE_API_IMAGE to be set"; exit 1; \
	fi; \
	echo "  Updating knowledge-api to image: $$IMAGE"; \
	gcloud run services update knowledge-api \
		--image="$$IMAGE" \
		--region="$(REGION)" \
		--project="$(SPOKE_PROJECT_ID)" \
		--quiet
	$(call wait-ready,knowledge-api)
	$(call save-url,KNOWLEDGE_API_URL,knowledge-api)
	@echo "  knowledge-api runtime rollout complete"
endif

rollout-orchestrator-runtime: check-auth ## Update orchestrator-service image on an existing Cloud Run service
	@echo ""
	@echo "━━━ Runtime rollout: orchestrator-service ━━━━━━━━━━━━━━━━━━━━"
	@if [ "$(call service-exists,orchestrator-service)" != "true" ]; then \
		echo "ERROR: orchestrator-service does not exist. Use 'make deploy-orchestrator' for first-time provisioning."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would update orchestrator-service Cloud Run image only"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   ORCHESTRATOR_IMAGE=$(ORCHESTRATOR_IMAGE)"
else
	@IMAGE="$(ORCHESTRATOR_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building orchestrator-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" orchestrator-service services/orchestrator-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "ERROR: SKIP_IMAGE_BUILD=true requires ORCHESTRATOR_IMAGE to be set"; exit 1; \
	fi; \
	echo "  Updating orchestrator-service to image: $$IMAGE"; \
	gcloud run services update orchestrator-service \
		--image="$$IMAGE" \
		--region="$(REGION)" \
		--project="$(SPOKE_PROJECT_ID)" \
		--quiet
	$(call wait-ready,orchestrator-service)
	$(call save-url,ORCHESTRATOR_URL,orchestrator-service)
	@echo "  orchestrator-service runtime rollout complete"
endif

rollout-ingestion-pipeline-runtime: check-auth ## Update ingestion-pipeline-service image on an existing Cloud Run service
	@echo ""
	@echo "━━━ Runtime rollout: ingestion-pipeline-service ━━━━━━━━━━━━━━"
	@if [ "$(call service-exists,ingestion-pipeline-service)" != "true" ]; then \
		echo "ERROR: ingestion-pipeline-service does not exist. Use 'make deploy-ingestion-pipeline' for first-time provisioning."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would update ingestion-pipeline-service Cloud Run image only"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   INGESTION_PIPELINE_IMAGE=$(INGESTION_PIPELINE_IMAGE)"
else
	@IMAGE="$(INGESTION_PIPELINE_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building ingestion-pipeline-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" ingestion-pipeline-service services/ingestion-pipeline-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "ERROR: SKIP_IMAGE_BUILD=true requires INGESTION_PIPELINE_IMAGE to be set"; exit 1; \
	fi; \
	echo "  Updating ingestion-pipeline-service to image: $$IMAGE"; \
	gcloud run services update ingestion-pipeline-service \
		--image="$$IMAGE" \
		--region="$(REGION)" \
		--project="$(SPOKE_PROJECT_ID)" \
		--quiet
	$(call wait-ready,ingestion-pipeline-service)
	$(call save-url,INGESTION_PIPELINE_URL,ingestion-pipeline-service)
	@echo "  ingestion-pipeline-service runtime rollout complete"
endif

rollout-analytics-runtime: check-auth ## Update analytics-service image on an existing Cloud Run service
	@echo ""
	@echo "━━━ Runtime rollout: analytics-service ━━━━━━━━━━━━━━━━━━━━━━━━"
	@if [ "$(call service-exists,analytics-service)" != "true" ]; then \
		echo "ERROR: analytics-service does not exist. Use 'make deploy-analytics' for first-time provisioning."; exit 1; \
	fi
ifeq ($(DRY_RUN),true)
	@echo "[DRY RUN] Would update analytics-service Cloud Run image only"
	@echo "[DRY RUN]   RELEASE_TAG=$(RELEASE_TAG)"
	@echo "[DRY RUN]   ANALYTICS_IMAGE=$(ANALYTICS_IMAGE)"
else
	@IMAGE="$(ANALYTICS_IMAGE)"; \
	if [ -z "$$IMAGE" ] && [ "$(SKIP_IMAGE_BUILD)" != "true" ]; then \
		echo "  Building analytics-service image for release tag $(RELEASE_TAG)..."; \
		IMAGE="$$( "$(BUILD_IMAGE_SCRIPT)" analytics-service services/analytics-service/Dockerfile "$(AI_PLATFORM_DIR)" "$(REGISTRY)" "$(RELEASE_TAG)" )"; \
	elif [ "$(SKIP_IMAGE_BUILD)" = "true" ]; then \
		echo "ERROR: SKIP_IMAGE_BUILD=true requires ANALYTICS_IMAGE to be set"; exit 1; \
	fi; \
	echo "  Updating analytics-service to image: $$IMAGE"; \
	gcloud run services update analytics-service \
		--image="$$IMAGE" \
		--region="$(REGION)" \
		--project="$(SPOKE_PROJECT_ID)" \
		--quiet
	$(call wait-ready,analytics-service)
	$(call save-url,ANALYTICS_URL,analytics-service)
	@echo "  analytics-service runtime rollout complete"
endif

rollout-agentic-runtime: check-auth ## Agentic Cloud Run runtime rollout removed; use gke-deploy-agentic
	@echo ""
	@echo "━━━ Runtime rollout: agentic-bff (removed Cloud Run path) ━━━━"
	@echo "  No Cloud Run rollout was performed."
	@echo "  Use 'make gke-deploy-agentic' for the current rollout path."
	$(call save-static-url,AGENTIC_URL,$(AGENTIC_PUBLIC_URL))

# ═══════════════════════════════════════════════════════════════════════════════
# LOCAL DEVELOPMENT
# Run from the repository root
#
# Ports:
#   knowledge-api       :9509   ingestion-pipeline  :9508
#   orchestrator        :9501   analytics-service   :9510
#   MySQL               :9306   Redis               :9379
#   PostgreSQL          :9432   Neo4j               :9687
#   LiteLLM             :4000
#   Pub/Sub emulator    :9085
# ═══════════════════════════════════════════════════════════════════════════════

# ── Build ─────────────────────────────────────────────────────────────────────
build: ## Build all Node packages (ui, chat, agentic)
	pnpm run build

# ── Bootstrap ──────────────────────────────────────────────────────────────────
init-env: ## Copy missing local .env files and backfill safe local defaults
	@bash "$(CURDIR)/scripts/init-env.sh"

validate-env: ## Validate required local .env files and common port mismatches
	@bash "$(CURDIR)/scripts/validate-env.sh"

install: bootstrap ## Install all dependencies (Python + Node) — alias for full setup
	@echo "Installing Node dependencies..."
	cd "$(AGENTIC_DIR)" && pnpm install
	@echo ""
	@echo "All dependencies installed. Run 'make dev-full' to start the stack."

bootstrap: ## Install Python dependencies for all ai-platform services (uv sync)
	@echo "Installing Python dependencies..."
	@for svc in $(PYTHON_SERVICES); do \
		echo "  $$svc"; \
		(cd "services/$$svc" && uv sync --extra dev); \
	done
	@echo "Python deps installed (4 services)"

clean-workspace: ## Remove safe local caches, generated metadata, and stray OS files
	@find "$(CURDIR)" -type d \( -name '__pycache__' -o -name '.pytest_cache' -o -name '.mypy_cache' -o -name '.ruff_cache' -o -name '.turbo' -o -name '*.egg-info' \) -prune -exec rm -rf {} +
	@find "$(CURDIR)" -type f \( -name '.DS_Store' -o -name '*.pyc' -o -name '*.pyo' -o -name '*.pyd' \) -delete
	@rm -rf "$(CURDIR)/orchestrator-service/build" "$(CURDIR)/.tmp" "$(CURDIR)/.dev" "$(AGENTIC_DIR)/.dev"
	@echo "Removed local caches and generated metadata under the repository"

# ── Local Infrastructure ───────────────────────────────────────────────────────
infra-up: ## Start local dev infrastructure (PostgreSQL, Redis, MySQL, LiteLLM)
	cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) up -d
	@sleep 3
	@cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) ps

infra-down: ## Stop local dev infrastructure
	cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) down

infra-reset: ## Nuke volumes and restart infrastructure
	cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) down -v --remove-orphans
	@docker volume prune -f 2>/dev/null || true
	cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) up -d
	@sleep 3
	@cd "$(COMPOSE_DIR)" && $(DOCKER_COMPOSE) ps
	@echo "Infrastructure reset"

KB_API_URL ?= http://localhost:9509

kb-reset: ## Clear all documents from the knowledge base (vector store + pipeline jobs + review records)
	@echo "Resetting knowledge base..."
	@echo "── Deleting all vector store documents ──"
	@docs_json=$$(curl -sf "$(KB_API_URL)/v1/documents" 2>/dev/null) || { \
		echo "  Knowledge API not reachable (skipped)"; \
		docs_json=""; \
	}; \
	doc_ids=$$(printf '%s' "$$docs_json" \
		| python3 -c "import sys,json; [print(d['id']) for d in json.load(sys.stdin).get('documents',[])]" 2>/dev/null || true); \
	if [ -z "$$docs_json" ]; then \
		:; \
	elif [ -z "$$doc_ids" ]; then \
		echo "  No documents found — already clean"; \
	else \
		count=0; \
		for id in $$doc_ids; do \
			curl -sf -X DELETE "$(KB_API_URL)/v1/documents/$$id" >/dev/null 2>&1 \
			&& count=$$((count + 1)); \
		done; \
		echo "  Deleted $$count document(s)"; \
	fi
	@echo "── Clearing pipeline jobs ──"
	@curl -sf "http://localhost:9508/v1/jobs" 2>/dev/null \
		| python3 -c "import sys,json; d=json.load(sys.stdin); print(f'  {len(d.get(\"jobs\",d.get(\"items\",[])))} job(s) in store (will expire via TTL)')" 2>/dev/null \
	|| echo "  Pipeline not reachable (skipped)"
	@echo "── Clearing review records ──"
	@curl -sf "http://localhost:9508/v1/review/history" 2>/dev/null \
		| python3 -c "import sys,json; d=json.load(sys.stdin); items=d if isinstance(d,list) else d.get(\"items\",[]); print(f'  {len(items)} review record(s) in store')" 2>/dev/null \
	|| echo "  Pipeline not reachable (skipped)"
	@echo ""
	@echo "Knowledge base reset complete."
	@echo "Tip: Upload fresh content via the UI or run 'make kb-test-setup'"

reset-test-db: ## Wipe all KB data, value streams, conversations, traces from local Docker MySQL
	@echo "═══════════════════════════════════════════════════════"
	@echo "  Resetting local test database"
	@echo "═══════════════════════════════════════════════════════"
	@if ! docker ps | grep -q hki-mysql; then \
		echo "ERROR: hki-mysql container is not running."; \
		echo "Start it with: make infra-up"; \
		exit 1; \
	fi
	@echo "── Truncating knowledge tables ──"
	@docker exec hki-mysql mysql -u root -proot retail_agentic -e "\
		SET FOREIGN_KEY_CHECKS = 0; \
		TRUNCATE TABLE knowledgeAgentEvalRuns; \
		TRUNCATE TABLE knowledgeAttestations; \
		TRUNCATE TABLE knowledgeBadges; \
		TRUNCATE TABLE knowledgeCollections; \
		TRUNCATE TABLE knowledgeConnectorSyncs; \
		TRUNCATE TABLE knowledgeConnectors; \
		TRUNCATE TABLE knowledgeContributions; \
		TRUNCATE TABLE knowledgeDocumentImpact; \
		TRUNCATE TABLE knowledgeEvalSuites; \
		TRUNCATE TABLE knowledgeGapSnapshots; \
		TRUNCATE TABLE knowledgeInvites; \
		TRUNCATE TABLE knowledgeJourneyProgress; \
		TRUNCATE TABLE knowledgeProfiles; \
		TRUNCATE TABLE knowledgeReleases; \
		TRUNCATE TABLE knowledgeStreamScores; \
		SET FOREIGN_KEY_CHECKS = 1; \
	" 2>/dev/null && echo "  Done" || echo "  Warning: some tables may not exist yet (OK)"
	@echo "── Truncating value streams + user assignments ──"
	@docker exec hki-mysql mysql -u root -proot retail_agentic -e "\
		SET FOREIGN_KEY_CHECKS = 0; \
		TRUNCATE TABLE userValueStreams; \
		TRUNCATE TABLE valueStreams; \
		SET FOREIGN_KEY_CHECKS = 1; \
	" 2>/dev/null && echo "  Done"
	@echo "── Truncating conversations + messages ──"
	@docker exec hki-mysql mysql -u root -proot retail_agentic -e "\
		SET FOREIGN_KEY_CHECKS = 0; \
		TRUNCATE TABLE messages; \
		TRUNCATE TABLE conversations; \
		SET FOREIGN_KEY_CHECKS = 1; \
	" 2>/dev/null && echo "  Done"
	@echo "── Truncating traces + tool executions ──"
	@docker exec hki-mysql mysql -u root -proot retail_agentic -e "\
		SET FOREIGN_KEY_CHECKS = 0; \
		TRUNCATE TABLE thoughtTraceSteps; \
		TRUNCATE TABLE toolExecutions; \
		SET FOREIGN_KEY_CHECKS = 1; \
	" 2>/dev/null && echo "  Done"
	@echo "── Truncating audit log + access requests ──"
	@docker exec hki-mysql mysql -u root -proot retail_agentic -e "\
		SET FOREIGN_KEY_CHECKS = 0; \
		TRUNCATE TABLE auditLog; \
		TRUNCATE TABLE accessRequests; \
		SET FOREIGN_KEY_CHECKS = 1; \
	" 2>/dev/null && echo "  Done"
	@echo "── Clearing vector store (if KB API is running) ──"
	@$(MAKE) kb-reset 2>/dev/null || echo "  KB API not reachable — skip vector store cleanup"
	@echo ""
	@echo "✔ Test database reset complete."
	@echo "  Users and schema migrations preserved."
	@echo "  Run 'make kb-test-setup' to seed fresh test data."

# ── Database Migration Targets ─────────────────────────────────────────────────
# Requires DATABASE_URL env var pointing at MySQL (local or Cloud SQL via proxy).
# Local:   DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic make db-push
# Cloud:   Start cloud-sql-proxy, then:
#          DATABASE_URL=mysql://root:PASSWORD@127.0.0.1:13306/retail_agentic make db-migrate

db-migrate-status: ## Check database migration status and show applied migrations
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "Checking local Docker MySQL migration status..."; \
		if docker ps | grep -q hki-mysql; then \
			cd "$(AGENTIC_DIR)" && DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic pnpm db:migrate:status; \
		else \
			echo "ERROR: No DATABASE_URL provided and local MySQL not running."; \
			echo "Examples:"; \
			echo "  make infra-up && make db-migrate-status"; \
			echo "  DATABASE_URL=mysql://user:pass@host:port/db make db-migrate-status"; \
			exit 1; \
		fi; \
	else \
		cd "$(AGENTIC_DIR)" && DATABASE_URL="$(DATABASE_URL)" pnpm db:migrate:status; \
	fi

db-migrate-preflight: ## Validate migration state and auto-apply pending migrations
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "Checking local Docker MySQL migration preflight..."; \
		if docker ps | grep -q hki-mysql; then \
			cd "$(AGENTIC_DIR)" && DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic pnpm db:migrate:preflight; \
		else \
			echo "ERROR: No DATABASE_URL provided and local MySQL not running."; \
			echo "Examples:"; \
			echo "  make infra-up && make db-migrate-preflight"; \
			echo "  DATABASE_URL=mysql://user:pass@host:port/db make db-migrate-preflight"; \
			exit 1; \
		fi; \
	else \
		cd "$(AGENTIC_DIR)" && DATABASE_URL="$(DATABASE_URL)" pnpm db:migrate:preflight; \
	fi

db-migrate-local: ## Run migrations against local Docker MySQL (auto-detects connection)
	@if ! docker ps | grep -q hki-mysql; then \
		echo "ERROR: Local MySQL container not running. Start with: make infra-up"; \
		exit 1; \
	fi
	@echo "Running migrations against local Docker MySQL..."
	@DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic $(MAKE) db-migrate
	@echo "✅ Local migrations complete"

db-migrate: ## Run tracked schema migrations against DATABASE_URL
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is required. Examples:"; \
		echo "  DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic make db-migrate"; \
		echo "  Or use: make db-migrate-local (auto-detects local Docker)"; \
		exit 1; \
	fi
	@cd "$(AGENTIC_DIR)" && DATABASE_URL="$(DATABASE_URL)" pnpm db:migrate

db-migrate-prod: ## Run migrations against production database with safety checks
	@echo "🚨 PRODUCTION MIGRATION - Please confirm the following:"
	@echo "  DATABASE_URL is set"
	@echo ""
	@read -p "Proceed with production migration? [y/N]: " confirm; \
	if [ "$$confirm" != "y" ] && [ "$$confirm" != "Y" ]; then \
		echo "Migration aborted."; exit 1; \
	fi
	@echo "Creating backup recommendation..."
	@echo "⚠️  RECOMMENDED: Create database backup before proceeding"
	@echo "   gcloud sql backups create --instance=agentic-db --project=p-642-cilab-demo"
	@read -p "Continue without backup verification? [y/N]: " confirm2; \
	if [ "$$confirm2" != "y" ] && [ "$$confirm2" != "Y" ]; then \
		echo "Migration aborted. Create backup first."; exit 1; \
	fi
	@echo "Running production migration..."
	@$(MAKE) db-migrate
	@echo "✅ Production migration complete"

db-push: ## Run drizzle-kit push to sync schema to DATABASE_URL (interactive)
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is required."; exit 1; \
	fi
	cd "$(AGENTIC_DIR)" && DATABASE_URL=$(DATABASE_URL) pnpm db:push

# ── Service Dev Targets ────────────────────────────────────────────────────────
dev-knowledge-api: ## Run Knowledge API on :9509 (requires infra-up)
	cd services/knowledge-api && unset __PYVENV_LAUNCHER__ && \
		ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \
		ENVIRONMENT=development \
		HKI_DEV_RUNTIME_SCOPE=dev \
		KB_HERMETIC_ISOLATION=true \
		PYTHONPATH="$(CURDIR)/packages/shared-py:$${PYTHONPATH:-}" \
		uv run uvicorn src.api.app:app --reload --port 9509 --reload-dir src

dev-knowledge-api-full: ## Run Knowledge API with Neo4j on :9509
	cd services/knowledge-api && unset __PYVENV_LAUNCHER__ && \
		ALLOYDB_URL=postgresql://postgres:postgres@localhost:9432/knowledge \
		NEO4J_URI=bolt://localhost:9687 \
		NEO4J_PASSWORD=knowledge \
		ENTITY_EXTRACTION_ENABLED=true \
		ENVIRONMENT=development \
		HKI_DEV_RUNTIME_SCOPE=dev \
		KB_HERMETIC_ISOLATION=true \
		PYTHONPATH="$(CURDIR)/packages/shared-py:$${PYTHONPATH:-}" \
		uv run uvicorn src.api.app:app --reload --port 9509 --reload-dir src

dev-ingestion: ## Run Ingestion Pipeline Service on :9508 (requires infra-up)
	@lsof -ti :9508 | xargs kill -9 2>/dev/null || true
	cd services/ingestion-pipeline-service && set -a && [ -f .env ] && . .env; set +a && unset __PYVENV_LAUNCHER__ && \
		KNOWLEDGE_API_URL=http://localhost:9509 \
		AUTH_ENABLED=false \
		ENVIRONMENT=development \
		HKI_DEV_RUNTIME_SCOPE=dev \
		KB_HERMETIC_ISOLATION=true \
		PYTHONPATH="$(CURDIR)/packages/shared-py:$${PYTHONPATH:-}" \
		uv run uvicorn src.api.app:app --reload --port 9508 --reload-dir src

dev-orchestrator: ## Run Orchestrator Service on :9501 (requires infra-up)
	cd services/orchestrator-service && set -a && [ -f .env ] && . .env; set +a && unset __PYVENV_LAUNCHER__ && \
		REDIS_URL=redis://localhost:9379/0 \
		AUTH_ENABLED=false \
		PYTHONPATH="$(CURDIR)/packages/shared-py:$${PYTHONPATH:-}" \
		uv run uvicorn src.api.app:app --reload --port 9501 --reload-dir src

dev-analytics: ## Run Analytics Service on :9510
	cd services/analytics-service && set -a && [ -f .env ] && . .env; set +a && unset __PYVENV_LAUNCHER__ && \
		ENVIRONMENT=development \
		PYTHONPATH="$(CURDIR)/packages/shared-py:$${PYTHONPATH:-}" \
		uv run uvicorn src.api.app:app --reload --port 9510 --reload-dir src

dev-services: ## Restart local background services (infra + Python services)
	@bash "$(DEV_STACK_SCRIPT)" start-services

dev-preflight: ## Validate Python service venvs and source syntax before startup
	@bash "$(DEV_STACK_SCRIPT)" preflight

dev-kb-auth: ## Start isolated auth-enabled KB validation stack on :9608/:9609
	@bash "$(DEV_STACK_SCRIPT)" start-kb-auth

dev-kb-auth-stop: ## Stop isolated auth-enabled KB validation stack
	@bash "$(DEV_STACK_SCRIPT)" stop-kb-auth

dev-full: ## Restart local stack and launch agentic UI in foreground
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Full Local Stack                             ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@bash "$(DEV_STACK_SCRIPT)" start-full
	@echo "  Checking agentic database migrations..."
	@$(MAKE) db-migrate-preflight
	@echo "  Logs: $(CURDIR)/.dev/logs"
	@command -v open >/dev/null 2>&1 && open http://localhost:9001 >/dev/null 2>&1 || true
	@echo ""
	@echo "  Starting agentic UI on :9001 (Ctrl+C to stop UI — backend stays running)"
	@echo "  Agentic landing :9001"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	cd "$(AGENTIC_DIR)" && \
		SERVICE_AUTH_SECRET="$${SERVICE_AUTH_SECRET:-local-dev-secret-key-12345}" \
		JWT_SECRET="$${JWT_SECRET:-local-dev-jwt-secret-67890}" \
		KB_HERMETIC_ISOLATION=true \
		DB_AUTO_MIGRATE=false \
		pnpm dev

dev-stop: ## Stop local services and Docker infra
	@bash "$(DEV_STACK_SCRIPT)" stop-all
	@echo "Stopped"

dev-restart: ## Restart local services without restarting Docker infra
	@bash "$(DEV_STACK_SCRIPT)" restart

dev-reset: ## Restart Docker infra and local services
	@bash "$(DEV_STACK_SCRIPT)" reset

# ── Quality ────────────────────────────────────────────────────────────────────
test-services: ## Run pytest for all ai-platform services
	@status=0; \
	for svc in $(PYTHON_SERVICES); do \
		echo "  Testing $$svc..."; \
		if ! (cd services/$$svc && PYTHONPATH="$(CURDIR)" AUTH_ENABLED=false uv run pytest tests/ -x --tb=short); then \
			echo "  ✗ $$svc tests failed"; \
			status=1; \
		fi; \
	done; \
	exit $$status

lint-services: ## Run ruff linter on all ai-platform services
	@status=0; \
	for svc in $(PYTHON_SERVICES); do \
		echo "  Linting $$svc..."; \
		if ! (cd services/$$svc && uv run ruff check src/); then \
			echo "  ✗ $$svc lint failed"; \
			status=1; \
		fi; \
	done; \
	exit $$status

hki-check: hki-audit hki-runtime-check hki-runtime-py-check hki-conformance-check ## Run HKI package, conformance, and audit gates

hki-audit: ## Run HKI conformance debt audit
	pnpm audit:hki

hki-runtime-check: ## Typecheck and test the TypeScript HKI runtime package
	pnpm typecheck:hki-runtime
	pnpm test:hki-runtime

hki-runtime-py-check: ## Test and lint the Python HKI runtime package
	pnpm test:hki-runtime-py
	pnpm lint:hki-runtime-py

hki-conformance-check: ## Typecheck, test, and verify the HKI conformance kit
	pnpm typecheck:hki-conformance
	pnpm test:hki-conformance
	pnpm verify:hki-conformance

e2e-test: ## Run end-to-end ingestion test (requires dev-services running)
	@echo "Running E2E ingestion test..."
	bash tests/e2e_ingestion_test.sh
	@echo "E2E tests complete"

test-prod: gke-credentials ## Run canonical GKE production verification suite
	@bash scripts/test-prod.sh

# ── Knowledge Base Testing ─────────────────────────────────────────────────────
kb-test-setup: ## Set up knowledge base test environment
	@echo "Setting up knowledge base testing environment..."
	cd services/knowledge-api/test-data && bash setup_test_env.sh

kb-test-run: ## Run knowledge base evaluation suite
	@echo "Running knowledge base evaluation suite..."
	cd services/knowledge-api/test-data && python3 run_evaluation.py

kb-test-search: ## Quick knowledge base search smoke test
	@echo "Quick knowledge base search test..."
	@curl -s -X POST http://localhost:9509/v1/search \
		-H 'Content-Type: application/json' \
		-H 'Authorization: Bearer test-token' \
		-d '{"query": "return policy", "mode": "hybrid", "top_k": 5}' \
		| python3 -c "import sys,json; d=json.load(sys.stdin); \
		  print(f\"Found {len(d.get('results', []))} results:\"); \
		  [print(f\"  • {r.get('title','N/A')[:60]} (score: {r.get('score',0):.3f})\") \
		   for r in d.get('results', [])]"

kb-acl-smoke: ## Run auth-enabled legal ACL smoke test against isolated KB stack
	@bash scripts/kb-acl-smoke.sh

kb-ui-e2e: ## Run browser e2e for value-stream creation and ingest UX
	@bash scripts/kb-ui-e2e.sh

kb-user-cleanup: ## Preview or clean synthetic/duplicate KB users (pass ARGS="--apply --delete-synthetic-users --delete-smoke-streams")
	@cd "$(AGENTIC_DIR)" && pnpm kb:user:cleanup -- $(ARGS)

# ── Dev Status ─────────────────────────────────────────────────────────────────
dev-status: ## Show local service port status
	@bash "$(DEV_STACK_SCRIPT)" status

doctor-dev: ## Validate local toolchain
	@echo ""
	@echo "  Developer Environment Check"
	@echo ""
	@command -v python3 >/dev/null 2>&1 && echo "  ✓ python: $$(python3 --version)" || echo "  ✗ python3 not found"
	@command -v node >/dev/null 2>&1 && echo "  ✓ node: $$(node --version)" || echo "  ✗ node not found"
	@command -v pnpm >/dev/null 2>&1 && echo "  ✓ pnpm: $$(pnpm --version)" || echo "  ✗ pnpm not found"
	@command -v uv >/dev/null 2>&1 && echo "  ✓ uv: $$(uv --version)" || echo "  ✗ uv not found"
	@command -v docker >/dev/null 2>&1 && echo "  ✓ docker available" || echo "  ✗ docker not found"
	@command -v gcloud >/dev/null 2>&1 && echo "  ✓ gcloud: $$(gcloud --version 2>&1 | head -1)" || echo "  ✗ gcloud not found"
	@if [ -z "$$VERTEX_PROJECT" ]; then \
		echo "  ⚠ VERTEX_PROJECT not set (ok for most local flows)"; \
	else \
		echo "  ✓ VERTEX_PROJECT=$$VERTEX_PROJECT"; \
	fi
	@echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# deploy-all — Full stack in dependency order
# ═══════════════════════════════════════════════════════════════════════════════
plan-all: check-auth ## [DEPRECATED] Legacy Cloud Run Terraform plan — use gke-plan
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Full Stack Terraform Plan                    ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "  Hub Project  : $(HUB_PROJECT_ID)"
	@echo "  Spoke Project: $(SPOKE_PROJECT_ID)"
	@echo "  Region       : $(REGION)"
	@echo "  Registry     : $(REGISTRY_NAME)"
	@echo "  Release Tag  : $(RELEASE_TAG)"
	@echo ""
	$(MAKE) plan-knowledge-api
	$(MAKE) plan-orchestrator
	$(MAKE) plan-ingestion-pipeline
	$(MAKE) plan-analytics
	$(MAKE) plan-agentic
	@echo ""
	@echo "━━━ PLAN COMPLETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""

deploy-all: check-auth ## [DEPRECATED] Legacy Cloud Run deployment — use gke-deploy
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Full Stack Deployment                        ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "  Hub Project  : $(HUB_PROJECT_ID)"
	@echo "  Spoke Project: $(SPOKE_PROJECT_ID)"
	@echo "  Region       : $(REGION)"
	@echo "  Registry     : $(REGISTRY_NAME)"
	@echo "  Release Tag  : $(RELEASE_TAG)"
ifeq ($(DRY_RUN),true)
	@echo "  Mode         : DRY RUN"
endif
ifneq ($(SKIP_IMAGE_BUILD),false)
	@echo "  Image Builds : SKIPPED"
endif
	@echo ""
	$(MAKE) deploy-knowledge-api
	$(MAKE) deploy-orchestrator
	$(MAKE) deploy-ingestion-pipeline
	$(MAKE) deploy-analytics
	$(MAKE) deploy-agentic
	@echo ""
	@echo "━━━ DEPLOYMENT COMPLETE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	$(MAKE) status

plan-prod: check-auth ## Review production database status and GKE infrastructure plans before release
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is required. Example:"; \
		echo "  DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic make plan-prod"; \
		exit 1; \
	fi
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Production Readiness Review                  ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	$(MAKE) db-migrate-status DATABASE_URL="$(DATABASE_URL)"
	$(MAKE) gke-plan

# ── GKE / Kubernetes targets ───────────────────────────────────────────────────
GKE_PROJECT_ID ?= p-642-cilab-gke
CLUSTER_NAME   ?= cilab-platform
K8S_NAMESPACE  ?= platform
K8S_DIR        := $(CURDIR)/k8s
TF_GKE_DIR     := $(K8S_DIR)/tf
OBSERVABILITY_NOTIFICATION_CHANNEL_IDS ?=
OBSERVABILITY_PLATFORM_ERROR_THRESHOLD ?=
OBSERVABILITY_INGESTION_ERROR_THRESHOLD ?=

export OBSERVABILITY_NOTIFICATION_CHANNEL_IDS
export OBSERVABILITY_PLATFORM_ERROR_THRESHOLD
export OBSERVABILITY_INGESTION_ERROR_THRESHOLD

gke-plan: check-auth ## Terraform plan for GKE infrastructure (cluster, IAM, networking, Redis, AlloyDB PSC)
	@$(GKE_TERRAFORM_SCRIPT) plan

gke-infra: check-auth ## Apply GKE Terraform infrastructure only (no image builds, no kubectl)
	@$(GKE_TERRAFORM_SCRIPT) apply

gke-tf-bootstrap: check-auth ## Bootstrap GKE Terraform backend and providers through the repo script
	@$(GKE_TERRAFORM_SCRIPT) bootstrap

gke-validate: ## Validate GKE Terraform config with backend-free provider bootstrap
	@$(GKE_TERRAFORM_SCRIPT) validate

observability-bootstrap: gke-tf-bootstrap ## Bootstrap Terraform before Cloud Operations rollout

observability-validate: ## Validate Cloud Operations Terraform through the GKE stack script
	@$(GKE_TERRAFORM_SCRIPT) validate

observability-plan: check-auth ## Plan GCP-native observability resources through the GKE Terraform stack
	@$(GKE_TERRAFORM_SCRIPT) plan

observability-apply: check-auth ## Apply GCP-native observability resources through the GKE Terraform stack
	@$(GKE_TERRAFORM_SCRIPT) apply

gke-import: check-auth ## Import manually-provisioned GKE resources into Terraform state (run once)
	@$(GKE_TERRAFORM_SCRIPT) bootstrap
	@$(TF_GKE_DIR)/import.sh

gke-build: check-auth ## Build and push all service images to Artifact Registry via Cloud Build
	@for svc in knowledge-api orchestrator-service ingestion-pipeline-service analytics-service apps/agentic; do \
		echo "Building $$svc..."; \
		gcloud builds submit $(CURDIR) \
			--config=$(CURDIR)/$$svc/cloudbuild.yaml \
			--project=$(HUB_PROJECT_ID) \
			--timeout=1200s; \
	done

gke-credentials: ## Configure kubectl for the GKE cluster
	gcloud container clusters get-credentials $(CLUSTER_NAME) \
		--region=$(REGION) --project=$(GKE_PROJECT_ID) --dns-endpoint

gke-apply: check-auth gke-credentials ## Apply all k8s manifests (skips Terraform and image builds)
	SKIP_TF=true SKIP_BUILD=true $(CURDIR)/scripts/deploy-k8s.sh

gke-deploy: check-auth ## Full GKE deployment: Terraform + build images + kubectl apply
	$(CURDIR)/scripts/deploy-k8s.sh

gke-deploy-skip-build: check-auth ## GKE deployment skipping image builds (use when images already exist)
	$(CURDIR)/scripts/deploy-k8s.sh --skip-build

gke-deploy-knowledge-api: check-auth gke-credentials ## Build and redeploy knowledge-api only
	$(CURDIR)/scripts/deploy-k8s.sh --skip-tf --only knowledge-api

gke-deploy-orchestrator: check-auth gke-credentials ## Build and redeploy orchestrator only
	$(CURDIR)/scripts/deploy-k8s.sh --skip-tf --only orchestrator

gke-deploy-ingestion-pipeline: check-auth gke-credentials ## Build and redeploy ingestion-pipeline only
	$(CURDIR)/scripts/deploy-k8s.sh --skip-tf --only ingestion-pipeline

gke-deploy-agentic: check-auth gke-credentials ## Build and redeploy agentic-bff only
	$(CURDIR)/scripts/deploy-k8s.sh --skip-tf --only agentic-bff

gke-status: gke-credentials ## Show pod and ingress status in the GKE cluster
	@echo ""
	@echo "━━━ Pods ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@kubectl get pods -n $(K8S_NAMESPACE) 2>/dev/null || echo "  (no cluster access)"
	@echo ""
	@echo "━━━ Services ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@kubectl get svc -n $(K8S_NAMESPACE) 2>/dev/null || true
	@echo ""
	@echo "━━━ Ingress ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@kubectl get ingress -n $(K8S_NAMESPACE) 2>/dev/null || true
	@echo ""
	@echo "━━━ HPAs ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@kubectl get hpa -n $(K8S_NAMESPACE) 2>/dev/null || true

gke-rollout-restart: gke-credentials ## Rolling restart of all platform deployments
	kubectl rollout restart deployment -n $(K8S_NAMESPACE)

gke-dry-run: ## Preview full GKE deployment (no changes)
	DRY_RUN=true $(CURDIR)/scripts/deploy-k8s.sh

# ── end GKE targets ────────────────────────────────────────────────────────────

release-prod: check-auth ## Run production DB migration, deploy GKE stack, and verify final status
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "ERROR: DATABASE_URL is required. Example:"; \
		echo "  DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic make release-prod"; \
		exit 1; \
	fi
	@echo ""
	@echo "╔═══════════════════════════════════════════════════════════════╗"
	@echo "║   AI Platform — Production Release                           ║"
	@echo "╚═══════════════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Recommended: run 'make plan-prod DATABASE_URL=...' first."
	@echo "Release tag: $(RELEASE_TAG)"
	@echo ""
	$(MAKE) db-migrate-prod DATABASE_URL="$(DATABASE_URL)"
	$(MAKE) deploy
	$(MAKE) db-migrate-status DATABASE_URL="$(DATABASE_URL)"
