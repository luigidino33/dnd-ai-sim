import { Schema, model, type InferSchemaType } from "mongoose";

const sessionSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    status: { type: String, enum: ["active", "paused", "ended"], default: "active" },
    pauseReason: { type: String, enum: ["admin", "disconnect"] },
    turnQueue: [
      {
        characterId: { type: Schema.Types.ObjectId, ref: "Character", required: true },
        hasActedThisRound: { type: Boolean, default: false },
      },
    ],
    currentTurnIndex: { type: Number, default: -1 },
    round: { type: Number, default: 1 },
    // Waiting on a roll for the currently active character (set once the AI DM
    // asks for a roll, cleared once it's resolved) — lets clients gate input.
    pendingRoll: {
      rollType: String,
      rollPrompt: String,
    },
    // The action text that triggered pendingRoll, replayed to the AI DM once
    // the roll comes in so it can resolve the same action.
    pendingActionText: { type: String },
  },
  { timestamps: true }
);

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const SessionModel = model("Session", sessionSchema);
