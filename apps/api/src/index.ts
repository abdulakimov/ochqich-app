import { config } from "./config";
import { prisma } from "./lib/prisma";
import { createApp } from "./app";

const app = createApp();

async function main() {
  await prisma.$connect();

  app.listen(config.port, () => {
    console.log(`Auth core API running on :${config.port}`);
  });
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
