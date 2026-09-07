import { Router } from "express";
import { UserModel } from "../db/models/User.js";
import { findCampaignByInviteCode } from "../services/campaignService.js";
import { signSessionToken } from "../auth/jwt.js";

export const authRouter = Router();

/**
 * Invite-code join flow (requirement 7 "Access control: Invite-only").
 * A campaign has separate player/admin invite codes; whichever code is used
 * determines the joining user's role. Re-joining with the same name reuses
 * the existing User rather than creating duplicates.
 */
authRouter.post("/join", async (req, res) => {
  const { inviteCode, name } = req.body ?? {};
  if (typeof inviteCode !== "string" || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "inviteCode and name are required" });
    return;
  }

  const found = await findCampaignByInviteCode(inviteCode);
  if (!found) {
    res.status(404).json({ error: "Invalid invite code" });
    return;
  }
  const { campaign, isAdmin } = found;

  let user = await UserModel.findOne({ campaignId: campaign._id, name: name.trim() });
  if (!user) {
    user = await UserModel.create({ name: name.trim(), campaignId: campaign._id, isAdmin });
  } else if (isAdmin && !user.isAdmin) {
    user.isAdmin = true;
    await user.save();
  }

  const token = signSessionToken({
    userId: String(user._id),
    campaignId: String(campaign._id),
    isAdmin: user.isAdmin,
    name: user.name,
  });

  res.json({
    token,
    user: { id: user._id, name: user.name, isAdmin: user.isAdmin },
    campaign: { id: campaign._id, name: campaign.name, dmTone: campaign.dmTone },
  });
});
