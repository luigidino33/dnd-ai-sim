// Quick local bootstrap: creates the single ongoing campaign and prints its
// invite codes so you don't have to hand-craft a POST /api/campaigns call
// the first time you run the app locally.
import { connectDb } from "./db/connection.js";
import { createCampaign } from "./services/campaignService.js";
import mongoose from "mongoose";

async function main() {
  await connectDb();
  const name = process.argv[2] ?? "The Sunken Spire";
  const campaign = await createCampaign(name);
  console.log(`Created campaign "${campaign.name}" (${campaign._id})`);
  console.log(`  Admin invite code:  ${campaign.adminInviteCode}`);
  console.log(`  Player invite code: ${campaign.playerInviteCode}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
