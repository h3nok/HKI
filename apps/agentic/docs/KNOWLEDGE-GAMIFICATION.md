# Knowledge Base — Gamification & Contribution System

> **Status**: Design Proposal v1.0
> **Author**: Platform Team
> **Date**: February 2026
> **Builds on**: KNOWLEDGE-SELF-SERVICE-DESIGN.md, KNOWLEDGE-VALIDATION-AND-PATTERNS.md

---

## 1. The Problem

Knowledge curation is invisible work. The person who uploads the pharmacy SOP that saves 200 agent conversations gets zero recognition. Teams don't know who's contributing, what impact their contributions have, or how close they are to having a truly great knowledge base. Result: knowledge rots, nobody maintains it, the agent gives bad answers, trust erodes.

## 2. The Vision

> **Every contribution is visible, every impact is measured, every milestone is celebrated.**
> Your knowledge lives forever — and so does the credit for building it.

Make knowledge curation feel like building something meaningful — because it is. Show people the ripple effect of their work: "Your pharmacy SOP was cited in 347 agent conversations this week."

---

## 3. Contribution Tracking

### 3.1 What Counts as a Contribution

Every action in the knowledge base generates a **contribution event**:

| Action | Points | Why |
|--------|--------|-----|
| **Upload document** | 10 | Getting content in the door |
| **Upload approved on first review** | +5 bonus | Quality from the start |
| **Review a document** | 8 | Curation is as valuable as creation |
| **Approve a document** | 3 | Decision-making |
| **Reject with detailed feedback** | 5 | Constructive feedback is hard work |
| **Fix a flagged contradiction** | 15 | Protecting knowledge integrity |
| **Fill a detected gap** | 20 | Highest-impact contribution |
| **Update a stale document** | 12 | Maintenance is unglamorous but critical |
| **Run a test query** | 2 | Verification matters |
| **Report an incorrect answer** | 5 | Feedback loop contribution |
| **Invite a team member** | 3 | Growing the contributor base |
| **Achieve 90+ quality score** | +10 bonus | Excellence rewarded |
| **Document cited in agent response** | 1 (passive) | Your work helping users (auto-awarded) |

### 3.2 Impact Tracking (The Forever Metric)

This is the emotional core. Every document tracks its lifetime impact:

