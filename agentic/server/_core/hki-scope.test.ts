import { describe, expect, it } from "vitest";

import {
  isGlobalScope,
  normalizeScopeList,
  resolveRuntimeScope,
} from "./hki-scope";

describe("HKI runtime scope helpers", () => {
  it("normalizes scope lists without changing first-seen casing", () => {
    expect(normalizeScopeList([" pharmacy ", "PHARMACY", "optical"])).toEqual([
      "pharmacy",
      "optical",
    ]);
  });

  it("detects global scope case-insensitively", () => {
    expect(isGlobalScope("global")).toBe(true);
    expect(isGlobalScope(" Global ")).toBe(true);
    expect(isGlobalScope("pharmacy")).toBe(false);
  });

  it("resolves an explicit non-global runtime scope", () => {
    expect(
      resolveRuntimeScope({
        scope: "pharmacy",
        scopes: ["optical", "pharmacy"],
        hermetic: true,
      })
    ).toEqual({
      scope: "pharmacy",
      scopes: ["pharmacy", "optical"],
      streamId: "pharmacy",
    });
  });

  it("preserves legacy global fallback when hermetic isolation is disabled", () => {
    expect(resolveRuntimeScope({ hermetic: false })).toEqual({
      scope: "global",
      scopes: ["global"],
      streamId: undefined,
    });
  });

  it("rejects missing runtime scope when hermetic isolation is enabled", () => {
    expect(() => resolveRuntimeScope({ hermetic: true })).toThrow(
      /requires an explicit non-global downstream stream scope/
    );
  });

  it("rejects global runtime claims when hermetic isolation is enabled", () => {
    expect(() =>
      resolveRuntimeScope({
        scope: "global",
        scopes: ["global"],
        hermetic: true,
      })
    ).toThrow(/requires an explicit non-global downstream stream scope/);
  });
});
