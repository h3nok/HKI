# Knowledge Self-Service — User Story

> **Epic**: Agentic AI Platform — Knowledge Management
> **Status**: In Progress
> **Sprint**: February 2026
> **Priority**: P1

---

## Story

**As a** value stream manager (e.g. Pharmacy Operations lead),
**I want** a self-service Knowledge Base that I can access from my value stream in the admin console,
**So that** I can build, curate, and test the domain knowledge that powers my stream's AI agent — without needing platform engineering support.

---

## Personas

| Persona | Role | Goal |
|---------|------|------|
| **Maria** — Pharmacy Operations Lead | Manager | Upload pharmacy SOPs, drug interaction guides, and compliance docs so the pharmacy agent gives accurate answers |
| **James** — Platform Admin | Admin | Configure value streams, assign managers, monitor knowledge health across all streams |
| **Priya** — New Hire (Pharmacy) | Viewer | Receives an invite code from Maria, joins the knowledge base, and starts contributing documents |

---

## Entry Points

Users discover and access the Knowledge Base through multiple paths:

| Entry Point | Who | Flow |
|-------------|-----|------|
| **Admin → Value Streams → Knowledge tab** | Admin | Click 📖 icon on stream row → opens `/knowledge?stream={id}` in new tab |
| **Admin → Edit Stream → Knowledge tab → "Open Knowledge Base"** | Admin | Opens `/knowledge?stream={id}` in new tab |
| **Public landing page** | Anyone | `/knowledge/welcome` → learn about KB → `/knowledge/join` → enter invite code → access granted |
| **Invite code (email)** | Invited user | Direct link to `/knowledge/join` → enter code → redirected to `/knowledge?stream={id}` |

---

## Acceptance Criteria

### AC-1: Landing & Onboarding

- [x] Public landing page at `/knowledge/welcome` explains the Knowledge Base with capabilities, how-it-works steps, and CTA to join
- [x] Landing page has its own emerald branding, custom favicon, and "Knowledge Base — HKI Innovation" title
- [x] Clicking "Agentic AI Platform" in the welcome nav navigates to the main platform landing page (`/`)
- [x] `/knowledge/join` allows invited users to enter email + 8-character invite code
- [x] On successful invite acceptance, user is redirected to `/knowledge?stream={valueStreamId}`
- [x] Unauthorized users hitting `/knowledge` see an access-denied screen with links to the join page and welcome page

### AC-2: Sidebar Navigation

- [x] Knowledge Base uses its own sidebar layout (independent from admin sidebar)
- [x] Sidebar brand header (📖 Knowledge Base / Self-Service) links to the welcome landing page
- [x] Sidebar has grouped navigation: **Home** (Overview), **Content** (Sources, Library, Collections), **Intelligence** (Gap Analysis, Test & Verify), **Manage** (Team & Invites)
- [x] Active nav item is highlighted with emerald accent
- [x] Sidebar collapses to icon-only mode

### AC-3: Stream Scoping

- [x] Stream is set via `?stream={id}` URL parameter (passed from admin stream row or stream form)
- [x] No stream dropdown in sidebar — KB is always scoped to the stream from the URL
- [x] Stream name is prominently displayed in the **Overview tab header** and as a **breadcrumb badge**
- [x] Non-admins are locked to their assigned stream (cannot change via URL manipulation)
- [x] All queries and data are scoped to the selected stream

### AC-4: Breadcrumb Navigation

- [x] Sticky breadcrumb bar at top of content area with sidebar trigger, vertical separator, and breadcrumb trail
- [x] Breadcrumb format: `📖 Knowledge Base › {Group} › {Page}`
- [x] Breadcrumb segments are clickable: "Knowledge Base" → Overview, group label → first tab in group
- [x] Stream badge shown on the right side of the breadcrumb bar when a stream is selected
- [x] Breadcrumb component (`BreadcrumbBar`) is reusable across the platform (also used in Admin)

### AC-5: Overview Tab

- [x] Stream name displayed prominently as the card title (e.g. "🏥 Pharmacy Operations")
- [x] Dashboard showing knowledge base health: document count, chunk count, entity count, job count
- [x] Stream-scoped stats with emerald progress bar and setup percentage
- [x] Onboarding checklist for new streams (ingest first doc, reach 50 chunks, run gap analysis, etc.)
- [x] Navigation cards to other tabs

