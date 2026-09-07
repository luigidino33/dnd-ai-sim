import { Schema, model, type InferSchemaType } from "mongoose";

const rulingSchema = new Schema(
  {
    narration: String,
    requiresRoll: Boolean,
    rollType: String,
    rollPrompt: String,
    outcome: String,
    targetCharacterId: { type: Schema.Types.ObjectId, ref: "Character" },
    hpChange: Number,
    conditionsAdded: [{ name: String, roundsRemaining: Number }],
    conditionsRemoved: [String],
    resourcesConsumed: [{ kind: String, amount: Number }],
  },
  { _id: false }
);

// Append-only audit log: every narration/roll/ruling/correction, with the
// raw inputs that produced it, so the Admin can review or correct after the fact.
const eventLogSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true },
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    type: {
      type: String,
      enum: ["narration", "player_action", "roll_submitted", "ruling", "correction", "system"],
      required: true,
    },
    characterId: { type: Schema.Types.ObjectId, ref: "Character" },
    actorLabel: String,
    text: { type: String, required: true },
    rollType: String,
    rollValue: Number,
    ruling: rulingSchema,
    correction: {
      correctedBy: String,
      originalText: String,
      correctedText: String,
      reason: String,
    },
  },
  { timestamps: true }
);

export type EventLogDoc = InferSchemaType<typeof eventLogSchema>;
export const EventLogModel = model("EventLog", eventLogSchema);
