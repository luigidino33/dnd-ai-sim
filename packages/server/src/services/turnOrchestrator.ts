import { SessionModel } from "../db/models/Session.js";
import { CampaignModel } from "../db/models/Campaign.js";
import { CharacterModel } from "../db/models/Character.js";
import { requestRuling } from "./aiDM.js";
import { applyRuling } from "./rulesEngine.js";
import { logEvent, getRecentEvents } from "./eventLogService.js";
import { activeCharacterId, setPendingRoll, clearPendingRoll } from "./turnEngine.js";
import type { RulingResult } from "@dnd-ai-sim/shared";

export interface TurnResult {
  ruling: RulingResult;
  session: InstanceType<typeof SessionModel>;
  updatedCharacter?: InstanceType<typeof CharacterModel>;
  event: Awaited<ReturnType<typeof logEvent>>;
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

  const session = await SessionModel.findById(sessionId);
  if (!session) throw new Error("Session not found");
  const characterId = activeCharacterId(session);
  if (!characterId) throw new Error("No active turn");

  const [campaign, actingCharacter, party, recentEvents] = await Promise.all([
    CampaignModel.findById(session.campaignId),
    CharacterModel.findById(characterId),
    CharacterModel.find({ campaignId: session.campaignId }),
    getRecentEvents(sessionId, 20),
  ]);
  if (!campaign) throw new Error("Campaign not found");
  if (!actingCharacter) throw new Error("Active character not found");

  const ruling = await requestRuling({
    campaign: campaign as any,
    actingCharacter: actingCharacter as any,
    partySummaries: party as any,
    recentEvents: recentEvents as any,
    playerActionText: actionText,
    rollType,
    rollValue,
  });

  const event = await logEvent({
    sessionId,
    campaignId: String(session.campaignId),
    type: "ruling",
    characterId,
    actorLabel: "AI DM",
    text: ruling.narration,
    rollType: ruling.rollType,
    ruling,
  });

  if (ruling.requiresRoll) {
    session.pendingActionText = actionText;
    const pausedForRoll = await setPendingRoll(sessionId, ruling.rollType ?? "abilityCheck", ruling.rollPrompt ?? "Make a roll");
    return { ruling, session: pausedForRoll, event };
  }

  const clearedSession = await clearPendingRoll(sessionId);
  clearedSession.pendingActionText = undefined;
  await clearedSession.save();

  const updatedCharacter = await applyRuling(characterId, ruling);
  return { ruling, session: clearedSession, updatedCharacter, event };
}
