# Navigation & Service Integration Guide

> Historical note: this document predates the current GKE-first AI Platform rollout and still includes older Cloud Run-style examples. For current contributor onboarding, start with `../README.md` and `README.md` in this docs directory.

## 🎯 Overview

Your monorepo has **two primary user-facing applications** with built-in cross-navigation:

```
┌─────────────────────────────────────────────────────────┐
│              CI Portal (Port 9002)                      │
│         Innovation Management Hub                       │
│                                                         │
│  ┌─────────────────────────────────────────────┐        │
│  │  Platform Router Page                       │        │
│  │                                             │        │
│  │  [Agentic AI] ────────────────┐             │        │
│  │  [Value Stream (IPMS)]        │             │        │
│  │  [HKI Vision] (coming)     │             │        │
│  └───────────────────────────────┼───────────  ┘        │
└────────────────────────────────┼──────────────────────  ┘
                                 │
                                 │ External link
                                 ▼
┌─────────────────────────────────────────────────────────┐
│           Agentic AI Platform (Port 9001)               │
│         AI Chat, Knowledge, Agents                      │
│                                                         │
│  Uses:                                                  │
│  - Orchestrator Service (9501)                         │
│  - Knowledge API (9509)                                 │
│  - Ingestion Pipeline (9508)                           │
└─────────────────────────────────────────────────────────┘
```

## ✅ Current State

### CI Portal → Agentic AI Navigation (Already Configured!)

The CI Portal **already has** a Platform Router page that links to Agentic AI:

**File**: `apps/ci-portal/client/src/pages/hub/PlatformRouterPage.tsx`

```typescript
const AGENTIC_PLATFORM_URL =
  import.meta.env.VITE_AGENTIC_PLATFORM_URL || "http://localhost:9001";

const ROUTING_PLATFORMS: RoutingPlatform[] = [
  {
    id: "agentic-ai",
    title: "Agentic AI",
    tagline: "Enterprise AI Platform",
    description: "Conversational agents, model gateway, and the full AI capability map.",
    href: AGENTIC_PLATFORM_URL,
    external: true,  // Opens in new tab
    icon: <Cpu className="w-7 h-7" />,
    status: "dev",
  },
  {
    id: "ipms",
    title: "Value Stream (IPMS)",
    tagline: "Portfolio Management",
    description: "End-to-end value stream management — ideation through pilot to delivery.",
    href: "/dashboard",  // Internal route
    status: "dev",
  },
  // ... more platforms
];
```

**User Flow**:

1. User logs into **CI Portal** at `https://ci-portal.hki.com` (or localhost:9002)
2. Sees the Platform Router page with cards for each platform
3. Clicks "Agentic AI" → Opens `https://agentic.hki.com` in new tab
4. User can switch between platforms via browser tabs

## 🔧 Configuration Needed

### 1. Environment Variables

#### CI Portal

Create `apps/ci-portal/.env`:

```bash
# Local Development
NODE_ENV=development
PORT=9002
VITE_AGENTIC_PLATFORM_URL=http://localhost:9001

# Production (deployed)
NODE_ENV=production
VITE_AGENTIC_PLATFORM_URL=https://agentic-abc123-uc.a.run.app
# OR with custom domain:
VITE_AGENTIC_PLATFORM_URL=https://agentic.hki.com
```

#### Agentic Platform

Create `apps/ai-platform/agentic/.env`:

```bash
# Service URLs (for backend to call other services)
ORCHESTRATOR_URL=http://localhost:9501  # Local
# ORCHESTRATOR_URL=https://orchestrator-abc123-uc.a.run.app  # Production

KNOWLEDGE_PIPELINE_URL=http://localhost:9508
KNOWLEDGE_API_URL=http://localhost:9509

# Optional: Link back to CI Portal
VITE_CI_PORTAL_URL=http://localhost:9002  # Local
# VITE_CI_PORTAL_URL=https://ci-portal.hki.com  # Production
```

### 2. Add "Back to CI Portal" Link in Agentic

**Option A**: Add to Agentic top navigation

Edit `apps/ai-platform/agentic/client/src/components/TopNav.tsx`:

```typescript
import { Home } from "lucide-react";

const CI_PORTAL_URL = import.meta.env.VITE_CI_PORTAL_URL || "http://localhost:9002";

// Add this button to the top nav:
<a
  href={CI_PORTAL_URL}
  className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent"
  target="_blank"
  rel="noopener noreferrer"
>
  <Home className="w-4 h-4" />
  <span>CI Portal</span>
</a>
```

