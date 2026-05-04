function normalizeBuildField(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatBuildDate(value: string | null): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;

  return parsed.toISOString().replace(".000Z", "Z");
}

export interface AppBuildInfo {
  version: string;
  sha: string | null;
  branch: string | null;
  builtAt: string | null;
}

export function formatAppVersionLabel(
  build: Pick<AppBuildInfo, "version" | "sha">
): string {
  const base = `v${build.version}`;
  return build.sha ? `${base}+${build.sha}` : base;
}

export function formatAppVersionTitle(
  productName: string,
  build: AppBuildInfo
): string {
  const lines = [productName, `Version: ${formatAppVersionLabel(build)}`];

  if (build.branch) {
    lines.push(`Branch: ${build.branch}`);
  }
  if (build.builtAt) {
    lines.push(`Built: ${formatBuildDate(build.builtAt)}`);
  }

  return lines.join("\n");
}

export const APP_BUILD_INFO: AppBuildInfo = {
  version:
    normalizeBuildField(
      import.meta.env.VITE_APP_VERSION as string | undefined
    ) || "0.0.0",
  sha: normalizeBuildField(
    import.meta.env.VITE_BUILD_SHA as string | undefined
  ),
  branch: normalizeBuildField(
    import.meta.env.VITE_BUILD_BRANCH as string | undefined
  ),
  builtAt: normalizeBuildField(
    import.meta.env.VITE_BUILD_DATE as string | undefined
  ),
};

export const APP_VERSION_LABEL = formatAppVersionLabel(APP_BUILD_INFO);
