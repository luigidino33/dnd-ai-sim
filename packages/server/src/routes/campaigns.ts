import { Router } from "express";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createCampaign, getCampaign, updateWorldBible } from "../services/campaignService.js";

export const campaignsRouter = Router();

/** Bootstraps the single ongoing campaign (requirement 5.4). No auth required -- this is the entry point before any invite code exists. */
campaignsRouter.post("/", async (req, res) => {
  const { name, dmTone } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const campaign = await createCampaign(name.trim(), dmTone);
  res.status(201).json({
    id: campaign._id,
    name: campaign.name,
    dmTone: campaign.dmTone,
    playerInviteCode: campaign.playerInviteCode,
    adminInviteCode: campaign.adminInviteCode,
  });
});

campaignsRouter.get("/:id", requireAuth, async (req, res) => {
  const campaign = await getCampaign(req.params.id);
  if (!campaign) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  // Invite codes are only meaningful to the Admin (they're how new players/admins join) --
  // don't hand them to every authenticated player.
  if (req.auth?.isAdmin) {
    res.json(campaign);
  } else {
    const { playerInviteCode, adminInviteCode, ...rest } = campaign.toObject();
    res.json(rest);
  }
});

campaignsRouter.patch("/:id/world-bible", requireAuth, requireAdmin, async (req, res) => {
  const campaign = await updateWorldBible(req.params.id, req.body);
  res.json(campaign);
});