```
┌─────────────────────────────────────────────────────────┐
│  📄 Pharmacy PDMP Verification Procedures                │
│  Uploaded by Maria · February 12, 2026                   │
│                                                          │
│  ┌─── Lifetime Impact ─────────────────────────────────┐ │
│  │                                                      │ │
│  │  🎯 Cited in 347 agent conversations                 │ │
│  │  👥 Helped 89 unique users                           │ │
│  │  ⏱️ Saved ~28 hours of manual lookup                 │ │
│  │  📈 92% positive feedback on answers using this doc  │ │
│  │  🏆 Ranked #3 most impactful doc in Pharmacy stream  │ │
│  │                                                      │ │
│  │  "This document has been helping people since         │ │
│  │   February 12, 2026 — 5 days and counting."          │ │
│  └──────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**"Lives forever"** — The contribution history never deletes. Even if a document is superseded, the original contributor's impact record persists: *"Maria's original PDMP doc helped 2,341 people over 8 months before being updated."*

---

## 4. Achievement & Badge System

### 4.1 Badge Tiers

```
🥉 Bronze    — Getting started (anyone can earn in first session)
🥈 Silver    — Consistent contributor (1–2 weeks of engagement)
🥇 Gold      — Domain expert (sustained high-quality contributions)
💎 Diamond   — Legendary (rare, visible to entire organization)
```

### 4.2 Badge Catalog

#### Contributor Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **First Upload** | 🥉 | 🌱 | Upload your first document | *"Every knowledge base starts with a single document"* |
| **Library Builder** | 🥈 | 📚 | Upload 10 documents | *"Building a foundation of knowledge"* |
| **Knowledge Architect** | 🥇 | 🏗️ | Upload 50 documents | *"Shaping how your team understands the world"* |
| **Living Encyclopedia** | 💎 | 📖 | Upload 200 documents | *"Your contributions define this domain"* |

#### Quality Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **Clean Slate** | 🥉 | ✨ | First doc with 90+ quality score | *"Quality from day one"* |
| **Perfectionist** | 🥈 | 💯 | 5 docs with 95+ quality score | *"Your standards are the standard"* |
| **Zero Defects** | 🥇 | 🎯 | 10 consecutive uploads approved without revision | *"Flawless track record"* |
| **Gold Standard** | 💎 | 👑 | Highest average quality score in your stream (30+ docs) | *"The benchmark others aspire to"* |

#### Curation Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **First Review** | 🥉 | 👁️ | Review your first document | *"Fresh eyes make better knowledge"* |
| **Gatekeeper** | 🥈 | 🛡️ | Review 25 documents | *"Trusted guardian of knowledge quality"* |
| **Contradiction Hunter** | 🥇 | 🔍 | Catch 5 contradictions during review | *"Nothing gets past you"* |
| **Quality Czar** | 💎 | ⚖️ | 100 reviews with detailed feedback | *"Your reviews make everyone better"* |

#### Impact Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **First Citation** | 🥉 | 💬 | Your document cited in an agent response | *"Your knowledge is already helping people"* |
| **Crowd Favorite** | 🥈 | ❤️ | A document you uploaded cited 100+ times | *"The people have spoken"* |
| **Knowledge Hero** | 🥇 | 🦸 | Your documents collectively cited 1,000+ times | *"A thousand conversations improved"* |
| **Hall of Fame** | 💎 | 🏛️ | Your documents cited 10,000+ times | *"Your work has become institutional knowledge"* |

#### Maintenance Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **Spring Cleaning** | 🥉 | 🧹 | Update your first stale document | *"Fresh knowledge, fresh answers"* |
| **Evergreen** | 🥈 | 🌲 | Keep 10+ documents under 30 days old | *"Always current, always relevant"* |
| **Zero Staleness** | 🥇 | ♻️ | Maintain 100% freshness for your stream for 30 days | *"Not a single stale byte"* |

#### Gap Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **Gap Filler** | 🥉 | 🧩 | Fill your first detected knowledge gap | *"The agent just got smarter"* |
| **Coverage Champion** | 🥈 | 📊 | Bring stream coverage from <70% to >85% | *"From gaps to greatness"* |
| **Full Spectrum** | 🥇 | 🌈 | Achieve 95%+ coverage for your stream | *"Complete domain mastery"* |
| **Gap Eliminator** | 💎 | 🎪 | Fill 50 detected gaps across all streams | *"No question goes unanswered"* |

#### Streak Badges

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **Getting Started** | 🥉 | 🔥 | 3-day contribution streak | *"Momentum is building"* |
| **On a Roll** | 🥈 | ⚡ | 7-day contribution streak | *"A week of dedication"* |
| **Unstoppable** | 🥇 | 🚀 | 30-day contribution streak | *"A month of excellence"* |
| **Relentless** | 💎 | 💫 | 90-day contribution streak | *"Three months. Unwavering."* |

#### Team Badges (Awarded to Entire Stream Team)

| Badge | Tier | Icon | Criteria | Flavor Text |
|-------|------|------|----------|-------------|
| **Team Kickoff** | 🥉 | 🤝 | 3+ contributors in the stream | *"Knowledge is a team sport"* |
| **Knowledge Squad** | 🥈 | 👥 | 5+ contributors, each with 10+ uploads | *"A true knowledge team"* |
| **Center of Excellence** | 🥇 | 🏆 | 90%+ coverage, 90+ avg quality, 5+ contributors | *"The model every stream aspires to"* |
| **Legendary Stream** | 💎 | ⭐ | #1 ranked stream by composite score for 30 days | *"The best in the organization"* |

#### Secret Badges (Unlocked by Surprise)

| Badge | Icon | Criteria | Flavor Text |
|-------|------|----------|-------------|
| **Night Owl** | 🦉 | Upload a document after midnight | *"Knowledge never sleeps"* |
| **Speed Demon** | ⚡ | Upload and get approval in under 2 minutes | *"Fast and flawless"* |
| **The Fixer** | 🔧 | Fix 3 rejected documents from other contributors | *"Every team needs a fixer"* |
| **Polyglot** | 🌍 | Contribute to 3+ different streams | *"Cross-domain knowledge architect"* |
| **Day One** | 🎂 | One of the first 5 contributors to the platform | *"You were here from the beginning"* |
| **Centurion** | 💯 | Earn 100 total badges | *"The completionist"* |

---

## 5. Streaks & Engagement

### 5.1 Streak System

```
┌─────────────────────────────────────────────────────┐
│  🔥 7-Day Streak!                                    │
│  ░░█████████████████████████████░░░░░░░░░░░░░░░░    │
│  M  T  W  T  F  S  S  M  T  W  T  F  S  S          │
│  ✓  ✓  ✓  ✓  ✓  ✓  ✓  ·  ·  ·  ·  ·  ·  ·        │
│                                                      │
│  Keep going! 23 more days for 🥇 "Unstoppable"      │
└─────────────────────────────────────────────────────┘
```

A streak day is earned by making **any** contribution (upload, review, test query, update). Low bar to maintain, encourages daily engagement without being burdensome.

### 5.2 Streak Multiplier

Active streaks multiply points:

| Streak | Multiplier |
|--------|-----------|
| 1–2 days | 1.0x |
| 3–6 days | 1.2x |
| 7–13 days | 1.5x |
| 14–29 days | 1.8x |
| 30+ days | 2.0x |

### 5.3 Streak Recovery (Grace Period)

Miss a day? You have a **1-day grace period** that can be activated once per streak. This prevents frustration from a single busy day killing a 29-day streak.

```
"You missed yesterday. Use your Streak Shield to keep your 
 29-day streak alive? [🛡️ Use Shield] [Let it go]"
