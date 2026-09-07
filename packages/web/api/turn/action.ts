import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, assertOwnsCharacterOrAdmin } from "../_lib/auth/requireAuth.js";
import { activeCharacterId, getSession } from "../_lib/services/turnEngine.js";
import { processTurnInput } from "../_lib/services/turnOrchestrator.js";
import { logEvent } from "../_lib/services/eventLogService.js";

export const config = { maxDuration: 30 };

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  const { sessionId, characterId, actionText } = readBody<{ sessionId: string; characterId: string; actionText: string }>(req);

  const session = await getSession(sessionId);
  if (!session) throw new HttpError(404, "Session not found");
  if (session.status !== "active") throw new HttpError(409, "Session is paused");
  await assertOwnsCharacterOrAdmin(auth, characterId);
  if (!auth.isAdmin && activeCharacterId(session) !== characterId) {
    throw new HttpError(409, "It is not your turn");
  }

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
});
