import crypto from "node:crypto";
import { CampaignModel } from "../db/models/Campaign.js";
import type { WorldBible } from "@dnd-ai-sim/shared";

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function createCampaign(name: string, dmTone?: string) {
  return CampaignModel.create({
    name,
    dmTone: dmTone ?? "high fantasy",
    playerInviteCode: generateInviteCode(),
    adminInviteCode: generateInviteCode(),
    worldBible: { locations: [], factions: [], plotThreads: [] },
  });
}

export async function getCampaign(id: string) {
  return CampaignModel.findById(id);
}

export async function findCampaignByInviteCode(code: string) {
  const normalized = code.trim().toUpperCase();
  const campaign = await CampaignModel.findOne({
    $or: [{ playerInviteCode: normalized }, { adminInviteCode: normalized }],
  });
  if (!campaign) return null;
  return { campaign, isAdmin: campaign.adminInviteCode === normalized };
}

export async function updateWorldBible(campaignId: string, worldBible: WorldBible) {
  const campaign = await CampaignModel.findById(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  campaign.worldBible = worldBible as any;
  await campaign.save();
  return campaign;
}