**Option B**: Add to sidebar

Or add a "Platforms" section in the sidebar with links to CI Portal and other tools.

### 3. Unified Authentication (SSO)

Both applications should use the **same authentication system**:

**Current Setup**:

- CI Portal: Uses `@/\_core/hooks/useAuth`
- Agentic: Uses its own auth (likely similar)

**Recommendation**: Configure both to use the same OAuth provider:

```bash
# In both .env files:
OAUTH_SERVER_URL=https://sso.hki.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret

# Share JWT secret for session validation
JWT_SECRET=same-secret-in-both-apps
```

When using **Cloud Run** with **Identity-Aware Proxy (IAP)**, authentication is handled at the load balancer level, and both apps receive the same user identity.

### 4. Update Dockerfiles for Environment Variables

Both Dockerfiles already support runtime environment variables via Docker's `ENV` and can be overridden at deploy time.

**No changes needed** — environment variables are passed at runtime via:

- Docker: `docker run -e VITE_AGENTIC_PLATFORM_URL=...`
- Cloud Run: Set in Terraform or `gcloud run deploy --set-env-vars`

## 📋 Deployment Checklist

### Local Development Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Create .env files
cp apps/ci-portal/.env.example apps/ci-portal/.env
cp apps/ai-platform/agentic/.env.example apps/ai-platform/agentic/.env

# 3. Edit .env files with local URLs
# CI Portal: VITE_AGENTIC_PLATFORM_URL=http://localhost:9001
# Agentic: ORCHESTRATOR_URL=http://localhost:9501, etc.

# 4. Start services
# Terminal 1 - CI Portal
cd apps/ci-portal && pnpm run dev  # Port 9002

# Terminal 2 - Agentic BFF
cd apps/ai-platform/agentic && pnpm run dev  # Port 9001

# Terminal 3 - Orchestrator
cd apps/ai-platform/orchestrator-service
uv run uvicorn src.main:app --reload --port 9501

# Terminal 4 - Knowledge API
cd apps/ai-platform/knowledge-api
uv run uvicorn src.main:app --reload --port 9509

# Terminal 5 - Ingestion Pipeline
cd apps/ai-platform/ingestion-pipeline-service
uv run uvicorn src.main:app --reload --port 9508
```

**Test Navigation**:

1. Open http://localhost:9002 (CI Portal)
2. Log in
3. Click "Agentic AI" card
4. Should open http://localhost:9001 in new tab

### Production Deployment

**Cloud Run Environment Variables** (set in Terraform or via gcloud):

```hcl
# apps/ci-portal/tf/cloud_run.tf
resource "google_cloud_run_v2_service" "ci_portal" {
  name     = "ci-portal"
  location = var.region

  template {
    containers {
      image = var.image

      env {
        name  = "VITE_AGENTIC_PLATFORM_URL"
        value = "https://agentic-${var.spoke_project_id}.a.run.app"
        # OR with custom domain:
        # value = "https://agentic.hki.com"
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }

      # ... other env vars
    }
  }
}
```

```yaml
# apps/ai-platform/agentic/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agentic-bff
spec:
  template:
    spec:
      containers:
        - name: agentic-bff
          image: us-west1-docker.pkg.dev/p-642-cilab-infrastructure/cilab/agentic:latest
          envFrom:
            - configMapRef:
                name: agentic-bff-config
            - secretRef:
                name: agentic-bff-secrets

          env:
        name  = "ORCHESTRATOR_URL"
        value = "https://orchestrator-${var.spoke_project_id}.a.run.app"
      }

      env {
        name  = "KNOWLEDGE_API_URL"
        value = "https://knowledge-api-${var.spoke_project_id}.a.run.app"
      }

      env {
        name  = "VITE_CI_PORTAL_URL"
        value = "https://ci-portal-${var.spoke_project_id}.a.run.app"
      }

      # ... other env vars
    }
  }
}
```

## 🎨 Enhanced Navigation (Optional Improvements)

### 1. Add Platform Switcher to Agentic

Create a dropdown in the Agentic top nav to switch between platforms:

```typescript
// apps/ai-platform/agentic/client/src/components/PlatformSwitcher.tsx
import { Grid3X3, Lightbulb, Cpu } from "lucide-react";

