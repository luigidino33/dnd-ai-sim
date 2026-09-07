import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { resumeQueue } from "../_lib/services/turnEngine.js";
import { logEvent } from "../_lib/services/eventLogService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  requireAdmin(auth);
  const { sessionId } = readBody<{ sessionId: string }>(req);

  const session = await resumeQueue(sessionId);
  await logEvent({ sessionId, campaignId: session.campaignId, type: "system", actorLabel: "Admin", text: "Admin resumed the session." });
  res.json(session);
});
