import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withApi, readBody, HttpError } from "../_lib/http.js";
import { findCampaignByInviteCode } from "../_lib/services/campaignService.js";
import { findOrCreateUser } from "../_lib/services/userService.js";
import { signSessionToken } from "../_lib/auth/jwt.js";

/**
 * Invite-code join flow (requirement 7 "Access control: Invite-only").
 * A campaign has separate player/admin invite codes; whichever code is used
 * determines the joining user's role. Re-joining with the same name reuses
 * the existing user rather than creating duplicates.
 */
export default withApi(async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "POST") throw new HttpError(405, "Method not allowed");
  const { inviteCode, name } = readBody<{ inviteCode?: string; name?: string }>(req);
  if (typeof inviteCode !== "string" || typeof name !== "string" || !name.trim()) {
    throw new HttpError(400, "inviteCode and name are required");
  }

  const found = await findCampaignByInviteCode(inviteCode);
  if (!found) throw new HttpError(404, "Invalid invite code");
  const { campaign, isAdmin } = found;

  const user = await findOrCreateUser(campaign.id, name.trim(), isAdmin);

  const token = signSessionToken({ userId: user.id, campaignId: campaign.id, isAdmin: user.isAdmin, name: user.name });

  res.json({
    token,
    user: { id: user.id, name: user.name, isAdmin: user.isAdmin },
    campaign: { id: campaign.id, name: campaign.name, dmTone: campaign.dmTone },
  });
});
