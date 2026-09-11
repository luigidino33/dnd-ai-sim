import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { startSession } from "../_lib/services/turnEngine.js";
import { listCharactersForCampaign } from "../_lib/services/characterService.js";

/** Admin starts a new live session; the turn queue defaults to the full campaign roster. */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  requireAdmin(auth);

  const { characterIds } = readBody<{ characterIds?: string[] }>(req);
  const ids =
    Array.isArray(characterIds) && characterIds.length > 0
      ? characterIds
      : (await listCharactersForCampaign(auth.campaignId)).map((c) => c.id);

  if (ids.length === 0) {
    throw new HttpError(400, "Campaign has no characters yet -- create at least one before starting a session.");
  }

  const session = await startSession(auth.campaignId, ids);
  res.status(201).json(session);
});
