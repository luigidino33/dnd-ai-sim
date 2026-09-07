import http from "node:http";
import express from "express";
import cors from "cors";
import "express-async-errors";
import { env } from "./config/env.js";
import { connectDb } from "./db/connection.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter } from "./routes/campaigns.js";
import { charactersRouter } from "./routes/characters.js";
import { sessionsRouter } from "./routes/sessions.js";
import { createSocketServer } from "./sockets/index.js";

async function main() {
  await connectDb();

  const app = express();
  app.use(cors({ origin: env.webOrigin }));
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api/campaigns", campaignsRouter);
  app.use("/api/characters", charactersRouter);
  app.use("/api/sessions", sessionsRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  const httpServer = http.createServer(app);
  createSocketServer(httpServer);

  httpServer.listen(env.serverPort, () => {
    console.log(`[server] listening on http://localhost:${env.serverPort}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
