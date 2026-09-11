import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getCurrentSessionForCampaign, startSession } from "../_lib/services/turnEngine.js";
import { listCharactersForCampaign } from "../_lib/services/characterService.js";

// Routes: POST /api/sessions (start), GET /api/sessions?campaignId=...&current=1 (current live session)
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const auth = getAuth(req);

  if (req.method === "GET") {
    const campaignId = (req.query.campaignId as string) ?? auth.campaignId;
    const session = await getCurrentSessionForCampaign(campaignId);
    res.json(session);
    return;
  }

  if (req.method === "POST") {
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
    return;
  }

  throw new HttpError(405, "Method not allowed");
});
