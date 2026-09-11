import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { getSession } from "../_lib/services/turnEngine.js";
import { getAllEvents } from "../_lib/services/eventLogService.js";

// Routes: GET /api/sessions/:id, GET /api/sessions/:id?include=events
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  getAuth(req);
  const id = req.query.id as string;

  if (req.query.include === "events") {
    const events = await getAllEvents(id);
    res.json(events);
    return;
  }

  const session = await getSession(id);
  if (!session) throw new HttpError(404, "Session not found");
  res.json(session);
});