### AC-6: Sources Tab

- [ ] Text ingestion: paste content with title, department, doc type, and tags
- [ ] URL ingestion: enter URL to crawl into the pipeline
- [ ] Pipeline jobs panel showing ingestion job status (queued, extracting, cleaning, enriching, indexing, completed, failed)
- [ ] Job status with real-time refresh

### AC-7: Library Tab

- [ ] Browse all indexed documents with search/filter
- [ ] Document metadata: title, department, doc type, chunk count, freshness indicator
- [ ] Freshness scoring: Current (<30 days), Review (30–90 days), Stale (>90 days)
- [ ] Document detail view with chunk inspection

### AC-8: Collections Tab

- [ ] View and manage knowledge collections assigned to the stream
- [ ] Create new collections with name, department, doc type, tags, and description
- [ ] Delete collections

### AC-9: Gap Analysis Tab

- [ ] AI-powered coverage score (donut chart visualization)
- [ ] Stats: documents, chunks, stale document count
- [ ] Stale content list with freshness badges
- [ ] Gemini-powered gap detection (Phase 3 placeholder)

### AC-10: Test & Verify Tab

- [ ] Search mode selector: Hybrid, Vector, Keyword
- [ ] Query input with search execution
- [ ] Evidence-style result cards with numbered badges, confidence scores, and metadata tags
- [ ] Search time displayed

### AC-11: Team & Invites Tab

- [ ] View team members with access to this stream's knowledge base
- [ ] Generate invite codes for new contributors
- [ ] Manage roles and permissions

### AC-12: Admin Integration

- [x] Admin sidebar does **not** have a global Knowledge Base link (removed)
- [x] Each value stream row in the streams table has a 📖 icon in the Actions column that opens KB in a new tab
- [x] StreamForm → Knowledge tab has an "Open Knowledge Base" button that opens in a new tab
- [x] Admin pages use the reusable `BreadcrumbBar` with clickable navigation segments

---

## Scenarios

### Scenario 1: Maria uploads pharmacy SOPs

```
Given Maria is a manager assigned to the "Pharmacy" value stream
When she opens the admin console and clicks 📖 on the Pharmacy stream row
Then a new tab opens at /knowledge?stream=pharmacy
And the Overview shows "🏥 Pharmacy Operations" as the header with setup progress
And the breadcrumb shows "📖 Knowledge Base › Home › Overview" with a "🏥 Pharmacy Operations" badge
When she clicks "Sources" in the sidebar
Then she sees the ingestion form and pipeline jobs panel
When she pastes the SOP text, selects department "pharmacy" and doc type "procedure"
And clicks "Ingest"
Then a pipeline job appears in the jobs panel with status "extracting"
And the job progresses through cleaning → enriching → indexing → completed
```

### Scenario 2: James reviews knowledge health for a stream

```
Given James is a platform admin
When he opens the admin console and clicks 📖 on the Pharmacy stream row
Then a new tab opens at /knowledge?stream=pharmacy
And the Overview header shows "🏥 Pharmacy Operations" with stats and setup progress
And the breadcrumb badge shows "🏥 Pharmacy Operations" on the right
When he clicks "Gap Analysis" in the sidebar
Then he sees the coverage score, stale content list, and gap placeholders
```

### Scenario 3: Priya joins via invite code

```
Given Maria generated an invite code "ABCD1234" for Priya
When Priya visits /knowledge/welcome
Then she sees the branded landing page explaining the Knowledge Base
When she clicks "Access Knowledge Base"
Then she's taken to /knowledge/join
When she enters her email and the code "ABCD1234"
And clicks "Join Knowledge Base"
Then she sees "You're In!" with her granted role and stream name
When she clicks "Open Knowledge Base"
Then she's redirected to /knowledge?stream=pharmacy
And she has manager access to the Pharmacy knowledge base
```

### Scenario 4: Unauthorized user tries to access KB

```
Given a user with "viewer" role navigates to /knowledge
Then they see the access-denied screen with the KB emerald book icon
And a prominent "Enter Invite Code" button linking to /knowledge/join
And a "Learn more about Knowledge Base" link to /knowledge/welcome
And a "Back to Chat" fallback link
```

