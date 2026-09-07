// Quick local bootstrap: creates the single ongoing campaign and prints its
// invite codes. Run from packages/web with your .env.local already filled in
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY at minimum).
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// Dynamic import: env.ts reads process.env at module-eval time, and static
// imports are hoisted above the dotenv.config() call above in ESM -- so this
// import must happen after, not before.
async function main() {
  const { createCampaign } = await import("../api/_lib/services/campaignService.js");
  const name = process.argv[2] ?? "The Sunken Spire";
  const campaign = await createCampaign(name);
  console.log(`Created campaign "${campaign.name}" (${campaign.id})`);
  console.log(`  Admin invite code:  ${campaign.adminInviteCode}`);
  console.log(`  Player invite code: ${campaign.playerInviteCode}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
