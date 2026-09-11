import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { getSession, getCurrentSessionForCampaign } from "../_lib/services/turnEngine.js";
import { getAllEvents } from "../_lib/services/eventLogService.js";

// Required catch-all (1+ segments) -- the bare POST /api/sessions route
// lives in index.ts (see campaigns/[...params].ts for why this isn't one
// optional-catch-all file).
// Routes: GET /api/sessions/:id, GET /api/sessions/:id/events, GET /api/sessions/campaign/:campaignId/current
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);
  getAuth(req);

  if (params.length === 3 && params[0] === "campaign" && params[2] === "current") {
    const session = await getCurrentSessionForCampaign(params[1]);
    res.json(session);
    return;
  }

  if (params.length === 2 && params[1] === "events") {
    const events = await getAllEvents(params[0]);
    res.json(events);
    return;
  }

  if (params.length === 1) {
    const session = await getSession(params[0]);
    if (!session) throw new HttpError(404, "Session not found");
    res.json(session);
    return;
  }

  throw new HttpError(404, "Not found");
});
