import { describe, it, expect } from "vitest";
import {
  determineUserRole,
  deriveOrgId,
  extractDepartment,
  isSuperAdminEmail,
  resolveLoginRole,
} from "./google-oauth";

// ─── determineUserRole ────────────────────────────────────────────────────────

describe("determineUserRole", () => {
  it("returns admin for configured super-admin email", () => {
    expect(determineUserRole(null, "hghebrechristos@hki.com")).toBe("admin");
    expect(determineUserRole("OPR456", "HGHEBRECHRISTOS@COSTCO.COM")).toBe(
      "admin"
    );
  });

  it("returns viewer for corporate email when pngId is null", () => {
    expect(determineUserRole(null, "anyone@hki.com")).toBe("viewer");
  });

  it("returns viewer for non-corporate email when pngId is null", () => {
    expect(determineUserRole(null, "someone@gmail.com")).toBe("viewer");
  });

  it("returns admin for ADM-prefixed pngId", () => {
    expect(determineUserRole("ADM001", "a@hki.com")).toBe("admin");
  });

  it("returns manager for MGR-prefixed pngId", () => {
    expect(determineUserRole("MGR123", "a@hki.com")).toBe("manager");
  });

  it("returns operator for OPR-prefixed pngId", () => {
    expect(determineUserRole("OPR456", "a@hki.com")).toBe("operator");
  });

  it("returns viewer for corporate email with unrecognised pngId prefix", () => {
    expect(determineUserRole("EMP999", "a@hki.com")).toBe("viewer");
    expect(determineUserRole("", "a@hki.com")).toBe("viewer");
  });

  it("falls back to viewer for lowercase or unrecognised corporate prefixes", () => {
    expect(determineUserRole("adm001", "a@hki.com")).toBe("viewer");
    expect(determineUserRole("mgr001", "a@hki.com")).toBe("viewer");
  });
});

describe("isSuperAdminEmail", () => {
  it("matches configured emails case-insensitively", () => {
    expect(isSuperAdminEmail("hghebrechristos@hki.com")).toBe(true);
    expect(isSuperAdminEmail("HGHEBRECHRISTOS@COSTCO.COM")).toBe(true);
    expect(isSuperAdminEmail("other.user@hki.com")).toBe(false);
  });
});

describe("resolveLoginRole", () => {
  it("preserves an existing manually assigned platform role", () => {
    expect(resolveLoginRole("admin", "viewer", "someone@hki.com")).toBe(
      "admin"
    );
    expect(resolveLoginRole("manager", "viewer", "someone@hki.com")).toBe(
      "manager"
    );
  });

  it("falls back to the derived role for a first-time or invalid user role", () => {
    expect(resolveLoginRole(undefined, "operator", "someone@hki.com")).toBe(
      "operator"
    );
    expect(resolveLoginRole("unknown", "viewer", "someone@hki.com")).toBe(
      "viewer"
    );
  });

  it("still forces configured super-admin emails to admin", () => {
    expect(
      resolveLoginRole("viewer", "viewer", "hghebrechristos@hki.com")
    ).toBe("admin");
  });
});

// ─── deriveOrgId ─────────────────────────────────────────────────────────────

describe("deriveOrgId", () => {
  it("extracts org from a simple corporate hd claim", () => {
    expect(deriveOrgId({ hd: "hki.com" })).toBe("hki");
  });

  it("falls back to email domain when hd is gmail.com", () => {
    expect(deriveOrgId({ hd: "gmail.com" }, "user@hki.com")).toBe("hki");
  });

  it("falls back to email domain when hd is googlemail.com", () => {
    expect(deriveOrgId({ hd: "googlemail.com" }, "user@hki.com")).toBe(
      "hki"
    );
  });

  it("falls back to email domain when hd is absent", () => {
    expect(deriveOrgId({}, "user@acme.org")).toBe("acme");
  });

  it('returns "default" for gmail email with no usable hd', () => {
    expect(deriveOrgId({}, "someone@gmail.com")).toBe("default");
  });

  it('returns "default" when both hd and email are absent/gmail', () => {
    expect(deriveOrgId({})).toBe("default");
    expect(deriveOrgId({ hd: "gmail.com" })).toBe("default");
  });

  it("handles a subdomain hd with a short TLD extension (e.g. co.uk)", () => {
    // "corp.example.co.uk" — last segment "uk", second-last "co" (length 2 ≤ 3)
    // → strip last two → "corp.example"
    expect(deriveOrgId({ hd: "corp.example.co.uk" })).toBe("corp.example");
  });

  it("handles a standard two-segment hd", () => {
    expect(deriveOrgId({ hd: "acme.io" })).toBe("acme");
  });
});

// ─── extractDepartment ────────────────────────────────────────────────────────

describe("extractDepartment", () => {
  it("returns department from profile.organizations", () => {
    const profile = { organizations: [{ department: "Pharmacy" }] };
    expect(extractDepartment("user@hki.com", profile)).toBe("Pharmacy");
  });

  it("prefers first org entry when multiple exist", () => {
    const profile = {
      organizations: [
        { department: "Pharmacy" },
        { department: "Fresh Foods" },
      ],
    };
    expect(extractDepartment("user@hki.com", profile)).toBe("Pharmacy");
  });

  it("falls back to email prefix suffix when no organizations", () => {
    // "john-pharmacy@hki.com" → emailParts = ["john", "pharmacy"] → last = "pharmacy"
    expect(extractDepartment("john-pharmacy@hki.com", {})).toBe("pharmacy");
  });

  it("returns null when email has no dash and profile has no organizations", () => {
    expect(extractDepartment("john@hki.com", {})).toBeNull();
  });

  it("returns null when organizations array is empty", () => {
    const profile = { organizations: [] };
    expect(extractDepartment("user@hki.com", profile)).toBeNull();
  });

  it("returns null when organizations entry has no department field", () => {
    const profile = { organizations: [{ title: "Manager" }] };
    expect(extractDepartment("user@hki.com", profile)).toBeNull();
  });
});