```

---

## 6. Leaderboards

### 6.1 Stream Leaderboard

```
┌─────────────────────────────────────────────────────────────┐
│  🏆 Pharmacy Knowledge Champions — This Month               │
│                                                              │
│  #1  👑 Maria R.     342 pts  🔥14-day streak  12 badges    │
│      "Knowledge Architect" · "Contradiction Hunter"          │
│      Impact: 89 conversations helped this month              │
│                                                              │
│  #2  🥈 James T.     218 pts  🔥7-day streak   8 badges     │
│      "Gatekeeper" · "Perfectionist"                          │
│      Impact: 45 conversations helped this month              │
│                                                              │
│  #3  🥉 Priya S.     156 pts  🔥3-day streak   5 badges     │
│      "Library Builder" · "Gap Filler"                        │
│      Impact: 23 conversations helped this month              │
│                                                              │
│  #4     David K.     98 pts                     3 badges     │
│  #5     Sarah L.     72 pts                     2 badges     │
│                                                              │
│  [All Time] [This Month] [This Week]                         │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Organization-Wide Leaderboard

```
┌─────────────────────────────────────────────────────────────┐
│  🌟 Top Streams — Organization Knowledge Health              │
│                                                              │
│  #1  🏥 Pharmacy        Coverage: 94%  Quality: 91  🏆x3    │
│      "Center of Excellence" · 8 contributors · 142 docs     │
│                                                              │
│  #2  📦 Warehouse Ops   Coverage: 87%  Quality: 88  🏆x1    │
│      "Knowledge Squad" · 6 contributors · 98 docs           │
│                                                              │
│  #3  💳 Membership      Coverage: 72%  Quality: 85          │
│      Needs: gap coverage · 3 contributors · 45 docs         │
│                                                              │
│  #4  🛒 Merchandising   Coverage: 61%  Quality: 79          │
│      Needs: more contributors + quality improvement          │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Composite Score Formula

```
Stream Score = (Coverage × 0.35) + (Quality × 0.25) + (Freshness × 0.20) + (TeamSize × 0.10) + (Activity × 0.10)

Where:
  Coverage  = 0–100 (% of detected topics covered)
  Quality   = 0–100 (average document quality score)
  Freshness = 0–100 (% of docs under 90 days old)
  TeamSize  = min(100, contributors × 20)
  Activity  = min(100, contributions_this_month × 2)
