# AI Platform - Windows Setup Guide

**Last Updated:** April 17, 2026
**Tested On:** Windows 10/11 with Corporate Proxy

This guide documents the complete setup process for running the AI Platform on Windows, including all fixes for common Windows-specific issues.

---

## Prerequisites

Ensure you have the following installed:

- **Python 3.12+** - `python --version`
- **uv** - `pip install uv`
- **Node.js 24+** - `node --version`
- **pnpm 9+** - `npm install -g pnpm`
- **Docker Desktop** - Running and configured
- **PowerShell 5.1+** - Default on Windows

---

## Quick Start (TL;DR)

```powershell
# 1. Navigate to project
cd c:\path\to\innovationlab-monorepo\apps\ai-platform

# 2. Fix corporate proxy SSL issues
npm config set strict-ssl false
pnpm config set strict-ssl false

# 3. Copy environment files (see Step 1 below for details)

# 4. Start Docker infrastructure
cd docker-compose
docker-compose up -d
cd ..

# 5. Install dependencies
pnpm install

# 6. Build workspace packages
pnpm build

# 7. Run database migrations
cd agentic
$env:DATABASE_URL='mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4'
pnpm db:migrate
cd ..

# 8. Start Python services (4 separate terminals - see Step 7)

# 9. Start frontend
cd agentic
$env:NODE_ENV='development'; $env:PORT='9001'; $env:KB_HERMETIC_ISOLATION='true'; $env:DB_AUTO_MIGRATE='false'; npx tsx watch --ignore './client/**' server/_core/index.ts
```

---

## Detailed Setup Instructions

### Step 1: Environment Configuration

Copy and configure environment files:

```powershell
# Docker environment
Copy-Item docker-compose\.env.example docker-compose\.env

# Service environments
Copy-Item agentic\.env.example agentic\.env
Copy-Item orchestrator-service\.env.example orchestrator-service\.env
Copy-Item ingestion-pipeline-service\.env.example ingestion-pipeline-service\.env
Copy-Item analytics-service\.env.example analytics-service\.env
```

**Required .env Configuration:**

1. **deploy/compose/.env** - Set your GCP project:
   ```
   VERTEX_PROJECT=<your-gcp-project>
   ```

2. **Place GCP credentials** at:
   ```
   deploy/compose/creds/gcp_creds.json
   ```

### Step 2: Fix Windows-Specific Issues

#### Issue 1: Corporate Proxy SSL Certificates

If you're behind a corporate proxy with self-signed certificates, disable strict SSL:

```powershell
npm config set strict-ssl false
pnpm config set strict-ssl false
```

#### Issue 2: Fix CORS_ORIGINS Format in .env Files

The `.env` files need JSON array format for CORS_ORIGINS (Windows pydantic parsing):

**orchestrator-service/.env:**
```env
# Change from:
CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:3000

# To:
CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:3000"]
```

**ingestion-pipeline-service/.env:**
```env
# Change from:
CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:9501

# To:
CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:9501"]
```

**analytics-service/.env:**
```env
# Change from:
CORS_ORIGINS=http://localhost:9001,http://localhost:9002,http://localhost:3000

# To:
CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:3000"]
```

#### Issue 3: Fix Knowledge API UTF-8 Encoding

Edit `services/knowledge-api/src/adapters/alloydb_store.py` (around line 109):

```python
# Change from:
schema_sql = schema_path.read_text()

# To:
schema_sql = schema_path.read_text(encoding="utf-8")
```

#### Issue 4: Fix MySQL Password in Agentic .env

Edit `agentic/.env` (line 13):

```env
# Change from:
DATABASE_URL=mysql://root:password@localhost:9306/retail_agentic?charset=utf8mb4

# To:
DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4
```

### Step 3: Start Docker Infrastructure

```powershell
cd docker-compose
docker-compose up -d
cd ..
```

**Wait 30 seconds** for containers to initialize, then verify:

```powershell
cd docker-compose
docker-compose ps
```

You should see 8 containers running:
- hki-postgres (port 9432)
- hki-mysql (port 9306)
- hki-redis (port 9379)
- hki-neo4j (ports 9474/9687)
- hki-litellm (port 9400)
- hki-langfuse (port 3100)
- hki-langfuse-db
- hki-pubsub (port 9085)

### Step 4: Install Dependencies

**IMPORTANT:** Install from the workspace root directory:

```powershell
# Navigate to apps/ai-platform parent (where pnpm-workspace.yaml is)
cd c:\path\to\innovationlab-monorepo\apps\ai-platform

# Install all workspace packages (includes @hki/ui, @hki/chat, agentic, etc.)
pnpm install
```

This will take ~2-3 minutes and install 1500+ packages.

### Step 5: Build Workspace Packages

**IMPORTANT:** Build the workspace packages before starting the frontend:

```powershell
# Build all workspace packages (@hki/ui, @hki/chat, etc.)
pnpm build
```

This compiles TypeScript and bundles the shared packages that the agentic frontend depends on. Without this step, you'll get errors like "Failed to resolve entry for package @hki/ui".

