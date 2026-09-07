import type { Server } from "socket.io";
import { pauseQueue, resumeQueue, getSession } from "../services/turnEngine.js";
import { logEvent } from "../services/eventLogService.js";

/**
 * Tracks which socket is the connected Admin device per session, so a
 * dropped wifi connection can auto-pause the turn queue and a reconnect can
 * auto-resume it (requirement 6 "graceful degradation") without offline
 * queuing/action buffering.
 */
const adminSocketBySession = new Map<string, string>();

export function roomFor(sessionId: string): string {
  return `session:${sessionId}`;
}

export async function registerAdminPresence(io: Server, sessionId: string, socketId: string) {
  adminSocketBySession.set(sessionId, socketId);
  const session = await getSession(sessionId);
  if (session && session.status === "paused" && session.pauseReason === "disconnect") {
    const resumed = await resumeQueue(sessionId);
    const event = await logEvent({
      sessionId,
      campaignId: String(session.campaignId),
      type: "system",
      actorLabel: "System",
      text: "Admin device reconnected -- session resumed.",
    });
    io.to(roomFor(sessionId)).emit("session:update", resumed);
    io.to(roomFor(sessionId)).emit("session:event", event);
  }
}

export async function handleAdminDisconnect(io: Server, sessionId: string, socketId: string) {
  if (adminSocketBySession.get(sessionId) !== socketId) return;
  adminSocketBySession.delete(sessionId);

  const session = await getSession(sessionId);
  if (!session || session.status !== "active") return;

  const paused = await pauseQueue(sessionId, "disconnect");
  const event = await logEvent({
    sessionId,
    campaignId: String(session.campaignId),
    type: "system",
    actorLabel: "System",
    text: "Connection to the Admin device was lost -- session paused automatically.",
  });
  io.to(roomFor(sessionId)).emit("session:update", paused);
  io.to(roomFor(sessionId)).emit("session:event", event);
}
