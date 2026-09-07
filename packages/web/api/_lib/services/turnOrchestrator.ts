import { rowToCharacter, type Character, type RulingResult, type Session, type SessionEvent } from "@dnd-ai-sim/shared";
import { getServiceClient } from "../supabase.js";
import { getCampaign } from "./campaignService.js";
import { requestRuling } from "./aiDM.js";
import { applyRuling } from "./rulesEngine.js";
import { logEvent, getRecentEvents } from "./eventLogService.js";
import { activeCharacterId, clearPendingRoll, getSession, setPendingActionText, setPendingRoll } from "./turnEngine.js";

export interface TurnResult {
  ruling: RulingResult;
  session: Session;
  updatedCharacter?: Character;
  event: SessionEvent;
}

/**
 * Runs one AI DM call for the active character's turn and applies the result.
 * Used both when a player first submits an action (rollValue undefined) and
 * when they submit the roll the AI DM asked for (rollValue set).
 */
export async function processTurnInput(params: {
  sessionId: string;
  actionText: string;
  rollValue?: number;
  rollType?: string;
}): Promise<TurnResult> {
  const { sessionId, actionText, rollValue, rollType } = params;

  const session = await getSession(sessionId);
  if (!session) throw new Error("Session not found");
  const characterId = activeCharacterId(session);
  if (!characterId) throw new Error("No active turn");

  const db = getServiceClient();
  const [campaign, actingRow, partyRows, recentEvents] = await Promise.all([
    getCampaign(session.campaignId),
    db.from("characters").select().eq("id", characterId).single(),
    db.from("characters").select().eq("campaign_id", session.campaignId),
    getRecentEvents(sessionId, 20),
  ]);
  if (!campaign) throw new Error("Campaign not found");
  if (actingRow.error || !actingRow.data) throw new Error("Active character not found");
  const actingCharacter = rowToCharacter(actingRow.data);
  const party = (partyRows.data ?? []).map(rowToCharacter);

  const ruling = await requestRuling({
    campaign,
    actingCharacter,
    partySummaries: party,
    recentEvents,
    playerActionText: actionText,
    rollType,
    rollValue,
  });

  const event = await logEvent({
    sessionId,
    campaignId: session.campaignId,
    type: "ruling",
    characterId,
    actorLabel: "AI DM",
    text: ruling.narration,
    rollType: ruling.rollType,
    ruling,
  });

  if (ruling.requiresRoll) {
    await setPendingActionText(sessionId, actionText);
    const pausedForRoll = await setPendingRoll(sessionId, ruling.rollType ?? "abilityCheck", ruling.rollPrompt ?? "Make a roll");
    return { ruling, session: pausedForRoll, event };
  }

  const clearedSession = await clearPendingRoll(sessionId);
  await setPendingActionText(sessionId, null);

  const updatedCharacter = await applyRuling(characterId, ruling);
  return { ruling, session: clearedSession, updatedCharacter, event };
}
