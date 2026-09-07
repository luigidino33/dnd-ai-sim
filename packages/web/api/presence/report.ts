import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { getSession, pauseQueue, resumeQueue } from "../_lib/services/turnEngine.js";
import { logEvent } from "../_lib/services/eventLogService.js";

/**
 * Graceful degradation (requirement 6): there's no persistent server process
 * to notice the Admin's socket drop anymore, so any connected client that
 * observes the Admin's Supabase Realtime presence change reports it here.
 * Both branches are idempotent -- redundant reports from multiple clients
 * (or the Admin's own reconnect) are harmless no-ops after the first.
 */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  const { sessionId, event } = readBody<{ sessionId: string; event: "admin-left" | "admin-joined" }>(req);

  const session = await getSession(sessionId);
  if (!session) throw new HttpError(404, "Session not found");
  if (session.campaignId !== auth.campaignId) throw new HttpError(403, "Wrong campaign");

  if (event === "admin-left" && session.status === "active") {
    const paused = await pauseQueue(sessionId, "disconnect");
    await logEvent({
      sessionId,
      campaignId: session.campaignId,
      type: "system",
      actorLabel: "System",
      text: "Connection to the Admin device was lost -- session paused automatically.",
    });
    res.json(paused);
    return;
  }

  if (event === "admin-joined" && session.status === "paused" && session.pauseReason === "disconnect") {
    const resumed = await resumeQueue(sessionId);
    await logEvent({
      sessionId,
      campaignId: session.campaignId,
      type: "system",
      actorLabel: "System",
      text: "Admin device reconnected -- session resumed.",
    });
    res.json(resumed);
    return;
  }

  res.json(session);
});
