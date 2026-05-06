import type { Request } from "express";
import {
  ipKeyGenerator,
  rateLimit,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import { createLogger } from "./logger";

const log = createLogger("rate-limit");

type RateLimitKeyBuilder = (request: Request) => string | undefined;

type RouteRateLimitConfig = {
  identifier: string;
  windowMs: number;
  limit: number;
  message: string;
  keyBuilder?: RateLimitKeyBuilder;
};

function firstHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function buildIpRateLimitKey(request: Request): string {
  const forwardedFor = firstHeaderValue(request.headers["x-forwarded-for"])
    ?.split(",")[0]
    ?.trim();
  const clientIp =
    forwardedFor || request.ip || request.socket.remoteAddress || "unknown";

  return `ip:${ipKeyGenerator(clientIp, false)}`;
}

function buildRateLimitKey(
  request: Request,
  keyBuilder?: RateLimitKeyBuilder
): string {
  const customKey = keyBuilder?.(request)?.trim();
  if (customKey) {
    return customKey;
  }

  return buildIpRateLimitKey(request);
}

export function createRouteRateLimiter(
  config: RouteRateLimitConfig
): RateLimitRequestHandler {
  return rateLimit({
    identifier: config.identifier,
    windowMs: config.windowMs,
    limit: config.limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    validate: false,
    keyGenerator: request =>
      `${config.identifier}:${buildRateLimitKey(request, config.keyBuilder)}`,
    handler: (request, response, _next, options) => {
      log.warn(
        {
          rateLimit: {
            identifier: config.identifier,
            key: buildRateLimitKey(request, config.keyBuilder),
            limit: config.limit,
            windowMs: config.windowMs,
          },
          method: request.method,
          path: request.originalUrl || request.url,
          ip: request.ip,
        },
        "Rate limit exceeded"
      );

      response.status(options.statusCode).json({ error: config.message });
    },
  });
}
