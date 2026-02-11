import { config } from "./config";
import { prisma } from "./lib/prisma";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const app = createApp();

async function shutdown(signal: NodeJS.Signals) {
  logger.warn({ signal }, "Shutting down server");
  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  await prisma.$connect();

  app.listen(config.port, () => {
    logger.info({ port: config.port }, "Auth core API running");
  });

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch(async (err) => {
  logger.error({ err }, "API bootstrap failed");
  await prisma.$disconnect();
  process.exit(1);
});