**What this builds:**
- `@hki/ui` - Shared UI component library
- `@hki/chat` - Chat-related components
- `@hki/eslint-config` - Linting configuration
- `@hki/typescript-config` - TypeScript configuration
- `agentic` - Frontend application bundle

This will take ~1-2 minutes. You'll see a Turbo build progress indicator.

### Step 6: Run Database Migrations

Before starting the agentic frontend, run the database migrations:

```powershell
cd agentic
$env:DATABASE_URL='mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4'
pnpm db:migrate
```

This creates all the required MySQL tables for the application. You should see output like:
```
Running schema migrations...
Applied migration { migrationId: 'baseline:init-tables.sql' ... }
Migration run complete: XX applied, 0 already tracked
```

### Step 7: Start Python Services

Open **4 separate PowerShell terminals** and run one command in each:

**Terminal 1 - Knowledge API (port 9509):**
```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform\knowledge-api
$env:ALLOYDB_URL='postgresql://postgres:postgres@localhost:9432/knowledge'
$env:ENVIRONMENT='development'
$env:KB_HERMETIC_ISOLATION='true'
uv run uvicorn src.api.app:app --reload --port 9509 --reload-dir src
```

**Terminal 2 - Orchestrator Service (port 9501):**
```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform\orchestrator-service
$env:REDIS_URL='redis://localhost:9379/0'
$env:AUTH_ENABLED='false'
uv run uvicorn src.api.app:app --reload --port 9501 --reload-dir src
```

**Terminal 3 - Ingestion Pipeline Service (port 9508):**
```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform\ingestion-pipeline-service
$env:KNOWLEDGE_API_URL='http://localhost:9509'
$env:AUTH_ENABLED='false'
$env:ENVIRONMENT='development'
$env:KB_HERMETIC_ISOLATION='true'
uv run uvicorn src.api.app:app --reload --port 9508 --reload-dir src
```

**Terminal 4 - Analytics Service (port 9510):**
```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform\analytics-service
$env:ENVIRONMENT='development'
uv run uvicorn src.api.app:app --reload --port 9510 --reload-dir src
```

Wait for each service to display "Application startup complete" before proceeding.

### Step 8: Start Agentic Frontend

Open a **5th PowerShell terminal**:

```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform\agentic
$env:NODE_ENV='development'
$env:PORT='9001'
$env:KB_HERMETIC_ISOLATION='true'
$env:DB_AUTO_MIGRATE='false'
npx tsx watch --ignore './client/**' server/_core/index.ts
```

Wait for the message: `"Agentic BFF running on http://localhost:9001/"`

### Step 9: Verify Setup

Open your browser and navigate to:

- **Main Application:** http://localhost:9001
- **Langfuse Tracing UI:** http://localhost:3100
  - Login: `admin@hki.com` / `admin1234`

**Health Check Endpoints:**
```powershell
# Test all services
curl http://localhost:9509/health  # Knowledge API
curl http://localhost:9501/health  # Orchestrator
curl http://localhost:9508/health  # Ingestion Pipeline
curl http://localhost:9510/health  # Analytics
```

---

## Common Issues & Solutions

### Issue: "pnpm install" hangs or fails with SSL errors

**Solution:**
```powershell
npm config set strict-ssl false
pnpm config set strict-ssl false
```

### Issue: Python service fails with "CORS_ORIGINS" JSON decode error

**Solution:** Ensure CORS_ORIGINS in .env files uses JSON array format:
```env
CORS_ORIGINS=["http://localhost:9001","http://localhost:9002","http://localhost:3000"]
```

### Issue: Knowledge API fails with "UnicodeDecodeError" reading schema.sql

**Solution:** Edit `services/knowledge-api/src/adapters/alloydb_store.py`:
```python
schema_sql = schema_path.read_text(encoding="utf-8")
```

### Issue: MySQL authentication error "Access denied for user 'root'"

**Solution:** Update `agentic/.env`:
```env
DATABASE_URL=mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4
```

### Issue: "NODE_ENV is not recognized as an internal or external command"

**Solution:** Use PowerShell environment variable syntax:
```powershell
$env:NODE_ENV='development'
```
NOT Unix syntax: `NODE_ENV=development`

### Issue: Missing workspace packages (@hki/ui, @hki/chat) or "Failed to resolve entry for package"

**Error:** Agentic frontend fails with:
```
Failed to resolve entry for package "@hki/ui"
Failed to resolve entry for package "@hki/chat"
```

**Solution:**
1. Ensure you ran `pnpm install` from `apps/ai-platform` directory (where pnpm-workspace.yaml is), not from `agentic` subdirectory
2. **Build the workspace packages** before starting the frontend:
```powershell
cd c:\path\to\innovationlab-monorepo\apps\ai-platform
pnpm build
```

The workspace packages need to be compiled/bundled before they can be imported.

### Issue: Database tables don't exist (knowledgeConnectors, etc.)

**Error:** Console shows errors like:
```
Table 'retail_agentic.knowledgeConnectors' doesn't exist
```

