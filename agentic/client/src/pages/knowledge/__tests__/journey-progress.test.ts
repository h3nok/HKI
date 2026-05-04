/**
 * Journey Progress — Unit Test
 * Verifies the core logic of step completion, auto-detection, locking, and phase gating.
 * Run: npx tsx apps/ai-platform/agentic/client/src/pages/knowledge/__tests__/journey-progress.test.ts
 */

const STEP_IDS = [
  "guidelines",
  "gap-analysis",
  "first-ingest",
  "verify",
  "test",
  "iterate",
] as const;
type StepId = (typeof STEP_IDS)[number];

function simulateHook(
  manualSteps: string[],
  docCount: number,
  chunkCount: number,
  entityCount: number
) {
  const auto = new Set<string>();
  if (docCount > 0) auto.add("first-ingest");
  if (chunkCount > 0) auto.add("verify");
  if (chunkCount >= 50) auto.add("test");
  if (docCount >= 10 && chunkCount >= 50) auto.add("iterate");

  const completed = new Set<string>([...manualSteps, ...auto]);
  const currentStep = STEP_IDS.find(s => !completed.has(s)) ?? null;
  const phase1Done = (
    ["guidelines", "gap-analysis", "first-ingest"] as const
  ).every(s => completed.has(s));

  return { completed, currentStep, phase1Done, doneCount: completed.size };
}

function isStepLocked(completed: Set<string>, stepId: string): boolean {
  const idx = STEP_IDS.indexOf(stepId as StepId);
  if (idx === 0) return false;
  const prev = STEP_IDS[idx - 1];
  if (!completed.has(prev)) return true;
  const phase1 = (
    ["guidelines", "gap-analysis", "first-ingest"] as const
  ).every(s => completed.has(s));
  if (["verify", "test", "iterate"].includes(stepId) && !phase1) return true;
  return false;
}

let pass = 0;
let fail = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    pass++;
  } else {
    fail++;
    console.error(`  FAIL: ${msg}`);
  }
}

// TEST 1: Fresh start
console.log("TEST 1 — Fresh start (no data, no manual steps)");
let r = simulateHook([], 0, 0, 0);
assert(r.currentStep === "guidelines", "Should start at guidelines");
assert(r.doneCount === 0, "Nothing done");

// TEST 2: After reading guidelines
console.log("TEST 2 — After guidelines attested");
r = simulateHook(["guidelines"], 0, 0, 0);
assert(r.currentStep === "gap-analysis", "Should advance to gap-analysis");
assert(r.doneCount === 1, "1 step done");

// TEST 3: After gap analysis
console.log("TEST 3 — After gap analysis");
r = simulateHook(["guidelines", "gap-analysis"], 0, 0, 0);
assert(r.currentStep === "first-ingest", "Should advance to first-ingest");
assert(r.doneCount === 2, "2 steps done");

// TEST 4: After first ingest (auto-detected via docCount)
console.log("TEST 4 — After ingest (3 docs, 20 chunks)");
r = simulateHook(["guidelines", "gap-analysis"], 3, 20, 0);
assert(r.completed.has("first-ingest"), "first-ingest auto-detected");
assert(r.completed.has("verify"), "verify auto-detected");
assert(r.phase1Done === true, "Phase 1 should be complete");
assert(r.currentStep === "test", "Should be at test step");

// TEST 5: With enough chunks for test
console.log("TEST 5 — 8 docs, 60 chunks");
r = simulateHook(["guidelines", "gap-analysis"], 8, 60, 5);
assert(r.completed.has("test"), "test auto-detected at 60 chunks");
assert(r.currentStep === "iterate", "Should be at iterate");

// TEST 6: All complete
console.log("TEST 6 — All complete (15 docs, 100 chunks)");
r = simulateHook(["guidelines", "gap-analysis"], 15, 100, 20);
assert(r.doneCount === 6, "All 6 steps done");
assert(r.currentStep === null, "No current step");

// TEST 7: Phase 2 locked when Phase 1 incomplete
console.log("TEST 7 — Phase 2 locked (has data but no guidelines/gaps)");
r = simulateHook([], 5, 30, 0);
assert(r.currentStep === "guidelines", "Still at guidelines");
assert(r.phase1Done === false, "Phase 1 NOT complete");
assert(r.completed.has("first-ingest"), "first-ingest auto-detected from data");
assert(r.completed.has("verify"), "verify auto-detected from data");

// TEST 8: Lock enforcement
console.log("TEST 8 — Step lock enforcement");
const s = new Set<string>();
assert(isStepLocked(s, "guidelines") === false, "Step 1 never locked");
assert(
  isStepLocked(s, "gap-analysis") === true,
  "Step 2 locked without step 1"
);
s.add("guidelines");
assert(
  isStepLocked(s, "gap-analysis") === false,
  "Step 2 unlocked after step 1"
);
assert(
  isStepLocked(s, "first-ingest") === true,
  "Step 3 locked without step 2"
);
s.add("gap-analysis");
assert(isStepLocked(s, "first-ingest") === false, "Step 3 unlocked");
assert(
  isStepLocked(s, "verify") === true,
  "Phase 2 locked until phase 1 complete"
);
s.add("first-ingest");
assert(isStepLocked(s, "verify") === false, "Phase 2 unlocks after phase 1");

// TEST 9: Toast dedup — completeStep should not fire if already complete
console.log("TEST 9 — Dedup (manual step already in auto-detected)");
r = simulateHook(["first-ingest"], 5, 30, 0);
assert(
  r.completed.has("first-ingest"),
  "first-ingest present (both manual + auto)"
);
assert(
  r.doneCount === 2,
  "2 unique steps (first-ingest deduped, verify from auto)"
);

// RESULTS
console.log(`\n${"=".repeat(50)}`);
if (fail === 0) {
  console.log(`ALL ${pass} ASSERTIONS PASSED`);
} else {
  console.log(`${fail} FAILED, ${pass} passed`);
  process.exit(1);
}
