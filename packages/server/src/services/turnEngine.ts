import { SessionModel } from "../db/models/Session.js";

/**
 * Admin-driven turn queue (requirement 5.4/6): the app never guesses whose
 * turn it is -- the Admin's client calls advanceTurn explicitly. This keeps
 * the concurrency model simple: exactly one character's input is ever valid
 * at a time, enforced server-side by comparing against currentTurnIndex.
 */
export async function startSession(campaignId: string, characterIds: string[]) {
  return SessionModel.create({
    campaignId,
    status: "active",
    turnQueue: characterIds.map((characterId) => ({ characterId, hasActedThisRound: false })),
    currentTurnIndex: -1,
    round: 1,
  });
}

export async function getSession(sessionId: string) {
  return SessionModel.findById(sessionId);
}

export function activeCharacterId(session: { turnQueue: any[]; currentTurnIndex: number }): string | null {
  if (session.currentTurnIndex < 0 || session.currentTurnIndex >= session.turnQueue.length) return null;
  return String(session.turnQueue[session.currentTurnIndex].characterId);
}

export async function advanceTurn(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.turnQueue.length === 0) throw new Error("Turn queue is empty");

  if (session.currentTurnIndex >= 0 && session.currentTurnIndex < session.turnQueue.length) {
    session.turnQueue[session.currentTurnIndex].hasActedThisRound = true;
  }

  const nextIndex = session.currentTurnIndex + 1;
  if (nextIndex >= session.turnQueue.length) {
    session.currentTurnIndex = 0;
    session.round += 1;
    session.turnQueue.forEach((entry) => {
      entry.hasActedThisRound = false;
    });
  } else {
    session.currentTurnIndex = nextIndex;
  }
  session.pendingRoll = undefined;
  await session.save();
  return session;
}

export async function pauseQueue(sessionId: string, reason: "admin" | "disconnect") {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.status = "paused";
  session.pauseReason = reason;
  await session.save();
  return session;
}

export async function resumeQueue(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.status = "active";
  session.pauseReason = undefined;
  await session.save();
  return session;
}

export async function setPendingRoll(sessionId: string, rollType: string, rollPrompt: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.pendingRoll = { rollType, rollPrompt };
  await session.save();
  return session;
}

export async function clearPendingRoll(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.pendingRoll = undefined;
  await session.save();
  return session;
}

export async function endSession(sessionId: string) {
  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  session.status = "ended";
  await session.save();
  return session;
}
