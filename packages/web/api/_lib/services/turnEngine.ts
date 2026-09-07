import { rowToSession, type Session } from "@dnd-ai-sim/shared";
import { getServiceClient } from "../supabase.js";

/**
 * Admin-driven turn queue (requirement 5.4/6): the app never guesses whose
 * turn it is -- the Admin's client calls advanceTurn explicitly. Exactly one
 * character's input is ever valid at a time, enforced in the turn/* handlers.
 */
export async function startSession(campaignId: string, characterIds: string[]): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .insert({
      campaign_id: campaignId,
      status: "active",
      turn_queue: characterIds.map((characterId) => ({ characterId, hasActedThisRound: false })),
      current_turn_index: -1,
      round: 1,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("sessions").select().eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data) : null;
}

/** The campaign's current live/paused session, if any -- lets a player's client find the session to join without the Admin sharing a link. */
export async function getCurrentSessionForCampaign(campaignId: string): Promise<Session | null> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .select()
    .eq("campaign_id", campaignId)
    .neq("status", "ended")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSession(data) : null;
}

export function activeCharacterId(session: Pick<Session, "turnQueue" | "currentTurnIndex">): string | null {
  if (session.currentTurnIndex < 0 || session.currentTurnIndex >= session.turnQueue.length) return null;
  return session.turnQueue[session.currentTurnIndex].characterId;
}

export async function advanceTurn(sessionId: string): Promise<Session> {
  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  if (session.turnQueue.length === 0) throw new Error("Turn queue is empty");

  const turnQueue = session.turnQueue.map((entry) => ({ ...entry }));
  if (session.currentTurnIndex >= 0 && session.currentTurnIndex < turnQueue.length) {
    turnQueue[session.currentTurnIndex].hasActedThisRound = true;
  }

  let currentTurnIndex = session.currentTurnIndex + 1;
  let round = session.round;
  if (currentTurnIndex >= turnQueue.length) {
    currentTurnIndex = 0;
    round += 1;
    turnQueue.forEach((entry) => {
      entry.hasActedThisRound = false;
    });
  }

  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ turn_queue: turnQueue, current_turn_index: currentTurnIndex, round, pending_roll: null })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function pauseQueue(sessionId: string, reason: "admin" | "disconnect"): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ status: "paused", pause_reason: reason })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function resumeQueue(sessionId: string): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ status: "active", pause_reason: null })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function setPendingRoll(sessionId: string, rollType: string, rollPrompt: string): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ pending_roll: { rollType, rollPrompt } })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function clearPendingRoll(sessionId: string): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ pending_roll: null })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function setPendingActionText(sessionId: string, text: string | null): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("sessions")
    .update({ pending_action_text: text })
    .eq("id", sessionId)
    .select()
    .single();
  if (error) throw error;
  return rowToSession(data);
}

export async function endSession(sessionId: string): Promise<Session> {
  const db = getServiceClient();
  const { data, error } = await db.from("sessions").update({ status: "ended" }).eq("id", sessionId).select().single();
  if (error) throw error;
  return rowToSession(data);
}
