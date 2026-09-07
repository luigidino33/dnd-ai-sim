import { getServiceClient } from "../supabase.js";

export interface UserRecord {
  id: string;
  campaignId: string;
  name: string;
  isAdmin: boolean;
}

function rowToUser(row: any): UserRecord {
  return { id: row.id, campaignId: row.campaign_id, name: row.name, isAdmin: row.is_admin };
}

/** Invite-code join reuses an existing user by (campaign, name) rather than creating duplicates on re-join. */
export async function findOrCreateUser(campaignId: string, name: string, isAdmin: boolean): Promise<UserRecord> {
  const db = getServiceClient();
  const { data: existing, error: findErr } = await db
    .from("users")
    .select()
    .eq("campaign_id", campaignId)
    .eq("name", name)
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    if (isAdmin && !existing.is_admin) {
      const { data, error } = await db.from("users").update({ is_admin: true }).eq("id", existing.id).select().single();
      if (error) throw error;
      return rowToUser(data);
    }
    return rowToUser(existing);
  }

  const { data, error } = await db
    .from("users")
    .insert({ campaign_id: campaignId, name, is_admin: isAdmin })
    .select()
    .single();
  if (error) throw error;
  return rowToUser(data);
}
