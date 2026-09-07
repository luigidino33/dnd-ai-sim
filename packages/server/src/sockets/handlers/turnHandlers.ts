import type { Server, Socket } from "socket.io";
import { advanceTurn, getSession, pauseQueue, resumeQueue } from "../../services/turnEngine.js";
import { logEvent, getAllEvents } from "../../services/eventLogService.js";
import { CharacterModel } from "../../db/models/Character.js";
import { registerAdminPresence, roomFor } from "../presence.js";

type Ack = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void;

export function registerTurnHandlers(io: Server, socket: Socket) {
  socket.on("session:join", async (payload: { sessionId: string }, ack?: Ack) => {
    try {
      const session = await getSession(payload.sessionId);
      if (!session) throw new Error("Session not found");
      socket.join(roomFor(payload.sessionId));
      socket.data.sessionId = payload.sessionId;

      if (socket.data.auth?.isAdmin) {
        await registerAdminPresence(io, payload.sessionId, socket.id);
      }

      const [events, characters] = await Promise.all([
        getAllEvents(payload.sessionId),
        CharacterModel.find({ campaignId: session.campaignId }),
      ]);
      ack?.({ ok: true, session, events, characters });
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("turn:advance", async (payload: { sessionId: string }, ack?: Ack) => {
    if (!socket.data.auth?.isAdmin) return ack?.({ ok: false, error: "Admin only" });
    try {
      const session = await advanceTurn(payload.sessionId);
      const activeEntry = session.turnQueue[session.currentTurnIndex];
      const character = activeEntry ? await CharacterModel.findById(activeEntry.characterId) : null;
      const text = character ? `It's now ${character.name}'s turn.` : "Turn advanced.";
      const event = await logEvent({
        sessionId: payload.sessionId,
        campaignId: String(session.campaignId),
        type: "system",
        actorLabel: "System",
        text,
      });
      io.to(roomFor(payload.sessionId)).emit("session:update", session);
      io.to(roomFor(payload.sessionId)).emit("session:event", event);
      ack?.({ ok: true, session });
    } catch (err) {
      ack?.({ ok: false, error: (err as Error).message });
    }
  });

  socket.on("turn:pause", async (payload: { sessionId: string }, ack?: Ack) => {
    if (!socket.data.auth?.isAdmin) return ack?.({ ok: false, error: "Admin only" });
    const session = await pauseQueue(payload.sessionId, "admin");
    const event = await logEvent({
      sessionId: payload.sessionId,
      campaignId: String(session.campaignId),
      type: "system",
      actorLabel: "Admin",
      text: "Admin paused the session.",
    });
    io.to(roomFor(payload.sessionId)).emit("session:update", session);
    io.to(roomFor(payload.sessionId)).emit("session:event", event);
    ack?.({ ok: true, session });
  });

  socket.on("turn:resume", async (payload: { sessionId: string }, ack?: Ack) => {
    if (!socket.data.auth?.isAdmin) return ack?.({ ok: false, error: "Admin only" });
    const session = await resumeQueue(payload.sessionId);
    const event = await logEvent({
      sessionId: payload.sessionId,
      campaignId: String(session.campaignId),
      type: "system",
      actorLabel: "Admin",
      text: "Admin resumed the session.",
    });
    io.to(roomFor(payload.sessionId)).emit("session:update", session);
    io.to(roomFor(payload.sessionId)).emit("session:event", event);
    ack?.({ ok: true, session });
  });
}
