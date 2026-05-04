import type { CookieOptions, Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizeHostValue(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const firstValue = value.split(",")[0]?.trim();
  if (!firstValue) return undefined;

  if (firstValue.startsWith("[")) {
    const closingBracket = firstValue.indexOf("]");
    if (closingBracket > 0) {
      return firstValue.slice(1, closingBracket).toLowerCase();
    }
  }

  const colonCount = (firstValue.match(/:/g) || []).length;
  if (colonCount === 1 && firstValue.includes(":")) {
    return firstValue.split(":")[0]?.toLowerCase();
  }

  return firstValue.toLowerCase();
}

function resolveHostname(req: Request): string | undefined {
  if (typeof req.hostname === "string" && req.hostname.trim()) {
    return req.hostname.trim().toLowerCase();
  }

  const forwardedHost = req.headers["x-forwarded-host"];
  if (Array.isArray(forwardedHost)) {
    for (const value of forwardedHost) {
      const normalized = normalizeHostValue(value);
      if (normalized) return normalized;
    }
  } else {
    const normalized = normalizeHostValue(forwardedHost);
    if (normalized) return normalized;
  }

  return normalizeHostValue(req.headers.host);
}

function isIpAddress(host: string | undefined) {
  if (!host) return false;
  // Basic IPv4 check and IPv6 presence detection.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return true;
  return host.includes(":");
}

function isSecureRequest(req: Request) {
  if (req.protocol === "https") return true;

  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;

  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");

  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req: Request
): Pick<
  CookieOptions,
  "domain" | "httpOnly" | "path" | "sameSite" | "secure" | "maxAge"
> {
  const hostname = resolveHostname(req);
  const isLocal =
    !hostname || LOCAL_HOSTS.has(hostname) || isIpAddress(hostname);
  const secure = isSecureRequest(req);
  const sameSite: CookieOptions["sameSite"] = secure ? "none" : "lax";

  // Domain: set for non-local hosts to allow subdomain sharing (e.g. *.hki.com)
  const domain =
    !isLocal && hostname && !hostname.startsWith(".")
      ? `.${hostname}`
      : undefined;

  return {
    httpOnly: true,
    path: "/",
    sameSite,
    secure,
    ...(domain ? { domain } : {}),
  };
}

export function getSessionCookieClearOptions(req: Request): CookieOptions[] {
  const cookieOptions = getSessionCookieOptions(req);
  const clearOptions: CookieOptions[] = [
    {
      ...cookieOptions,
      expires: new Date(0),
      maxAge: -1,
    },
  ];

  if (cookieOptions.domain) {
    const { domain: _domain, ...hostOnlyOptions } = cookieOptions;
    clearOptions.push({
      ...hostOnlyOptions,
      expires: new Date(0),
      maxAge: -1,
    });
  }

  return clearOptions;
}
