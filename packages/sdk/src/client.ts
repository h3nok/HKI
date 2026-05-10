/**
 * @hki/sdk/client — high-level helpers for building HKI-conformant clients.
 *
 * Four entry points:
 *
 * - `mintEnvelope`   — build a complete signed envelope from minimal options
 * - `verifyEnvelope` — parse an unknown value, throw if invalid
 * - `wrap`           — attach an envelope to any HTTP client (fetch, axios, ky…)
 * - `withDomain`     — scope any handler to one active domain
 */

import {
  HKI_VERSION,
  type HkiEnvelope,
  type HkiPurpose,
  type HkiRiskTier,
  type ValidateEnvelopeOptions,
  validateEnvelope,
} from "@hki/runtime";

function generateId(): string {
  const bytes = new Uint8Array(16);
  // Node 24+ and modern browsers both expose globalThis.crypto.getRandomValues
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webcrypto = (globalThis as any).crypto as { getRandomValues(b: Uint8Array): void };
  webcrypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// mintEnvelope
// ---------------------------------------------------------------------------

export interface MintEnvelopeOptions {
  /** Org the envelope is issued for. */
  org_id: string;
  /** Subject (user or agent) the envelope is issued to. */
  subject_id: string;
  /** The single active knowledge domain for this request. */
  active_domain: string;
  /**
   * Full set of domains this subject is authorized to access.
   * Defaults to `[active_domain]`.
   */
  authorized_domains?: readonly string[];
  purpose: HkiPurpose;
  risk_tier: HkiRiskTier;
  policy_pack_id: string;
  issuer: string;
  /** Cryptographic signature. Required at signed runtime boundaries. */
  signature?: string;
  /**
   * Seconds from now until the envelope expires.
   * @default 300
   */
  ttl?: number;
  /**
   * Epoch seconds for `issued_at`. Defaults to `Math.floor(Date.now() / 1000)`.
   */
  issued_at?: number;
  /** Unique envelope ID. Defaults to `crypto.randomUUID()`. */
  envelope_id?: string;
}

/**
 * Build a fully-specified `HkiEnvelope` from minimal options.
 *
 * The returned object passes `validateEnvelope` (without signature check).
 * Gateways must attach a real cryptographic signature before handing the
 * envelope to downstream services.
 *
 * @example
 * const envelope = mintEnvelope({
 *   org_id:         "org_acme",
 *   subject_id:     "user_42",
 *   active_domain:  "payments",
 *   purpose:        "retrieve",
 *   risk_tier:      "read-only",
 *   policy_pack_id: "pp_payments_v1",
 *   issuer:         "urn:hki:api-gateway",
 *   signature:      sign(payload, privateKey),
 * });
 */
export function mintEnvelope(options: MintEnvelopeOptions): HkiEnvelope {
  const now = options.issued_at ?? Math.floor(Date.now() / 1000);
  const ttl = options.ttl ?? 300;

  const envelope: HkiEnvelope = {
    hki_version: HKI_VERSION,
    envelope_id: options.envelope_id ?? generateId(),
    org_id: options.org_id,
    subject_id: options.subject_id,
    active_domain: options.active_domain,
    authorized_domains: options.authorized_domains ?? [options.active_domain],
    purpose: options.purpose,
    risk_tier: options.risk_tier,
    policy_pack_id: options.policy_pack_id,
    issued_at: now,
    expires_at: now + ttl,
    issuer: options.issuer,
    signature: options.signature,
  };

  const result = validateEnvelope(envelope, { now });
  if (!result.ok) {
    const msg = result.issues.map(i => i.message).join("; ");
    throw new Error(`mintEnvelope: invalid options — ${msg}`);
  }

  return envelope;
}

// ---------------------------------------------------------------------------
// verifyEnvelope
// ---------------------------------------------------------------------------

/**
 * Parse and validate a raw value as an `HkiEnvelope`. Throws on failure.
 *
 * Use at service entry points where you want to fail fast rather than
 * inspect the result object.
 *
 * @example
 * const envelope = verifyEnvelope(
 *   JSON.parse(req.headers["x-hki-envelope"] ?? "{}"),
 *   { requireSignature: true }
 * );
 */
export function verifyEnvelope(
  raw: unknown,
  options: ValidateEnvelopeOptions = {}
): HkiEnvelope {
  const result = validateEnvelope(
    raw as Partial<HkiEnvelope>,
    options
  );
  if (!result.ok) {
    const msg = result.issues.map(i => i.message).join("; ");
    throw new Error(`verifyEnvelope: ${msg}`);
  }
  return result.envelope;
}

// ---------------------------------------------------------------------------
// wrap
// ---------------------------------------------------------------------------

/** Shape of a minimal HTTP client that can be wrapped. */
export interface WrappableClient {
  get?: (...args: unknown[]) => unknown;
  post?: (...args: unknown[]) => unknown;
  put?: (...args: unknown[]) => unknown;
  patch?: (...args: unknown[]) => unknown;
  delete?: (...args: unknown[]) => unknown;
  request?: (...args: unknown[]) => unknown;
  [key: string]: unknown;
}

/** The envelope header name used by HKI middleware. */
export const HKI_ENVELOPE_HEADER = "x-hki-envelope" as const;

/**
 * Serialize an envelope to the wire format used by `HkiMiddleware`.
 */
export function serializeEnvelope(envelope: HkiEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Return a `Headers`-compatible object carrying the HKI envelope.
 *
 * Useful when building `fetch` calls manually:
 *
 * @example
 * const headers = envelopeHeaders(envelope);
 * await fetch(url, { method: "POST", headers, body });
 */
export function envelopeHeaders(
  envelope: HkiEnvelope
): Record<typeof HKI_ENVELOPE_HEADER, string> {
  return { [HKI_ENVELOPE_HEADER]: serializeEnvelope(envelope) };
}

/**
 * Wrap any HTTP client so that every method call automatically injects the
 * HKI envelope as the `x-hki-envelope` header.
 *
 * Works with any client whose methods accept a config/options object as the
 * last argument (axios, ky, got, etc.) or a `Headers`-like second argument
 * (fetch-style). The wrapper merges the envelope header into the first
 * object argument that looks like a headers bag.
 *
 * For clients with non-standard shapes, use `envelopeHeaders(envelope)`
 * directly and merge manually.
 *
 * @example
 * // axios
 * const client = wrap(axios.create({ baseURL }), envelope);
 * await client.get("/api/search", { params: { q: "refund" } });
 *
 * @example
 * // fetch
 * const client = wrap({ fetch }, envelope);
 * await client.fetch(url, { method: "POST", body });
 */
export function wrap<T extends WrappableClient>(
  client: T,
  envelope: HkiEnvelope
): T {
  const headerValue = serializeEnvelope(envelope);

  const proxy = new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== "function") return value;

      return function (...args: unknown[]) {
        // Find the first plain-object argument and inject the header into it.
        // For axios/ky: last arg is often a config with a `headers` key.
        // For fetch: second arg is a RequestInit.
        const injected = injectHeader(args, HKI_ENVELOPE_HEADER, headerValue);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (value as any).apply(target, injected);
      };
    },
  });

  return proxy as T;
}

