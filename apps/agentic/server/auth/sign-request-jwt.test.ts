import { afterEach, describe, expect, it } from "vitest";
import { jwtVerify } from "jose";

import type { User } from "../../drizzle/schema";
import { signRequestJwt, signRequestJwtWithEnvelope } from "./sign-request-jwt";

const ORIGINAL_SERVICE_AUTH_SECRET = process.env.SERVICE_AUTH_SECRET;
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET;
const ORIGINAL_KB_HERMETIC_ISOLATION = process.env.KB_HERMETIC_ISOLATION;

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 1,
    openId: "request-jwt-user",
    name: "Scoped User",
    email: "scoped.user@hki.com",
    loginMethod: "google",
    pngId: null,
    role: "admin",
    department: "Pharmacy",
    orgId: "default",
    valueStreams: "pharmacy,optical",
    isActive: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...overrides,
  };
}

afterEach(() => {
  if (ORIGINAL_SERVICE_AUTH_SECRET === undefined) {
    delete process.env.SERVICE_AUTH_SECRET;
  } else {
    process.env.SERVICE_AUTH_SECRET = ORIGINAL_SERVICE_AUTH_SECRET;
  }

  if (ORIGINAL_JWT_SECRET === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET;
  }

  if (ORIGINAL_KB_HERMETIC_ISOLATION === undefined) {
    delete process.env.KB_HERMETIC_ISOLATION;
  } else {
    process.env.KB_HERMETIC_ISOLATION = ORIGINAL_KB_HERMETIC_ISOLATION;
  }
});

describe("signRequestJwt", () => {
  it("encodes the narrowed stream scope for downstream services", async () => {
    process.env.SERVICE_AUTH_SECRET = "unit-test-service-secret";
    delete process.env.JWT_SECRET;
    process.env.KB_HERMETIC_ISOLATION = "true";

    const token = await signRequestJwt(makeUser(), "pharmacy", ["pharmacy"]);

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode("unit-test-service-secret"),
      {
        issuer: "agentic-bff",
        audience: "internal-services",
      }
    );

    expect(payload.scope).toBe("pharmacy");
    expect(payload.scopes).toEqual(["pharmacy"]);
    expect(payload.stream_id).toBe("pharmacy");
    expect(payload.org_id).toBe("default");
  });

  it("returns a sanitized HKI envelope without token material", async () => {
    process.env.SERVICE_AUTH_SECRET = "unit-test-service-secret";
    delete process.env.JWT_SECRET;
    process.env.KB_HERMETIC_ISOLATION = "true";

    const { token, envelope } = await signRequestJwtWithEnvelope(
      makeUser(),
      "pharmacy",
      ["pharmacy"]
    );

    expect(token).toMatch(/^[^.]+\.[^.]+\.[^.]+$/);
    expect(envelope.envelope_version).toBe("hki.request.v1");
    expect(envelope.issuer).toBe("agentic-bff");
    expect(envelope.audience).toBe("internal-services");
    expect(envelope.boundary).toMatchObject({
      scope: "pharmacy",
      stream_id: "pharmacy",
      hermetic: true,
    });
    expect(envelope.boundary.scopes).toEqual(["pharmacy"]);
    expect(envelope.principal).toMatchObject({
      id: "1",
      name: "Scoped User",
      role: "admin",
    });
    expect(envelope.token_material).toBe("redacted");
    expect(JSON.stringify(envelope)).not.toContain(token);
  });

  it("fails closed when hermetic isolation omits an explicit scope", async () => {
    process.env.SERVICE_AUTH_SECRET = "unit-test-service-secret";
    delete process.env.JWT_SECRET;
    process.env.KB_HERMETIC_ISOLATION = "true";

    await expect(signRequestJwt(makeUser())).rejects.toThrow(
      /requires an explicit non-global downstream stream scope/
    );
  });

  it("fails closed when hermetic isolation receives an explicit global scope", async () => {
    process.env.SERVICE_AUTH_SECRET = "unit-test-service-secret";
    delete process.env.JWT_SECRET;
    process.env.KB_HERMETIC_ISOLATION = "true";

    await expect(
      signRequestJwt(makeUser(), "global", ["global"])
    ).rejects.toThrow(
      /requires an explicit non-global downstream stream scope/
    );
  });

  it("fails closed when hermetic isolation receives global in downstream scopes", async () => {
    process.env.SERVICE_AUTH_SECRET = "unit-test-service-secret";
    delete process.env.JWT_SECRET;
    process.env.KB_HERMETIC_ISOLATION = "true";

    await expect(
      signRequestJwt(makeUser(), "pharmacy", ["pharmacy", "global"])
    ).rejects.toThrow(
      /requires an explicit non-global downstream stream scope/
    );
  });
});
