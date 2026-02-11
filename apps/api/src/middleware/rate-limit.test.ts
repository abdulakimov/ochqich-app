import test from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { createRateLimitMiddleware } from "./rate-limit";

function createMockRequest(ip: string, headers: Record<string, string> = {}): Request {
  return {
    ip,
    headers,
  } as unknown as Request;
}

test("rate limiter blocks after threshold", () => {
  const middleware = createRateLimitMiddleware({
    name: "test",
    max: 2,
    windowMs: 60_000,
  });

  const req = createMockRequest("127.0.0.1");

  const nextCalls: string[] = [];
  const responseFactory = () => {
    const headers = new Map<string, string>();
    let statusCode = 200;
    return {
      setHeader: (name: string, value: string) => {
        headers.set(name, value);
      },
      status: (code: number) => {
        statusCode = code;
        return {
          json: (payload: unknown) => ({ payload, statusCode, headers }),
        };
      },
      headers,
      get statusCode() {
        return statusCode;
      },
    };
  };

  const firstRes = responseFactory();
  middleware(req, firstRes as never, () => {
    nextCalls.push("first");
  });

  const secondRes = responseFactory();
  middleware(req, secondRes as never, () => {
    nextCalls.push("second");
  });

  const thirdRes = responseFactory();
  const blocked = middleware(req, thirdRes as never, () => {
    nextCalls.push("third");
  });

  assert.equal(nextCalls.length, 2);
  assert.equal(thirdRes.statusCode, 429);
  assert.ok(blocked);
});


test("rate limiter key ignores spoofed x-forwarded-for header", () => {
  const middleware = createRateLimitMiddleware({
    name: "spoof",
    max: 1,
    windowMs: 60_000,
  });

  const firstReq = createMockRequest("10.0.0.1", { "x-forwarded-for": "198.51.100.10" });
  const secondReq = createMockRequest("10.0.0.1", { "x-forwarded-for": "203.0.113.99" });

  const responseFactory = () => {
    const headers = new Map<string, string>();
    let statusCode = 200;
    return {
      setHeader: (name: string, value: string) => {
        headers.set(name, value);
      },
      status: (code: number) => {
        statusCode = code;
        return {
          json: (payload: unknown) => ({ payload, statusCode, headers }),
        };
      },
      get statusCode() {
        return statusCode;
      },
    };
  };

  const firstRes = responseFactory();
  let nextCalled = false;
  middleware(firstReq, firstRes as never, () => {
    nextCalled = true;
  });

  const secondRes = responseFactory();
  middleware(secondReq, secondRes as never, () => undefined);

  assert.equal(nextCalled, true);
  assert.equal(secondRes.statusCode, 429);
});
