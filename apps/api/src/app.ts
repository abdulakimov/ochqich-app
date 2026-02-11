import express from "express";
import { v1Router } from "./routes/v1";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.get("/health", (_, res) => res.status(200).json({ ok: true }));
  app.use("/v1", v1Router);

  app.use((_, res) => res.status(404).json({ message: "Not found" }));

  return app;
}