```

---

## 7. Notifications & Celebrations

### 7.1 Achievement Unlocked Toast

When a badge is earned, a celebratory toast appears:

```
┌────────────────────────────────────────────────┐
│  🎉 Achievement Unlocked!                       │
│                                                  │
│  🦸 Knowledge Hero                               │
│  "A thousand conversations improved"             │
│                                                  │
│  Your documents have been cited 1,000 times!     │
│  [Share] [View Profile]                          │
└────────────────────────────────────────────────┘
```

### 7.2 Passive Impact Notifications

Weekly digest showing the impact of your contributions:

```
┌────────────────────────────────────────────────┐
│  📊 Your Weekly Knowledge Impact                 │
│  Week of Feb 10–16, 2026                         │
│                                                  │
│  Your documents were cited 47 times this week    │
│  You helped 12 unique users find answers         │
│  Your Pharmacy SOP is the #2 most-cited doc      │
│                                                  │
│  🔥 14-day streak! Keep it going!                │
│  Next badge: "Unstoppable" (16 more days)        │
│                                                  │
│  [View Full Stats]                               │
└────────────────────────────────────────────────┘
```

### 7.3 Team Milestone Celebrations

When a stream hits a milestone, everyone on the team sees:

```
┌────────────────────────────────────────────────┐
│  🎊 MILESTONE: Pharmacy reached 90% coverage!   │
│                                                  │
│  The Pharmacy team just unlocked:                │
│  🏆 "Center of Excellence"                       │
│                                                  │
│  Contributors: Maria, James, Priya, David, Sarah │
│  Documents: 142 · Chunks: 3,420 · Entities: 891  │
│                                                  │
│  "The model every stream aspires to"             │
└────────────────────────────────────────────────┘
```

---

## 8. Contributor Profile

Every user gets a **Knowledge Contributor Profile** — a permanent record of their contributions.

```
┌─────────────────────────────────────────────────────────────────┐
│  Maria Rodriguez — Knowledge Contributor                         │
│  Pharmacy Operations Lead · Member since Feb 2026                │
│                                                                  │
│  ┌─── Stats ────────────────────────────────────────────────┐   │
│  │  📄 52 documents uploaded                                 │   │
│  │  👁️ 34 documents reviewed                                │   │
│  │  💬 2,341 conversations helped (lifetime)                 │   │
│  │  👥 189 unique users helped                               │   │
│  │  ⏱️ ~195 hours of manual lookup saved                     │   │
│  │  🔥 Current streak: 14 days                               │   │
│  │  ⭐ 1,842 total points                                    │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Badges (18 earned) ───────────────────────────────────┐   │
│  │                                                           │   │
│  │  💎 Hall of Fame      🥇 Knowledge Architect              │   │
│  │  🥇 Zero Defects      🥇 Contradiction Hunter             │   │
│  │  🥈 Library Builder   🥈 Gatekeeper                       │   │
│  │  🥈 Perfectionist     🥈 Evergreen                        │   │
│  │  🥈 Coverage Champion 🥈 On a Roll                        │   │
│  │  🥉 First Upload      🥉 First Review                     │   │
│  │  🥉 First Citation    🥉 Gap Filler                       │   │
│  │  🥉 Clean Slate       🥉 Spring Cleaning                  │   │
│  │  🥉 Getting Started   🦉 Night Owl (secret!)              │   │
│  │                                                           │   │
│  │  Next: 🥇 "Unstoppable" — 16 more days of streak         │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Top Contributions ────────────────────────────────────┐   │
│  │                                                           │   │
│  │  #1  Pharmacy PDMP Procedures          cited 892x         │   │
│  │  #2  Controlled Substance Handling     cited 634x         │   │
│  │  #3  Immunization Services Guide       cited 415x         │   │
│  │  #4  Insurance Billing Codes 2026      cited 289x         │   │
│  │  #5  Vaccine Storage Requirements      cited 111x         │   │
│  │                                                           │   │
│  │  "Maria's contributions have helped 189 people across     │   │
│  │   2,341 conversations. Her work lives in the Pharmacy     │   │
│  │   knowledge base, improving every interaction."           │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─── Contribution History ─────────────────────────────────┐   │
│  │  Feb 17  📄 Updated "PDMP Procedures" (+15 pts)           │   │
│  │  Feb 16  👁️ Reviewed 3 documents (+24 pts)               │   │
│  │  Feb 15  📄 Uploaded "Vaccine Storage Guide" (+10 pts)    │   │
│  │  Feb 14  🧩 Filled gap: "e-prescribing rules" (+20 pts)  │   │
│  │  Feb 13  👁️ Caught contradiction in billing doc (+15 pts)│   │
│  │  ...                                                      │   │
│  └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Model

### 9.1 Database Tables (Drizzle Schema)

