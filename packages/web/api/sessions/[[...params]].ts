import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getSession, getCurrentSessionForCampaign, startSession } from "../_lib/services/turnEngine.js";
import { getAllEvents } from "../_lib/services/eventLogService.js";
import { listCharactersForCampaign } from "../_lib/services/characterService.js";

// Consolidated into one catch-all function (was 4 separate files) to stay
// well under Vercel's per-deployment Serverless Function count limit.
// Routes: POST /api/sessions, GET /api/sessions/:id, GET /api/sessions/:id/events,
// GET /api/sessions/campaign/:campaignId/current
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);
  const auth = getAuth(req);

  if (params.length === 0) {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
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

  if (params.length === 3 && params[0] === "campaign" && params[2] === "current") {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const session = await getCurrentSessionForCampaign(params[1]);
    res.json(session);
    return;
  }

  if (params.length === 2 && params[1] === "events") {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const events = await getAllEvents(params[0]);
    res.json(events);
    return;
  }

  if (params.length === 1) {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const session = await getSession(params[0]);
    if (!session) throw new HttpError(404, "Session not found");
    res.json(session);
    return;
  }

  throw new HttpError(404, "Not found");
});
