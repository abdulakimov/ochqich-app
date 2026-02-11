import type { Request, Response, NextFunction } from "express";

type RateLimitStoreValue = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  max: number;
  name: string;
  keyGenerator?: (req: Request) => string;
};

const store = new Map<string, RateLimitStoreValue>();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const forwardedIp = forwarded.split(",")[0]?.trim();
    return forwardedIp && forwardedIp.length > 0 ? forwardedIp : req.ip ?? "unknown";
  }

  return req.ip ?? "unknown";
}

function cleanupExpiredEntries(now: number, windowMs: number): void {
  if (store.size <= 10_000) {
    return;
  }

  for (const [key, value] of store.entries()) {
    if (value.resetAt <= now - windowMs) {
      store.delete(key);
    }
  }
}

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    cleanupExpiredEntries(now, options.windowMs);

    const key = `${options.name}:${options.keyGenerator?.(req) ?? getClientIp(req)}`;
    const current = store.get(key);

    if (!current || current.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", String(options.max - 1));
      res.setHeader("X-RateLimit-Reset", String(Math.ceil((now + options.windowMs) / 1000)));
      return next();
    }

    if (current.count >= options.max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.setHeader("X-RateLimit-Limit", String(options.max));
      res.setHeader("X-RateLimit-Remaining", "0");
      res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
      return res.status(429).json({ message: "Too many requests" });
    }

    current.count += 1;
    store.set(key, current);

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, options.max - current.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
    return next();
  };
}