```typescript
// ── Contribution Events ─────────────────────────────────────
export const knowledgeContributions = mysqlTable('knowledge_contributions', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  valueStreamId: varchar('value_stream_id', { length: 255 }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  // 'upload' | 'review' | 'approve' | 'reject' | 'update' | 'fill_gap' |
  // 'fix_contradiction' | 'test_query' | 'report_error' | 'invite' | 'citation'
  documentId: varchar('document_id', { length: 36 }),
  points: int('points').notNull().default(0),
  multiplier: float('multiplier').notNull().default(1.0),
  metadata: json('metadata'),             // action-specific details
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ── User Achievement State ──────────────────────────────────
export const knowledgeProfiles = mysqlTable('knowledge_profiles', {
  userId: varchar('user_id', { length: 255 }).primaryKey(),
  totalPoints: int('total_points').notNull().default(0),
  currentStreak: int('current_streak').notNull().default(0),
  longestStreak: int('longest_streak').notNull().default(0),
  lastContributionDate: date('last_contribution_date'),
  streakShieldAvailable: boolean('streak_shield_available').notNull().default(true),
  totalUploads: int('total_uploads').notNull().default(0),
  totalReviews: int('total_reviews').notNull().default(0),
  totalCitations: int('total_citations').notNull().default(0),
  totalUsersHelped: int('total_users_helped').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// ── Earned Badges ───────────────────────────────────────────
export const knowledgeBadges = mysqlTable('knowledge_badges', {
  id: varchar('id', { length: 36 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  badgeKey: varchar('badge_key', { length: 100 }).notNull(),
  // e.g. 'first_upload', 'knowledge_architect', 'hall_of_fame'
  tier: varchar('tier', { length: 20 }).notNull(),
  // 'bronze' | 'silver' | 'gold' | 'diamond' | 'secret'
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
  metadata: json('metadata'),              // context of how it was earned
});

// ── Document Impact Tracking ────────────────────────────────
export const knowledgeDocumentImpact = mysqlTable('knowledge_document_impact', {
  documentId: varchar('document_id', { length: 36 }).primaryKey(),
  uploaderId: varchar('uploader_id', { length: 255 }).notNull(),
  valueStreamId: varchar('value_stream_id', { length: 255 }).notNull(),
  citationCount: int('citation_count').notNull().default(0),
  uniqueUsersHelped: int('unique_users_helped').notNull().default(0),
  positiveRate: float('positive_rate').notNull().default(0),
  lastCitedAt: timestamp('last_cited_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// ── Stream Leaderboard (materialized, updated hourly) ───────
export const knowledgeStreamScores = mysqlTable('knowledge_stream_scores', {
  valueStreamId: varchar('value_stream_id', { length: 255 }).primaryKey(),
  compositeScore: float('composite_score').notNull().default(0),
  coverageScore: float('coverage_score').notNull().default(0),
  qualityScore: float('quality_score').notNull().default(0),
  freshnessScore: float('freshness_score').notNull().default(0),
  contributorCount: int('contributor_count').notNull().default(0),
  activityScore: float('activity_score').notNull().default(0),
  rank: int('rank').notNull().default(0),
  teamBadges: json('team_badges'),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});
```

### 9.2 Badge Registry (Code, Not DB)

Badges are defined in code with unlock criteria as functions:

```typescript
// src/domain/badges.ts
interface BadgeDefinition {
  key: string;
  name: string;
  icon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond' | 'secret';
  description: string;
  flavorText: string;
  check: (profile: KnowledgeProfile, event?: ContributionEvent) => boolean;
}

const BADGE_CATALOG: BadgeDefinition[] = [
  {
    key: 'first_upload',
    name: 'First Upload',
    icon: '🌱',
    tier: 'bronze',
    description: 'Upload your first document',
    flavorText: 'Every knowledge base starts with a single document',
    check: (p) => p.totalUploads >= 1,
  },
  {
    key: 'knowledge_hero',
    name: 'Knowledge Hero',
    icon: '🦸',
    tier: 'gold',
    description: 'Your documents collectively cited 1,000+ times',
    flavorText: 'A thousand conversations improved',
    check: (p) => p.totalCitations >= 1000,
  },
  // ... full catalog
];
```

---

## 10. React Components

### 10.1 Component Tree

```
pages/knowledge/
├── components/
│   ├── gamification/                ← NEW
│   │   ├── ContributorProfile.tsx       — Full profile page with stats, badges, history
│   │   ├── BadgeGrid.tsx                — Badge collection display (earned + locked)
│   │   ├── BadgeCard.tsx                — Single badge with tier glow, icon, tooltip
│   │   ├── BadgeUnlockedToast.tsx       — Celebratory achievement toast (confetti!)
│   │   ├── StreakIndicator.tsx          — Flame icon + day count + progress to next badge
│   │   ├── StreakCalendar.tsx           — GitHub-style contribution heatmap
│   │   ├── StreakShieldModal.tsx         — "Use your shield?" confirmation
│   │   ├── PointsDisplay.tsx            — Animated point counter with multiplier
│   │   ├── LeaderboardTable.tsx         — Stream + org-wide contributor ranking
│   │   ├── StreamRankCard.tsx           — Stream composite score with rank badge
│   │   ├── ImpactCard.tsx              — Lifetime impact stats for a document
│   │   ├── ImpactTimeline.tsx          — Contribution history feed
│   │   ├── WeeklyDigest.tsx            — Weekly impact summary card
│   │   ├── MilestoneToast.tsx          — Team milestone celebration
│   │   └── NextBadgeProgress.tsx        — Progress bar toward next achievable badge
│   │
│   └── (existing tabs enhanced with gamification hooks)
```