const PLATFORMS = [
  { name: "CI Portal", url: CI_PORTAL_URL, icon: Grid3X3 },
  { name: "Agentic AI", url: "/", icon: Cpu, current: true },
  { name: "Value Stream", url: `${CI_PORTAL_URL}/dashboard`, icon: Lightbulb },
];

export function PlatformSwitcher() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Cpu /> Agentic AI <ChevronDown />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {PLATFORMS.map(platform => (
          <DropdownMenuItem key={platform.name} asChild>
            <a href={platform.url}>
              <platform.icon />
              {platform.name}
              {platform.current && <Check />}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 2. Unified User Profile

Both apps can share user profile data if using the same auth:

```typescript
// Shared auth context
interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  roles: string[];
  // Same shape in both apps
}
```

### 3. Deep Linking

Allow CI Portal to link directly to specific Agentic features:

```typescript
// In CI Portal - link to specific knowledge collection
<a href={`${AGENTIC_URL}/knowledge/collections/${collectionId}`}>
  View in Agentic AI
</a>

// In CI Portal - link to chat with context
<a href={`${AGENTIC_URL}/chat?context=${encodeURIComponent(initiativeId)}`}>
  Ask AI about this initiative
</a>
```

## 🔒 Security Considerations

### 1. CORS Configuration

If apps are on different domains, configure CORS:

```typescript
// apps/ai-platform/agentic/server/_core/index.ts
import cors from "cors";

app.use(
  cors({
    origin: [
      "http://localhost:9002", // Local CI Portal
      "https://ci-portal.hki.com", // Production CI Portal
    ],
    credentials: true,
  }),
);
```

### 2. CSP (Content Security Policy)

Allow opening external links:

```typescript
// In CI Portal
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", "https://agentic.hki.com"],
        frameSrc: ["'self'", "https://agentic.hki.com"], // If embedding
      },
    },
  }),
);
```

### 3. Session Sharing

If you want seamless navigation without re-login:

**Option A**: Use Identity-Aware Proxy (IAP) on Cloud Run

- Single sign-on at the load balancer level
- Both apps receive authenticated user headers
- No separate login needed

**Option B**: Share JWT cookie across subdomains

```typescript
// Set cookie domain to .hki.com
res.cookie("session", token, {
  domain: ".hki.com",
  secure: true,
  httpOnly: true,
});

// Both ci-portal.hki.com and agentic.hki.com can read it
```

## 🚀 Quick Reference

### User Access Points

| Application        | URL (Local)           | URL (Production)             | Purpose                         |
| ------------------ | --------------------- | ---------------------------- | ------------------------------- |
| **CI Portal**      | http://localhost:9002 | https://ci-portal.hki.com | Main hub, innovation management |
| **Agentic AI**     | http://localhost:9001 | https://agentic.hki.com   | AI chat, knowledge, agents      |
| Orchestrator       | http://localhost:9501 | (internal only)              | Backend service                 |
| Knowledge API      | http://localhost:9509 | (internal only)              | Backend service                 |
| Ingestion Pipeline | http://localhost:9508 | (internal only)              | Backend service                 |

### Navigation Paths

```
User Journey:
1. User browses to https://ci-portal.hki.com
2. Logs in via Google SSO
3. Sees Platform Router with 3 cards:
   - Agentic AI → Opens https://agentic.hki.com (new tab)
   - Value Stream (IPMS) → /dashboard (same app)
   - HKI Vision → Coming soon
4. User clicks "Agentic AI"
5. Opens Agentic platform (already authenticated via shared SSO)
6. User can click "Back to CI Portal" to return
```

## ✅ Summary

**Good news**: Navigation is already mostly configured!

**What you need to do**:

1. ✅ Set `VITE_AGENTIC_PLATFORM_URL` in CI Portal .env (local + production)
2. ✅ Set service URLs in Agentic .env (`ORCHESTRATOR_URL`, `KNOWLEDGE_API_URL`, etc.)
3. ✅ Optionally add "Back to CI Portal" link in Agentic UI
4. ✅ Configure shared authentication (OAuth/SSO)
5. ✅ Update Terraform configs with environment variables for Cloud Run

The CI Portal is designed to be the **main entry point** for users, and the Platform Router page provides elegant navigation to all your platforms including Agentic AI. Users can easily switch between tools via browser tabs or in-app links.
