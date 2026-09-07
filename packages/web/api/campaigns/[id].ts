import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, HttpError } from "../_lib/http.js";
import { getAuth } from "../_lib/auth/requireAuth.js";
import { getCampaign } from "../_lib/services/campaignService.js";

export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") throw new HttpError(405, "Method not allowed");
  const auth = getAuth(req);
  const id = req.query.id as string;

  const campaign = await getCampaign(id);
  if (!campaign) throw new HttpError(404, "Campaign not found");

  // Invite codes are only meaningful to the Admin (they're how new players/admins join) --
  // don't hand them to every authenticated player.
  if (auth.isAdmin) {
    res.json(campaign);
  } else {
    const { playerInviteCode, adminInviteCode, ...rest } = campaign;
    res.json(rest);
  }
});
