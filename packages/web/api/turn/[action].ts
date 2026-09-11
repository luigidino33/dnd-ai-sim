import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin, assertOwnsCharacterOrAdmin } from "../_lib/auth/requireAuth.js";
import { activeCharacterId, advanceTurn, getSession, pauseQueue, previousTurn, resumeQueue } from "../_lib/services/turnEngine.js";
import { processTurnInput } from "../_lib/services/turnOrchestrator.js";
import { logEvent, logCorrection, getRecentEvents } from "../_lib/services/eventLogService.js";
import { getCharacter } from "../_lib/services/characterService.js";
import { getCampaign } from "../_lib/services/campaignService.js";
import { applyRuling } from "../_lib/services/rulesEngine.js";
import { requestMoveSuggestions, requestRoundNarration } from "../_lib/services/aiDM.js";

// Consolidated into one dynamic-segment function (was 6 separate files) to
// stay well under Vercel's per-deployment Serverless Function count limit.
// Routes: POST /api/turn/{advance|previous|pause|resume|action|roll|correction|suggest}
export const config = { maxDuration: 30 };

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const action = req.query.action as string;
  const auth = getAuth(req);

  switch (action) {
    case "advance": {
      requireAdmin(auth);
      const { sessionId } = readBody<{ sessionId: string }>(req);
      const { session, roundAdvanced } = await advanceTurn(sessionId);
      const activeEntry = session.turnQueue[session.currentTurnIndex];
      const character = activeEntry ? await getCharacter(activeEntry.characterId) : null;
      const text = character ? `It's now ${character.name}'s turn.` : "Turn advanced.";
      await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "System", text });

      if (roundAdvanced) {
        // Ambient world narration at the start of each round. Best-effort --
        // a narration failure shouldn't block the turn from having advanced.
        try {
          const campaign = await getCampaign(session.campaignId);
          if (campaign) {
            const recentEvents = await getRecentEvents(sessionId, 10);
            const narration = await requestRoundNarration({ campaign, recentEvents, round: session.round });
            if (narration) {
              await logEvent({ sessionId, campaignId: session.campaignId, type: "narration", actorLabel: "AI DM", text: narration });
            }
          }
        } catch (err) {
          console.error("round narration failed:", err);
        }
      }

      res.json(session);
      return;
    }

    case "previous": {
      requireAdmin(auth);
      const { sessionId } = readBody<{ sessionId: string }>(req);
      const session = await previousTurn(sessionId);
      const activeEntry = session.turnQueue[session.currentTurnIndex];
      const character = activeEntry ? await getCharacter(activeEntry.characterId) : null;
      const text = character ? `Admin went back -- it's now ${character.name}'s turn.` : "Turn went back.";
      await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "Admin", text });
      res.json(session);
      return;
    }

    case "pause": {
      requireAdmin(auth);
      const { sessionId } = readBody<{ sessionId: string }>(req);
      const session = await pauseQueue(sessionId, "admin");
      await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "Admin", text: "Admin paused the session." });
      res.json(session);
      return;
    }

    case "resume": {
      requireAdmin(auth);
      const { sessionId } = readBody<{ sessionId: string }>(req);
      const session = await resumeQueue(sessionId);
      await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "Admin", text: "Admin resumed the session." });
      res.json(session);
      return;
    }

    case "action": {
      const { sessionId, characterId, actionText } = readBody<{ sessionId: string; characterId: string; actionText: string }>(req);
      const session = await getSession(sessionId);
      if (!session) throw new HttpError(404, "Session not found");
      if (session.status !== "active") throw new HttpError(409, "Session is paused");
      await assertOwnsCharacterOrAdmin(auth, characterId);
      if (!auth.isAdmin && activeCharacterId(session) !== characterId) throw new HttpError(409, "It is not your turn");

      await logEvent({
        sessionId,
        campaignId: session.campaignId,
        type: "player_action",
        characterId,
        actorLabel: auth.name,
        text: actionText,
      });
      const result = await processTurnInput({ sessionId, actionText });
      res.json({ ok: true, ...result });
      return;
    }

    case "roll": {
      const { sessionId, characterId, rollValue, rollType } = readBody<{
        sessionId: string;
        characterId: string;
        rollValue: number;
        rollType?: string;
      }>(req);
      const session = await getSession(sessionId);
      if (!session) throw new HttpError(404, "Session not found");
      if (session.status !== "active") throw new HttpError(409, "Session is paused");
      await assertOwnsCharacterOrAdmin(auth, characterId);
      if (!auth.isAdmin && activeCharacterId(session) !== characterId) throw new HttpError(409, "It is not your turn");
      if (!session.pendingRoll) throw new HttpError(409, "No roll is currently expected");

      const effectiveRollType = rollType ?? session.pendingRoll.rollType;
      await logEvent({
        sessionId,
        campaignId: session.campaignId,
        type: "roll_submitted",
        characterId,
        actorLabel: auth.name,
        text: `Rolled ${rollValue}`,
        rollType: effectiveRollType,
        rollValue,
      });
      const result = await processTurnInput({ sessionId, actionText: session.pendingActionText ?? "", rollValue, rollType: effectiveRollType });
      res.json({ ok: true, ...result });
      return;
    }

    case "suggest": {
      const { sessionId, characterId } = readBody<{ sessionId: string; characterId: string }>(req);
      const session = await getSession(sessionId);
      if (!session) throw new HttpError(404, "Session not found");
      await assertOwnsCharacterOrAdmin(auth, characterId);
      if (!auth.isAdmin && activeCharacterId(session) !== characterId) throw new HttpError(409, "It is not your turn");

      const character = await getCharacter(characterId);
      if (!character) throw new HttpError(404, "Character not found");
      const campaign = await getCampaign(session.campaignId);
      if (!campaign) throw new HttpError(404, "Campaign not found");
      const recentEvents = await getRecentEvents(sessionId, 10);

      const suggestions = await requestMoveSuggestions({ campaign, character, recentEvents });
      res.json({ suggestions });
      return;
    }

    case "correction": {
      requireAdmin(auth);
      const { sessionId, originalText, correctedText, reason, characterId, hpChange, conditionsAdded, conditionsRemoved } = readBody<{
        sessionId: string;
        originalText: string;
        correctedText: string;
        reason?: string;
        characterId?: string;
        hpChange?: number;
        conditionsAdded?: { name: string; roundsRemaining?: number }[];
        conditionsRemoved?: string[];
      }>(req);

      const session = await getSession(sessionId);
      if (!session) throw new HttpError(404, "Session not found");

      const event = await logCorrection({ sessionId, campaignId: session.campaignId, correctedBy: auth.name, originalText, correctedText, reason });

      let updatedCharacter;
      if (characterId && (hpChange || conditionsAdded || conditionsRemoved)) {
        updatedCharacter = await applyRuling(characterId, { narration: correctedText, requiresRoll: false, hpChange, conditionsAdded, conditionsRemoved });
      }
      res.json({ ok: true, event, updatedCharacter });
      return;
    }

    default:
      throw new HttpError(404, "Not found");
  }
});
