import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  ROLE_PERMISSIONS,
  isRoleHigherOrEqual,
  type Permission,
  type Role,
} from "@shared/access-control";
import {
  FEATURE_FLAG_DEFINITIONS,
  createFeatureFlagSnapshot,
  getFeatureFlagDefinition,
  type FeatureFlagKey,
  type EvaluatedFeatureFlag,
  type FeatureEnvironment,
  type FeatureFlagSnapshot,
} from "@shared/feature-flags";
import { featureFlagOverrides, type User } from "../../drizzle/schema";
import type { getDb } from "../db";

type MinimalUser = Pick<User, "role" | "valueStreams"> & {
  orgId?: string | null;
};

type DbClient = NonNullable<Awaited<ReturnType<typeof getDb>>>;

export type FeatureFlagOverrideInput = {
  featureKey: string;
  enabled: boolean | number | null;
};

export type ViewerFeatureContext = {
  permissions: Permission[];
  scopes: string[];
  isGlobalScope: boolean;
  flags: FeatureFlagSnapshot;
};

function parseValueStreamScopes(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map(scope => scope.trim())
    .filter(Boolean);
}

function normalizeEnvironment(value?: string | null): FeatureEnvironment {
  switch ((value ?? "").trim().toLowerCase()) {
    case "test":
      return "test";
    case "staging":
      return "staging";
    case "production":
      return "production";
    default:
      return "development";
  }
}

function normalizeOverrideEnabled(
  value: boolean | number | null
): boolean | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value;
  return value === 1;
}

export function resolveRuntimeFeatureEnvironment(): FeatureEnvironment {
  return normalizeEnvironment(
    process.env.APP_ENV ?? process.env.DEPLOY_ENV ?? process.env.NODE_ENV
  );
}

export function resolveUserScopes(user: MinimalUser): {
  scopes: string[];
  isGlobalScope: boolean;
} {
  const isAdmin = user.role === "admin";
  const parsedScopes = parseValueStreamScopes(user.valueStreams);
  const scopes = isAdmin
    ? ["global"]
    : parsedScopes.length > 0
      ? parsedScopes
      : ["global"];

  return {
    scopes,
    isGlobalScope: isAdmin || scopes.includes("global"),
  };
}

export function evaluateFeatureFlagsForUser(options: {
  user: MinimalUser | null;
  overrides?: FeatureFlagOverrideInput[];
  environment?: FeatureEnvironment;
}): {
  flags: FeatureFlagSnapshot;
  entries: EvaluatedFeatureFlag[];
} {
  const environment = options.environment ?? resolveRuntimeFeatureEnvironment();
  const flags = createFeatureFlagSnapshot(false);
  const overrideMap = new Map<string, boolean | null>(
    (options.overrides ?? []).map(override => [
      override.featureKey,
      normalizeOverrideEnabled(override.enabled),
    ])
  );

  const entries = FEATURE_FLAG_DEFINITIONS.map(definition => {
    const overrideEnabled = overrideMap.get(definition.key) ?? null;
    let effectiveEnabled = overrideEnabled ?? definition.defaultEnabled;

    if (!definition.environments.includes(environment)) {
      effectiveEnabled = false;
    }

    if (
      definition.minimumRole &&
      (!options.user ||
        !isRoleHigherOrEqual(options.user.role as Role, definition.minimumRole))
    ) {
      effectiveEnabled = false;
    }

    flags[definition.key] = effectiveEnabled;

    return {
      ...definition,
      effectiveEnabled,
      overrideEnabled,
      source: overrideEnabled == null ? "default" : "admin_override",
    } satisfies EvaluatedFeatureFlag;
  });

  return { flags, entries };
}

export function buildViewerFeatureContext(options: {
  user: MinimalUser;
  overrides?: FeatureFlagOverrideInput[];
  environment?: FeatureEnvironment;
}): ViewerFeatureContext {
  const { scopes, isGlobalScope } = resolveUserScopes(options.user);
  const { flags } = evaluateFeatureFlagsForUser(options);

  return {
    permissions: [...ROLE_PERMISSIONS[options.user.role as Role]],
    scopes,
    isGlobalScope,
    flags,
  };
}

export function isFeatureEnabledForUser(options: {
  user: MinimalUser | null;
  key: FeatureFlagKey;
  overrides?: FeatureFlagOverrideInput[];
  environment?: FeatureEnvironment;
}): boolean {
  return evaluateFeatureFlagsForUser(options).flags[options.key];
}

export async function loadFeatureFlagOverrides(
  db: DbClient,
  orgId: string
): Promise<FeatureFlagOverrideInput[]> {
  return db
    .select({
      featureKey: featureFlagOverrides.featureKey,
      enabled: featureFlagOverrides.enabled,
    })
    .from(featureFlagOverrides)
    .where(eq(featureFlagOverrides.orgId, orgId));
}

export async function requireFeatureEnabledForUser(options: {
  db: DbClient;
  user: MinimalUser;
  key: FeatureFlagKey;
  message?: string;
  overrides?: FeatureFlagOverrideInput[];
  environment?: FeatureEnvironment;
}): Promise<void> {
  const overrides =
    options.overrides ??
    (await loadFeatureFlagOverrides(
      options.db,
      options.user.orgId ?? "default"
    ));

  if (
    isFeatureEnabledForUser({
      user: options.user,
      key: options.key,
      overrides,
      environment: options.environment,
    })
  ) {
    return;
  }

  throw new TRPCError({
    code: "FORBIDDEN",
    message:
      options.message ??
      `${getFeatureFlagDefinition(options.key).label} is disabled for this deployment`,
  });
}
