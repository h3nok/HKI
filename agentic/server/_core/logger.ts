/**
 * Structured JSON logging — Pino-based logger for the Agentic BFF.
 *
 * In production: JSON lines (machine-parsable, GCP Cloud Logging compatible).
 * In development: Pretty-printed for human readability.
 *
 * Usage:
 *   import { logger } from "./_core/logger";
 *   logger.info({ userId: 1 }, "User logged in");
 *   logger.child({ module: "chat" }).warn("Slow response");
 */

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  ...(isProduction
    ? {
        // GCP Cloud Logging compatible JSON format
        formatters: {
          level(label: string) {
            // Cloud Logging uses "severity" instead of "level"
            return { severity: label.toUpperCase() };
          },
        },
        messageKey: "message",
      }
    : {
        // Human-readable for local dev
        transport: {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        },
      }),
});

/**
 * Create a child logger for a specific module.
 * The module name appears in every log line for filtering.
 */
export function createLogger(module: string) {
  return logger.child({ module });
}
