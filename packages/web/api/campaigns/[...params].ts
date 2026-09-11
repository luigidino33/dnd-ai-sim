import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { WorldBible } from "@dnd-ai-sim/shared";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { getAuth, requireAdmin } from "../_lib/auth/requireAuth.js";
import { getCampaign, updateWorldBible } from "../_lib/services/campaignService.js";

// Required catch-all (1+ segments) -- the bare POST /api/campaigns route
// lives in index.ts. Vercel's generic Functions routing doesn't fully
// support the Next.js-style optional double-bracket catch-all, so the
// zero-segment case has to be its own file.
// Routes: GET /api/campaigns/:id, PATCH /api/campaigns/:id/world-bible
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  const params = ([] as string[]).concat((req.query.params as string[] | undefined) ?? []);
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
