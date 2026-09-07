// JSON Schema for the `apply_ruling` tool the AI DM must call on every turn.
// Forcing structured output means the server applies mechanical effects
// (HP, conditions, resources) deterministically instead of parsing prose.
// Keep this in sync with the RulingResult type in types.ts.

export const APPLY_RULING_TOOL = {
  name: "apply_ruling",
  description:
    "Report the narration and mechanical outcome for the current turn. Call this exactly once per turn, even when no roll is required (e.g. pure roleplay/narration) or when you are asking the player to make a roll before you can resolve the outcome.",
  input_schema: {
    type: "object" as const,
    properties: {
      narration: {
        type: "string",
        description: "In-character narration/dialogue shown to all players.",
      },
      requiresRoll: {
        type: "boolean",
        description:
          "True if you are asking the player to make a roll and have NOT yet resolved the outcome (a second call will resolve it once the roll is entered).",
      },
      rollType: {
        type: "string",
        enum: ["attack", "savingThrow", "skillCheck", "abilityCheck", "deathSave", "none"],
      },
      rollPrompt: {
        type: "string",
        description: "Human-readable description of what to roll, e.g. 'Dexterity saving throw'.",
      },
      outcome: {
        type: "string",
        enum: ["success", "failure", "hit", "miss", "criticalHit", "criticalMiss", "partial"],
      },
      targetCharacterId: {
        type: "string",
        description: "Character the mechanical effects apply to, if not the acting character.",
      },
      hpChange: {
        type: "number",
        description: "Hit point delta to apply. Negative for damage, positive for healing.",
      },
      conditionsAdded: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            roundsRemaining: { type: "number" },
          },
          required: ["name"],
        },
      },
      conditionsRemoved: {
        type: "array",
        items: { type: "string" },
      },
      resourcesConsumed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", description: "e.g. 'spellSlot1', 'kiPoint', 'rageUse'" },
            amount: { type: "number" },
          },
          required: ["kind", "amount"],
        },
      },
    },
    required: ["narration", "requiresRoll"],
  },
};
