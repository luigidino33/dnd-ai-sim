import { Schema, model, type InferSchemaType } from "mongoose";

const worldBibleSchema = new Schema(
  {
    locations: [{ name: String, description: String }],
    factions: [{ name: String, description: String }],
    plotThreads: [{ name: String, status: String, description: String }],
  },
  { _id: false }
);

const campaignSchema = new Schema(
  {
    name: { type: String, required: true },
    playerInviteCode: { type: String, required: true, unique: true },
    adminInviteCode: { type: String, required: true, unique: true },
    dmTone: { type: String, default: "high fantasy" },
    worldBible: { type: worldBibleSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export type CampaignDoc = InferSchemaType<typeof campaignSchema>;
export const CampaignModel = model("Campaign", campaignSchema);
