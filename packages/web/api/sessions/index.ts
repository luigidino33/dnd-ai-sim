import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getCurrentSessionForCampaign, startSession } from "../_lib/services/turnEngine.js";
import { listCharactersForCampaign } from "../_lib/services/characterService.js";
import { getCampaign, updateWorldBible } from "../_lib/services/campaignService.js";
import { logEvent } from "../_lib/services/eventLogService.js";
import { requestWorldBuilding } from "../_lib/services/aiDM.js";

// Routes: POST /api/sessions (start), GET /api/sessions?campaignId=...&current=1 (current live session)
export const config = { maxDuration: 30 };

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

    // First-ever session for this campaign (world bible still empty): let
    // the AI invent the setting so it has something to work from turn one,
    // and open with a scene instead of silence. Best-effort -- a failure
    // here shouldn't block the session from starting.
    try {
      const campaign = await getCampaign(auth.campaignId);
      const isEmpty =
        !campaign?.worldBible.locations?.length &&
        !campaign?.worldBible.factions?.length &&
        !campaign?.worldBible.plotThreads?.length;
      if (campaign && isEmpty) {
        const { worldBible, openingNarration } = await requestWorldBuilding({ campaign });
        await updateWorldBible(auth.campaignId, worldBible);
        await logEvent({
          sessionId: session.id,
          campaignId: auth.campaignId,
          type: "narration",
          actorLabel: "AI DM",
          text: openingNarration,
        });
      }
    } catch (err) {
      console.error("world building failed:", err instanceof Error ? err.stack : err);
      // Vercel function logs aren't reachable from outside the dashboard,
      // so surface the failure as a visible event too -- otherwise a
      // silent world-building failure looks identical to "still running."
      try {
        let detail: string;
        if (err instanceof Error) {
          detail = err.message;
        } else if (err && typeof err === "object") {
          // Some SDK/runtime errors (cross-realm, DOMException-likes) fail
          // `instanceof Error` but still carry message/name/status -- and
          // plain JSON.stringify silently drops those since they're often
          // non-enumerable. Grab everything getOwnPropertyNames can see.
          try {
            detail = JSON.stringify(err, Object.getOwnPropertyNames(err));
          } catch {
            detail = Object.prototype.toString.call(err);
          }
        } else {
          detail = String(err);
        }
        await logEvent({
          sessionId: session.id,
          campaignId: auth.campaignId,
          type: "system",
          actorLabel: "system",
          text: `World-building failed: ${detail}`,
        });
      } catch {
        // best-effort diagnostic only -- never let logging the failure fail the request
      }
    }

    res.status(201).json(session);
    return;
  }

  throw new HttpError(405, "Method not allowed");
});
