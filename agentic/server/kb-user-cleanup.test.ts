import { describe, expect, it } from "vitest";

import { buildCleanupPlan } from "../scripts/kb-user-cleanup";

describe("buildCleanupPlan", () => {
  it("keeps the current session row when duplicate email cleanup is targeted", () => {
    const plan = buildCleanupPlan(
      [
        {
          id: 10,
          openId: "google-user",
          name: "Hghebrechristos",
          email: "hghebrechristos@hki.com",
          role: "admin",
          department: null,
          isActive: 1,
          loginMethod: "google",
          valueStreams: null,
          assignedStreams: [],
          lastSignedIn: new Date("2026-04-16T11:00:00.000Z"),
          createdAt: new Date("2026-04-10T11:00:00.000Z"),
        },
        {
          id: 22,
          openId: "kb-gke-smoke-admin",
          name: "Hghebrechristos",
          email: "hghebrechristos@hki.com",
          role: "admin",
          department: null,
          isActive: 1,
          loginMethod: "google-iap",
          valueStreams: null,
          assignedStreams: [],
          lastSignedIn: new Date("2026-04-16T11:05:00.000Z"),
          createdAt: new Date("2026-04-16T11:05:00.000Z"),
        },
      ],
      10,
      {
        duplicateEmails: ["hghebrechristos@hki.com"],
        includeHvsi: true,
        deleteSyntheticUsers: false,
      }
    );

    expect(plan.duplicateGroups).toBe(1);
    expect(plan.entries).toHaveLength(2);
    expect(plan.entries.find(entry => entry.user.id === 10)?.action).toBe(
      "keep"
    );
    expect(plan.entries.find(entry => entry.user.id === 22)?.action).toBe(
      "deactivate"
    );
  });

  it("flags active and inactive hvsi users separately", () => {
    const plan = buildCleanupPlan(
      [
        {
          id: 31,
          openId: "hvsi-gke-debug-31",
          name: "Hvsi-Gke-Debug",
          email: "hvsi-gke-debug-31@hki.com",
          role: "viewer",
          department: null,
          isActive: 1,
          loginMethod: "google-iap",
          valueStreams: null,
          assignedStreams: [],
          lastSignedIn: null,
          createdAt: null,
        },
        {
          id: 32,
          openId: "hvsi-gke-readiness-32",
          name: "Hvsi-Gke-Readiness",
          email: "hvsi-gke-readiness-32@hki.com",
          role: "viewer",
          department: null,
          isActive: 0,
          loginMethod: "google-iap",
          valueStreams: null,
          assignedStreams: [],
          lastSignedIn: null,
          createdAt: null,
        },
      ],
      999,
      {
        duplicateEmails: [],
        includeHvsi: true,
        deleteSyntheticUsers: false,
      }
    );

    expect(plan.syntheticMatches).toBe(2);
    expect(plan.entries.find(entry => entry.user.id === 31)?.action).toBe(
      "deactivate"
    );
    expect(plan.entries.find(entry => entry.user.id === 32)?.action).toBe(
      "already-inactive"
    );
  });

  it("deletes synthetic prod e2e users when deletion is enabled", () => {
    const plan = buildCleanupPlan(
      [
        {
          id: 41,
          openId: "prod-e2e-41",
          name: "Prod E2E User",
          email: null,
          role: "viewer",
          department: null,
          isActive: 1,
          loginMethod: "google-iap",
          valueStreams: null,
          assignedStreams: [],
          lastSignedIn: null,
          createdAt: null,
        },
      ],
      999,
      {
        duplicateEmails: [],
        includeHvsi: true,
        deleteSyntheticUsers: true,
      }
    );

    expect(plan.syntheticMatches).toBe(1);
    expect(plan.entries.find(entry => entry.user.id === 41)?.action).toBe(
      "delete"
    );
  });
});
