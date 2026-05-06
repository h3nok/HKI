import { afterEach, describe, expect, it } from "vitest";
import {
  parseConnectorCredentials,
  storeConnectorCredentials,
} from "./connector-credentials";

const SECRET_ENV_KEYS = [
  "CONNECTOR_CREDENTIALS_SECRET",
  "JWT_SECRET",
  "GOOGLE_CLIENT_SECRET",
] as const;

const ORIGINAL_ENV = Object.fromEntries(
  SECRET_ENV_KEYS.map(key => [key, process.env[key]])
);

afterEach(() => {
  for (const key of SECRET_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("connector credentials storage", () => {
  it("encrypts and decrypts credentials when a secret is configured", () => {
    process.env.CONNECTOR_CREDENTIALS_SECRET = "test-connector-secret";

    const stored = storeConnectorCredentials({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });

    expect(stored.version).toBe(2);
    expect(stored.value).not.toContain("access-token");
    expect(parseConnectorCredentials(stored.value)).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
  });

  it("parses legacy plaintext credentials for existing connector rows", () => {
    expect(
      parseConnectorCredentials(
        JSON.stringify({ access_token: "legacy-access", refresh_token: null })
      )
    ).toEqual({ access_token: "legacy-access", refresh_token: null });
  });

  it("falls back to plaintext storage when no secret is available", () => {
    delete process.env.CONNECTOR_CREDENTIALS_SECRET;
    delete process.env.JWT_SECRET;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const stored = storeConnectorCredentials({ access_token: "dev-token" });

    expect(stored.version).toBe(1);
    expect(stored.value).toBe(JSON.stringify({ access_token: "dev-token" }));
  });
});
