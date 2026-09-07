import type { Server, Socket } from "socket.io";
import { getSession, activeCharacterId } from "../../services/turnEngine.js";
import { processTurnInput } from "../../services/turnOrchestrator.js";
import { logEvent } from "../../services/eventLogService.js";
import { roomFor } from "../presence.js";

type Ack = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void;

function assertItsMyTurn(socket: Socket, session: { turnQueue: any[]; currentTurnIndex: number }) {
  if (socket.data.auth?.isAdmin) return; // admin may act on a player's behalf for testing/table-driving
  const active = activeCharacterId(session);
  if (!active || active !== socket.data.characterId) {
    throw new Error("It is not your turn");
  }
}

export function registerActionHandlers(io: Server, socket: Socket) {
  socket.on(
    "action:submit",
    async (payload: { sessionId: string; actionText: string }, ack?: Ack) => {
      try {
        const session = await getSession(payload.sessionId);
        if (!session) throw new Error("Session not found");
        if (session.status !== "active") throw new Error("Session is paused");
        assertItsMyTurn(socket, session);

        const actionEvent = await logEvent({
          sessionId: payload.sessionId,
          campaignId: String(session.campaignId),
          type: "player_action",
          characterId: socket.data.characterId,
          actorLabel: socket.data.auth?.name,
          text: payload.actionText,
        });
        io.to(roomFor(payload.sessionId)).emit("session:event", actionEvent);

        const result = await processTurnInput({ sessionId: payload.sessionId, actionText: payload.actionText });
        broadcastTurnResult(io, payload.sessionId, result);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    }
  );

  socket.on(
    "roll:submit",
    async (payload: { sessionId: string; rollValue: number; rollType?: string }, ack?: Ack) => {
      try {
        const session = await getSession(payload.sessionId);
        if (!session) throw new Error("Session not found");
        if (session.status !== "active") throw new Error("Session is paused");
        assertItsMyTurn(socket, session);
        if (!session.pendingRoll) throw new Error("No roll is currently expected");

        const rollEvent = await logEvent({
          sessionId: payload.sessionId,
          campaignId: String(session.campaignId),
          type: "roll_submitted",
          characterId: socket.data.characterId,
          actorLabel: socket.data.auth?.name,
          text: `Rolled ${payload.rollValue}`,
          rollType: payload.rollType ?? session.pendingRoll.rollType ?? undefined,
          rollValue: payload.rollValue,
        });
        io.to(roomFor(payload.sessionId)).emit("session:event", rollEvent);

        const result = await processTurnInput({
          sessionId: payload.sessionId,
          actionText: session.pendingActionText ?? "",
          rollValue: payload.rollValue,
          rollType: payload.rollType ?? session.pendingRoll.rollType ?? undefined,
        });
        broadcastTurnResult(io, payload.sessionId, result);
        ack?.({ ok: true, ...result });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    }
  );
}

function broadcastTurnResult(
  io: Server,
  sessionId: string,
  result: Awaited<ReturnType<typeof processTurnInput>>
) {
  const room = roomFor(sessionId);
  io.to(room).emit("session:event", result.event);
  io.to(room).emit("session:update", result.session);
  if (result.updatedCharacter) {
    io.to(room).emit("character:update", result.updatedCharacter);
  }
}
