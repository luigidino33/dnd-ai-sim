import type { Server, Socket } from "socket.io";
import { logCorrection, logEvent } from "../../services/eventLogService.js";
import { getSession, pauseQueue } from "../../services/turnEngine.js";
import { applyRuling } from "../../services/rulesEngine.js";
import { roomFor } from "../presence.js";

type Ack = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void;

/**
 * "Pause-and-correct" (requirement 5.4): the Admin can pause at any point --
 * not just after the fact -- and issue a correction that's broadcast to
 * every player, never silently changed (requirement 5.2).
 */
export function registerCorrectionHandlers(io: Server, socket: Socket) {
  socket.on(
    "correction:issue",
    async (
      payload: {
        sessionId: string;
        originalText: string;
        correctedText: string;
        reason?: string;
        /** Optional: also apply a corrected mechanical outcome (e.g. hit not a miss). */
        characterId?: string;
        hpChange?: number;
        conditionsAdded?: { name: string; roundsRemaining?: number }[];
        conditionsRemoved?: string[];
      },
      ack?: Ack
    ) => {
      if (!socket.data.auth?.isAdmin) return ack?.({ ok: false, error: "Admin only" });
      try {
        const session = await getSession(payload.sessionId);
        if (!session) throw new Error("Session not found");

        const correction = await logCorrection({
          sessionId: payload.sessionId,
          campaignId: String(session.campaignId),
          correctedBy: socket.data.auth.name,
          originalText: payload.originalText,
          correctedText: payload.correctedText,
          reason: payload.reason,
        });
        io.to(roomFor(payload.sessionId)).emit("session:event", correction);

        let updatedCharacter;
        if (payload.characterId && (payload.hpChange || payload.conditionsAdded || payload.conditionsRemoved)) {
          updatedCharacter = await applyRuling(payload.characterId, {
            narration: payload.correctedText,
            requiresRoll: false,
            hpChange: payload.hpChange,
            conditionsAdded: payload.conditionsAdded,
            conditionsRemoved: payload.conditionsRemoved,
          });
          io.to(roomFor(payload.sessionId)).emit("character:update", updatedCharacter);
        }

        ack?.({ ok: true, correction, updatedCharacter });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    }
  );

  socket.on("turn:pause-and-correct", async (payload: { sessionId: string }, ack?: Ack) => {
    if (!socket.data.auth?.isAdmin) return ack?.({ ok: false, error: "Admin only" });
    const session = await pauseQueue(payload.sessionId, "admin");
    const event = await logEvent({
      sessionId: payload.sessionId,
      campaignId: String(session.campaignId),
      type: "system",
      actorLabel: "Admin",
      text: "Admin paused to review a ruling -- hold tight.",
    });
    io.to(roomFor(payload.sessionId)).emit("session:update", session);
    io.to(roomFor(payload.sessionId)).emit("session:event", event);
    ack?.({ ok: true, session });
  });
}
