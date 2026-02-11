import express from "express";
import { v1Router } from "./routes/v1";
import { prisma } from "./lib/prisma";
import { logger } from "./lib/logger";

export function createApp() {
  const app = express();

  app.set("trust proxy", true);

  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      if (req.path === "/health/live") {
        return;
      }

      const durationMs = Date.now() - startedAt;
      const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
      logger[level](
        {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs,
          ip: req.ip,
        },
        "request.completed",
      );
    });

    next();
  });

  app.use(express.json({ limit: "1mb" }));

  app.use((_, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.get("/health/live", (_, res) => {
    return res.status(200).json({ ok: true, status: "live" });
  });

  app.get("/health/ready", async (_, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({ ok: true, status: "ready" });
    } catch (error) {
      logger.error({ err: error }, "Readiness check failed");
      return res.status(503).json({ ok: false, status: "degraded" });
    }
  });

  app.get("/health", async (_, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        ok: true,
        status: "ready",
        uptimeSeconds: Math.round(process.uptime()),
      });
    } catch {
      return res.status(503).json({ ok: false, status: "degraded" });
    }
  });

  app.use("/v1", v1Router);

  app.use((_, res) => res.status(404).json({ message: "Not found" }));

  return app;
}
