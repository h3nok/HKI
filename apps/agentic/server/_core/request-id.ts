/**
 * Request-ID middleware — propagates or generates X-Request-Id for correlation.
 *
 * Every incoming request gets a unique ID that flows through:
 *   1. Express request object (req.id)
 *   2. Pino child logger (bound per-request)
 *   3. Response header (X-Request-Id)
 *   4. Downstream service calls (forwarded)
 */

import { randomUUID } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { logger } from "./logger";

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: typeof logger;
    }
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req.headers["x-request-id"] as string) || randomUUID();

  req.id = requestId;
  req.log = logger.child({ requestId });

  res.setHeader("X-Request-Id", requestId);
  next();
}
