import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { createLogger } from "../_core/logger";

const log = createLogger("connector-credentials");

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const ENCRYPTION_VERSION = 2;
const IV_LENGTH_BYTES = 12;

type ConnectorCredentialsEnvelope = {
  version: number;
  alg: string;
  iv: string;
  tag: string;
  data: string;
};

export type ConnectorCredentials = Record<string, unknown>;
export type GoogleDriveConnectorCredentials = {
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
};

function getConnectorCredentialsSecret(): string {
  return (
    process.env.CONNECTOR_CREDENTIALS_SECRET ||
    process.env.JWT_SECRET ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ""
  );
}

function getEncryptionKey(): Buffer | null {
  const secret = getConnectorCredentialsSecret();
  if (!secret) return null;
  return createHash("sha256").update(secret).digest();
}

function isEncryptedEnvelope(
  value: unknown
): value is ConnectorCredentialsEnvelope {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ConnectorCredentialsEnvelope>;
  return (
    candidate.alg === ENCRYPTION_ALGORITHM &&
    typeof candidate.iv === "string" &&
    typeof candidate.tag === "string" &&
    typeof candidate.data === "string"
  );
}

export function storeConnectorCredentials(credentials: ConnectorCredentials): {
  value: string;
  version: number;
} {
  const payload = JSON.stringify(credentials);
  const key = getEncryptionKey();

  if (!key) {
    log.warn(
      "CONNECTOR_CREDENTIALS_SECRET, JWT_SECRET, and GOOGLE_CLIENT_SECRET are all unset; storing connector credentials without encryption"
    );
    return { value: payload, version: 1 };
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(payload, "utf8"),
    cipher.final(),
  ]);
  const envelope: ConnectorCredentialsEnvelope = {
    version: ENCRYPTION_VERSION,
    alg: ENCRYPTION_ALGORITHM,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  };

  return { value: JSON.stringify(envelope), version: ENCRYPTION_VERSION };
}

export function parseConnectorCredentials(
  storedCredentials: string
): ConnectorCredentials {
  const parsed = JSON.parse(storedCredentials) as unknown;

  if (!isEncryptedEnvelope(parsed)) {
    return parsed as ConnectorCredentials;
  }

  const key = getEncryptionKey();
  if (!key) {
    throw new Error(
      "Encrypted connector credentials present but no connector credentials secret is configured"
    );
  }

  const decipher = createDecipheriv(
    ENCRYPTION_ALGORITHM,
    key,
    Buffer.from(parsed.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as ConnectorCredentials;
}

export function parseGoogleDriveConnectorCredentials(
  storedCredentials: string
): GoogleDriveConnectorCredentials {
  const credentials = parseConnectorCredentials(storedCredentials);

  if (
    typeof credentials.access_token !== "string" ||
    !credentials.access_token
  ) {
    throw new Error(
      "Google Drive connector credentials are missing access_token"
    );
  }

  return {
    access_token: credentials.access_token,
    refresh_token:
      typeof credentials.refresh_token === "string"
        ? credentials.refresh_token
        : null,
    expiry_date:
      typeof credentials.expiry_date === "number"
        ? credentials.expiry_date
        : null,
  };
}
