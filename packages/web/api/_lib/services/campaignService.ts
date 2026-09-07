import crypto from "node:crypto";
import { getServiceClient } from "../supabase.js";
import { rowToCampaign, type CampaignRecord, type WorldBible } from "@dnd-ai-sim/shared";

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString("hex").toUpperCase();
}

export async function createCampaign(name: string, dmTone?: string): Promise<CampaignRecord> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("campaigns")
    .insert({
      name,
      dm_tone: dmTone ?? "high fantasy",
      player_invite_code: generateInviteCode(),
      admin_invite_code: generateInviteCode(),
      world_bible: { locations: [], factions: [], plotThreads: [] },
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCampaign(data);
}

export async function getCampaign(id: string): Promise<CampaignRecord | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("campaigns").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToCampaign(data) : null;
}

export async function findCampaignByInviteCode(
  code: string
): Promise<{ campaign: CampaignRecord; isAdmin: boolean } | null> {
  const normalized = code.trim().toUpperCase();
  const db = getServiceClient();
  const { data, error } = await db
    .from("campaigns")
    .select()
    .or(`player_invite_code.eq.${normalized},admin_invite_code.eq.${normalized}`)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const campaign = rowToCampaign(data);
  return { campaign, isAdmin: campaign.adminInviteCode === normalized };
}

export async function updateWorldBible(campaignId: string, worldBible: WorldBible): Promise<CampaignRecord> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("campaigns")
    .update({ world_bible: worldBible })
    .eq("id", campaignId)
    .select()
    .single();
  if (error) throw error;
  return rowToCampaign(data);
}