### 10.2 Key Libraries

| Library | Purpose |
|---------|---------|
| **canvas-confetti** | Confetti burst on badge unlock (3KB, zero deps) |
| **framer-motion** | Badge entrance animations, point counter, streak flame |
| **@nivo/calendar** | GitHub-style contribution heatmap |
| **@nivo/radar** | Quality radar chart on profile |
| **react-countup** | Animated number counters for stats |
| **sonner** | Toast notifications for achievements |

### 10.3 Integration Points

Gamification hooks into existing tabs:

| Tab | Gamification Integration |
|-----|------------------------|
| **Overview** | Streak indicator, next badge progress, weekly impact summary |
| **Sources** | Points earned per upload, quality bonus indicator |
| **Library** | Impact badges on docs, citation counts, contributor avatar |
| **Gaps** | "Fill this gap for +20 pts" callout on each gap |
| **Test & Verify** | Points for test queries, streak maintenance |
| **Team** | Leaderboard, team badges, contributor profiles |
| **Sidebar** | Streak flame + day count, point total, latest badge |

---

## 11. API Endpoints

### BFF (knowledge.ts tRPC router additions)

```typescript
// Gamification
knowledge.getProfile          — Current user's contributor profile + badges
knowledge.getLeaderboard      — Stream or org-wide leaderboard
knowledge.getStreamScores     — All streams ranked by composite score
knowledge.getDocumentImpact   — Lifetime impact for a specific document
knowledge.getContributions    — Contribution history (paginated)
knowledge.useStreakShield     — Activate streak shield (one-time per streak)
knowledge.getWeeklyDigest    — Weekly impact summary
knowledge.getBadgeCatalog    — All badges with earned/locked status
```

### Backend Processing

Badge checks run after every contribution event:

```
Contribution Event
  → Record in knowledge_contributions
  → Update knowledge_profiles (points, streak, counters)
  → Run badge checks (BADGE_CATALOG.filter(b => b.check(profile)))
  → Award new badges → knowledge_badges
  → If new badge earned → push WebSocket notification → BadgeUnlockedToast
  → Update knowledge_stream_scores (hourly materialized view)
```

Citation counting runs as a background job:

```
Every agent response with citations
  → Extract document_ids from citations
  → Increment knowledge_document_impact.citation_count
  → Track unique user (bloom filter or HLL)
  → Check impact badges for uploader
```

---

## 12. Implementation Priority

| Phase | What | Effort | Impact |
|-------|------|--------|--------|
| **Phase 1** | Contribution tracking + profiles + basic badges (10 badges) | 1 week | Foundation |
| **Phase 2** | Streak system + leaderboards + sidebar integration | 1 week | Daily engagement |
| **Phase 3** | Impact tracking (citation counting) + impact badges | 1 week | Emotional core — "lives forever" |
| **Phase 4** | Full badge catalog (40+ badges) + secret badges + team badges | 1 week | Depth + delight |
| **Phase 5** | Weekly digest + notifications + confetti celebrations | 3 days | Polish |

---

## 13. Design Principles

1. **Celebrate, don't punish** — No negative scores, no "you're falling behind" shame. Only positive reinforcement.
2. **Low floor, high ceiling** — Bronze badges are achievable in 5 minutes. Diamond badges take months of sustained excellence.
3. **Impact over activity** — Citation count and user-helped metrics matter more than raw upload count. Quality > quantity.
4. **Team over individual** — Stream-level badges encourage collaboration. You can't get "Center of Excellence" alone.
5. **Permanence** — Contributions and impact are never deleted. Your work lives forever in the contributor history.
6. **Surprise and delight** — Secret badges reward unexpected behaviors. Discovery is part of the fun.
7. **Non-intrusive** — Gamification enhances the workflow, never blocks it. All celebrations are dismissible toasts.