---

## UI Components Built

| Component | Location | Reusable? |
|-----------|----------|-----------|
| `BreadcrumbBar` | `components/ui/breadcrumb-bar.tsx` | ✅ Platform-wide (used in Admin + Knowledge) |
| `KnowledgeSidebar` | `pages/knowledge/index.tsx` | Knowledge-specific |
| `KnowledgeContent` | `pages/knowledge/index.tsx` | Knowledge-specific |
| `KnowledgeWelcome` | `pages/knowledge/welcome.tsx` | Standalone public page |
| `KnowledgeJoin` | `pages/knowledge/join.tsx` | Standalone public page |
| `OverviewTab` | `pages/knowledge/components/OverviewTab.tsx` | Knowledge tab |
| `SourcesTab` | `pages/knowledge/components/SourcesTab.tsx` | Knowledge tab |
| `LibraryTab` | `pages/knowledge/components/LibraryTab.tsx` | Knowledge tab |
| `CollectionsTab` | `pages/knowledge/components/CollectionsTab.tsx` | Knowledge tab |
| `GapsTab` | `pages/knowledge/components/GapsTab.tsx` | Knowledge tab |
| `TestTab` | `pages/knowledge/components/TestTab.tsx` | Knowledge tab |
| `TeamTab` | `pages/knowledge/components/TeamTab.tsx` | Knowledge tab |

---

## Branding

| Element | Value |
|---------|-------|
| Primary color | Emerald `#10B981` |
| Favicon | `/public/favicon-knowledge.svg` (emerald book on rounded square) |
| Page title | "Knowledge Base — HKI Innovation" |
| Join page title | "Join Knowledge Base — HKI Innovation" |
| Sidebar brand | 📖 Knowledge Base / Self-Service |
| Stream badge | Emerald pill with green dot + stream icon & name |

---

## Technical Implementation

| Aspect | Detail |
|--------|--------|
| **Routing** | `/knowledge/welcome` (public), `/knowledge/join` (public), `/knowledge` (protected, manager+) |
| **Auth guard** | `usePermissions()` — admin or manager role required |
| **State management** | `KnowledgeCtx` React context shares `tab`, `selectedStream`, `streamLabel`, `isAdmin` between sidebar and content |
| **Stream scoping** | URL param `?stream={id}`, `useScope()` for available streams, no in-app dropdown — always stream-scoped |
| **Favicon/title** | `useEffect` swaps favicon + document title on mount, restores on unmount |
| **Data fetching** | tRPC queries: `knowledge.stats`, `knowledge.graphStats`, `knowledge.listJobs`, `knowledge.listDocuments` |
| **Org isolation** | `org_id` from JWT — all data scoped to authenticated org |

---

## Dependencies

- [x] Value stream CRUD (admin StreamsPage)
- [x] Knowledge collections CRUD (admin.createCollection, admin.listCollections, admin.deleteCollection)
- [x] Invite system (admin.createInvite, admin.acceptInvite)
- [x] Knowledge tRPC router (knowledge.stats, knowledge.listDocuments, knowledge.listJobs, etc.)
- [x] RBAC permissions (manager+ for knowledge access)
- [x] useScope hook (stream assignment + admin sees all)
- [x] Sidebar UI components (SidebarProvider, Sidebar, SidebarInset, etc.)
- [ ] Document AI integration (for production-grade chunking)
- [ ] Gemini API for gap analysis + content generation (Phase 3)
- [ ] Pub/Sub pipeline triggers (for async ingestion)

---

## Definition of Done

- [x] All entry points work (admin stream row, stream form, welcome, join, direct URL)
- [x] Sidebar navigation with grouped sections
- [x] Breadcrumb bar with clickable navigation segments
- [x] Custom branding (favicon, title, emerald color scheme)
- [x] Stream scoping via URL param, displayed in breadcrumb badge and overview header
- [x] Access denied screen with onboarding links
- [x] TypeScript compiles with zero errors
- [ ] All 7 tabs render with real data from tRPC
- [ ] End-to-end invite flow tested (generate code → accept → access KB)
- [ ] Visual QA in both light and dark mode
- [ ] Mobile responsive (sidebar collapses, breadcrumbs truncate)