function injectHeader(
  args: unknown[],
  header: string,
  value: string
): unknown[] {
  // Look for the last object argument that can hold headers.
  for (let i = args.length - 1; i >= 0; i--) {
    const arg = args[i];
    if (arg !== null && typeof arg === "object" && !Array.isArray(arg)) {
      const obj = arg as Record<string, unknown>;
      const clone = { ...obj };
      if (clone.headers && typeof clone.headers === "object") {
        clone.headers = { ...(clone.headers as Record<string, unknown>), [header]: value };
      } else {
        clone.headers = { [header]: value };
      }
      const result = [...args];
      result[i] = clone;
      return result;
    }
  }
  // No object arg found — append a headers-only config object.
  return [...args, { headers: { [header]: value } }];
}

// ---------------------------------------------------------------------------
// withDomain
// ---------------------------------------------------------------------------

/**
 * Scope a handler to a specific active domain. Calls with a non-matching
 * envelope are rejected before the handler runs.
 *
 * @example
 * const paymentsRefund = withDomain(
 *   async (envelope, orderId: string) => { ... },
 *   "payments"
 * );
 *
 * // Will throw if envelope.active_domain !== "payments"
 * await paymentsRefund(envelope, "ord_123");
 */
export function withDomain<Args extends unknown[], Return>(
  handler: (envelope: HkiEnvelope, ...args: Args) => Return,
  domain: string
): (envelope: HkiEnvelope, ...args: Args) => Return {
  if (!domain || domain === "global" || domain === "*") {
    throw new Error(
      `withDomain: domain must be a non-global, non-wildcard string, got: ${JSON.stringify(domain)}`
    );
  }

  return function (envelope: HkiEnvelope, ...args: Args): Return {
    if (envelope.active_domain.toLowerCase() !== domain.toLowerCase()) {
      throw new Error(
        `withDomain: envelope active_domain "${envelope.active_domain}" ` +
          `does not match required domain "${domain}"`
      );
    }
    return handler(envelope, ...args);
  };
}
