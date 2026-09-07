import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getSession } from "../_lib/services/turnEngine.js";
import { logCorrection } from "../_lib/services/eventLogService.js";
import { applyRuling } from "../_lib/services/rulesEngine.js";

/**
 * "Pause-and-correct" (requirement 5.4): the Admin can pause at any point --
 * not just after the fact -- and issue a correction that's broadcast to
 * every player via Realtime, never silently changed (requirement 5.2).
 */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
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

  const event = await logCorrection({
    sessionId,
    campaignId: session.campaignId,
    correctedBy: auth.name,
    originalText,
    correctedText,
    reason,
  });

  let updatedCharacter;
  if (characterId && (hpChange || conditionsAdded || conditionsRemoved)) {
    updatedCharacter = await applyRuling(characterId, {
      narration: correctedText,
      requiresRoll: false,
      hpChange,
      conditionsAdded,
      conditionsRemoved,
    });
  }

  res.json({ ok: true, event, updatedCharacter });
});
