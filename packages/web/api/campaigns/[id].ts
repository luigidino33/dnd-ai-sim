import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WorldBible } from "@dnd-ai-sim/shared";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getCampaign, updateWorldBible } from "../_lib/services/campaignService.js";

// Single dynamic segment only -- catch-all routes ([...params].ts /
// [[...params]].ts) don't reliably populate req.query on this Vercel
// project (verified: single segments work, catch-all doesn't), so the
// world-bible sub-resource is a query param on this same file instead of
// an extra path segment.
// Routes: GET /api/campaigns/:id, PATCH /api/campaigns/:id?action=world-bible
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const id = req.query.id as string;
  const auth = getAuth(req);

  if (req.query.action === "world-bible") {
    if (req.method !== "PATCH") throw new HttpError(405, "Method not allowed");
    requireAdmin(auth);
    const worldBible = readBody<WorldBible>(req);
    const campaign = await updateWorldBible(id, worldBible);
    res.json(campaign);
    return;
  }

  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  const campaign = await getCampaign(id);
  if (!campaign) throw new HttpError(404, "Campaign not found");
  // Invite codes are only meaningful to the Admin -- don't hand them to every authenticated player.
  if (auth.isAdmin) {
    res.json(campaign);
  } else {
    const { playerInviteCode, adminInviteCode, ...rest } = campaign;
    res.json(rest);
  }
});