**Solution:** Run database migrations:
```powershell
cd agentic
$env:DATABASE_URL='mysql://root:root@localhost:9306/retail_agentic?charset=utf8mb4'
pnpm db:migrate
```

### Issue: Docker containers not starting

**Solution:**
```powershell
cd docker-compose
docker-compose down -v
docker-compose up -d
```

---

## Service Ports Reference

| Service | Port | URL |
|---------|------|-----|
| Agentic BFF | 9001 | http://localhost:9001 |
| knowledge-api | 9509 | http://localhost:9509 |
| ingestion-pipeline | 9508 | http://localhost:9508 |
| orchestrator | 9501 | http://localhost:9501 |
| analytics | 9510 | http://localhost:9510 |
| LiteLLM | 4000 | http://localhost:4000 |
| Langfuse | 3100 | http://localhost:3100 |
| PostgreSQL | 9432 | localhost:9432 |
| MySQL | 9306 | localhost:9306 |
| Redis | 9379 | localhost:9379 |
| Neo4j | 9687 | localhost:9687 |
| Pub/Sub Emulator | 9085 | localhost:9085 |

---

## Stopping Services

### Stop Python Services
Press `Ctrl+C` in each of the 4 Python service terminals.

### Stop Agentic Frontend
Press `Ctrl+C` in the agentic terminal.

### Stop Docker Infrastructure
```powershell
cd docker-compose
docker-compose down
```

### Stop Everything and Clean Volumes
```powershell
cd docker-compose
docker-compose down -v
```

---

## Automated Setup Script (PowerShell)

Save this as `setup.ps1` for automated setup:

```powershell
# AI Platform Windows Setup Script
$ErrorActionPreference = "Stop"

Write-Host "=== AI Platform Windows Setup ===" -ForegroundColor Cyan

# Fix SSL
Write-Host "`n1. Configuring npm/pnpm for corporate proxy..." -ForegroundColor Yellow
npm config set strict-ssl false
pnpm config set strict-ssl false

# Navigate to project
$projectRoot = "c:\path\to\innovationlab-monorepo\apps\ai-platform"
Set-Location $projectRoot

# Start Docker
Write-Host "`n2. Starting Docker infrastructure..." -ForegroundColor Yellow
Set-Location docker-compose
docker-compose up -d
Start-Sleep -Seconds 30
Set-Location ..

# Install dependencies
Write-Host "`n3. Installing workspace dependencies..." -ForegroundColor Yellow
pnpm install

Write-Host "`n=== Setup Complete! ===" -ForegroundColor Green
Write-Host "`nNext steps:"
Write-Host "1. Verify .env files are configured (see WINDOWS_SETUP.md Step 1)"
Write-Host "2. Apply fixes from WINDOWS_SETUP.md Step 2"
Write-Host "3. Start Python services (see WINDOWS_SETUP.md Step 5)"
Write-Host "4. Start agentic frontend (see WINDOWS_SETUP.md Step 6)"
```

Run with:
```powershell
powershell -ExecutionPolicy Bypass -File setup.ps1
```

---

## Development Tips

### Restart Individual Services

If a service crashes, just restart it in its terminal with the same command.

### View Logs

Docker logs:
```powershell
cd docker-compose
docker-compose logs -f [service-name]
# Example: docker-compose logs -f mysql
```

### Database Migrations

Run migrations locally:
```powershell
cd agentic
$env:DATABASE_URL='mysql://root:root@localhost:9306/retail_agentic'
pnpm db:migrate
```

### Clean Restart

```powershell
# Stop everything
cd docker-compose
docker-compose down -v

# Restart infrastructure
docker-compose up -d

# Restart services (follow Step 5-6 above)
```

---

## Summary of All Changes Made

### Configuration Files Modified:
1. `orchestrator-service/.env` - CORS_ORIGINS to JSON array format
2. `ingestion-pipeline-service/.env` - CORS_ORIGINS to JSON array format
3. `analytics-service/.env` - CORS_ORIGINS to JSON array format
4. `agentic/.env` - MySQL password from "password" to "root"

### Code Files Modified:
1. `services/knowledge-api/src/adapters/alloydb_store.py` - Added UTF-8 encoding to schema.sql read

### System Configuration:
1. npm/pnpm - Disabled strict-ssl for corporate proxy

### Required Build Steps:
1. `pnpm build` - Build workspace packages (@hki/ui, @hki/chat) before starting frontend
2. `pnpm db:migrate` - Create database schema before starting agentic frontend

### Key Differences from Linux/Mac Setup:
- Environment variables set with `$env:VAR='value'` instead of `VAR=value`
- CORS_ORIGINS must be JSON array format (Windows pydantic parsing)
- UTF-8 encoding must be explicit (Windows uses cp1252 by default)
- pnpm install must run from workspace root, not subdirectory
- **Must run `pnpm build` to compile workspace packages** before starting frontend
- **Must run database migrations** before starting agentic frontend
- No bash/make support - use PowerShell commands directly

---

**For Questions:** See main [README.md](README.md) or check troubleshooting section above.
