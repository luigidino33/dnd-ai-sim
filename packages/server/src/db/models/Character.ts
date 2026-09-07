import { Schema, model, type InferSchemaType } from "mongoose";
import { ABILITY_SCORE_KEYS, SKILLS } from "@dnd-ai-sim/shared";

const abilityScoresSchema = new Schema(
  Object.fromEntries(ABILITY_SCORE_KEYS.map((key) => [key, { type: Number, required: true }])),
  { _id: false }
);

const derivedStatsSchema = new Schema(
  {
    abilityModifiers: {
      type: Map,
      of: Number,
    },
    proficiencyBonus: Number,
    armorClass: Number,
    hitPointMax: Number,
    initiativeBonus: Number,
    passivePerception: Number,
    savingThrows: {
      type: Map,
      of: new Schema({ bonus: Number, proficient: Boolean }, { _id: false }),
    },
    skillBonuses: {
      type: Map,
      of: new Schema({ bonus: Number, proficient: Boolean }, { _id: false }),
    },
  },
  { _id: false }
);

const characterSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    playerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    race: { type: String, required: true },
    class: { type: String, required: true },
    background: { type: String, required: true },
    level: { type: Number, default: 1 },
    abilityScores: { type: abilityScoresSchema, required: true },
    abilityScoreMethod: { type: String, enum: ["pointBuy", "standardArray", "manual"], required: true },
    proficientSkills: [{ type: String, enum: SKILLS }],
    proficientSavingThrows: [{ type: String, enum: ABILITY_SCORE_KEYS }],
    equipment: [{ name: String, quantity: Number, notes: String }],
    classFeatures: [{ type: String }],
    spellSlots: { type: Schema.Types.Mixed },
    baseArmorClass: { type: Number, default: 10 },
    derived: { type: derivedStatsSchema, required: true },
    hitPoints: {
      current: { type: Number, required: true },
      max: { type: Number, required: true },
      temp: { type: Number, default: 0 },
    },
    conditions: [
      {
        name: String,
        source: String,
        roundsRemaining: Number,
        appliedAt: { type: Date, default: Date.now },
      },
    ],
    deathSaves: {
      successes: { type: Number, default: 0 },
      failures: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

export type CharacterDoc = InferSchemaType<typeof characterSchema>;
export const CharacterModel = model("Character", characterSchema);
