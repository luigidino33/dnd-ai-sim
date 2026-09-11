import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WorldBible } from "@dnd-ai-sim/shared";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { createCampaign, getCampaign, updateWorldBible } from "../_lib/services/campaignService.js";

// Consolidated into one catch-all function (was 3 separate files) to stay
// well under Vercel's per-deployment Serverless Function count limit.
// Routes: POST /api/campaigns, GET /api/campaigns/:id, PATCH /api/campaigns/:id/world-bible
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);

  if (params.length === 0) {
    if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
    const { name, dmTone } = readBody<{ name?: string; dmTone?: string }>(req);
    if (typeof name !== "string" || !name.trim()) throw new HttpError(400, "name is required");
    const campaign = await createCampaign(name.trim(), dmTone);
    res.status(201).json(campaign);
    return;
  }

  const [id, sub] = params;

  if (params.length === 2 && sub === "world-bible") {
    if (req.method !== "PATCH") throw new HttpError(405, "Method not allowed");
    const auth = getAuth(req);
    requireAdmin(auth);
    const worldBible = readBody<WorldBible>(req);
    const campaign = await updateWorldBible(id, worldBible);
    res.json(campaign);
    return;
  }

  if (params.length === 1) {
    if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
    const auth = getAuth(req);
    const campaign = await getCampaign(id);
    if (!campaign) throw new HttpError(404, "Campaign not found");
    // Invite codes are only meaningful to the Admin -- don't hand them to every authenticated player.
    if (auth.isAdmin) {
      res.json(campaign);
    } else {
      const { playerInviteCode, adminInviteCode, ...rest } = campaign;
      res.json(rest);
    }
    return;
  }

  throw new HttpError(404, "Not found");
});
