import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifySessionToken } from "../auth/jwt.js";
import { env } from "../config/env.js";
import { registerTurnHandlers } from "./handlers/turnHandlers.js";
import { registerActionHandlers } from "./handlers/actionHandlers.js";
import { registerCorrectionHandlers } from "./handlers/correctionHandlers.js";
import { registerCharacterHandlers } from "./handlers/characterHandlers.js";
import { handleAdminDisconnect } from "./presence.js";

export function createSocketServer(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: env.webOrigin },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== "string") return next(new Error("Missing auth token"));
    try {
      socket.data.auth = verifySessionToken(token);
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    registerTurnHandlers(io, socket);
    registerActionHandlers(io, socket);
    registerCorrectionHandlers(io, socket);
    registerCharacterHandlers(io, socket);

    socket.on("disconnect", () => {
      const sessionId = socket.data.sessionId as string | undefined;
      if (sessionId && socket.data.auth?.isAdmin) {
        void handleAdminDisconnect(io, sessionId, socket.id);
      }
    });
  });

  return io;
}
