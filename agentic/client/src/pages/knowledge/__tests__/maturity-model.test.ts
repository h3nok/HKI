/**
 * Maturity Model — Unit Test
 * Verifies that brand-new streams do not inherit readiness points from shared platform health.
 * Run: npx tsx agentic/client/src/pages/knowledge/__tests__/maturity-model.test.ts
 */

import { computeMaturity } from "../components/overview/maturity-model";

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

console.log(
  "TEST 1 — New stream stays at zero despite healthy shared services"
);
const fresh = computeMaturity({
  docCount: 0,
  chunkCount: 0,
  entityCount: 0,
  cmos: 0,
  avgChunksPerSearch: 0,
  avgTopScore: 0,
  totalIngestJobs: 0,
  ingestSuccessRate: 0,
  avgIngestDurationMs: 0,
  totalEvents: 0,
  uniqueUsers: 0,
  journeyDone: 1,
  journeyTotal: 6,
  servicesUp: 4,
  servicesTotal: 4,
});
assert(fresh.hasEvidence === false, "Fresh stream should report no evidence");
assert(fresh.overall === 0, "Fresh stream should start at 0 readiness");
assert(fresh.ops === 0, "Fresh stream should not inherit shared ops score");
assert(
  fresh.journey === 0,
  "Fresh stream should not count setup steps as readiness yet"
);

console.log("TEST 2 — First stream evidence unlocks a real readiness score");
const active = computeMaturity({
  docCount: 2,
  chunkCount: 40,
  entityCount: 6,
  cmos: 2100,
  avgChunksPerSearch: 3.2,
  avgTopScore: 0.74,
  totalIngestJobs: 3,
  ingestSuccessRate: 1,
  avgIngestDurationMs: 12000,
  totalEvents: 18,
  uniqueUsers: 4,
  journeyDone: 3,
  journeyTotal: 6,
  servicesUp: 4,
  servicesTotal: 4,
});
assert(active.hasEvidence === true, "Active stream should report evidence");
assert(
  active.overall > 0,
  "Active stream should compute a non-zero readiness score"
);
assert(
  active.ops === 100,
  "Active stream should include ops once evidence exists"
);
assert(
  active.journey > 0,
  "Active stream should include journey once evidence exists"
);

console.log(`\n${"=".repeat(50)}`);
if (fail === 0) {
  console.log(`ALL ${pass} ASSERTIONS PASSED`);
} else {
  console.log(`${fail} FAILED, ${pass} passed`);
  process.exit(1);
}
