import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { advanceTurn } from "../_lib/services/turnEngine.js";
import { logEvent } from "../_lib/services/eventLogService.js";
import { getCharacter } from "../_lib/services/characterService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  requireAdmin(auth);
  const { sessionId } = readBody<{ sessionId: string }>(req);

  const session = await advanceTurn(sessionId);
  const activeEntry = session.turnQueue[session.currentTurnIndex];
  const character = activeEntry ? await getCharacter(activeEntry.characterId) : null;
  const text = character ? `It's now ${character.name}'s turn.` : "Turn advanced.";

  await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "System", text });
  res.json(session);
});
