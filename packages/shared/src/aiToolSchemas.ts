// Additional Anthropic tool schemas beyond apply_ruling (see rulingSchema.ts):
// world-building at session start, and on-request move suggestions.

export const BUILD_WORLD_TOOL = {
  name: "build_world",
  description:
    "Generate the initial world for a brand-new campaign: a handful of locations, factions, and plot threads, plus an opening scene narration that introduces the party to the world. Call this exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      locations: {
        type: "array",
        description: "3-5 key locations in the world.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", description: "1-2 sentences." },
          },
          required: ["name", "description"],
        },
      },
      factions: {
        type: "array",
        description: "2-4 factions/groups with a stake in the world.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string", description: "1-2 sentences: who they are, what they want." },
          },
          required: ["name", "description"],
        },
      },
      plotThreads: {
        type: "array",
        description: "2-3 seed plot threads/hooks the party can pick up.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            status: { type: "string", description: "e.g. 'unstarted', 'rumored'" },
            description: { type: "string", description: "1-2 sentences." },
          },
          required: ["name", "status", "description"],
        },
      },
      openingNarration: {
        type: "string",
        description: "A few sentences of in-character opening narration that sets the scene for the party as the session begins.",
      },
    },
    required: ["locations", "factions", "plotThreads", "openingNarration"],
  },
};

export const SUGGEST_ACTIONS_TOOL = {
  name: "suggest_actions",
  description: "Suggest 2-4 short, concrete action options the current player could take right now, given the scene and their character.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", description: "A short (under ~12 words) concrete action phrased as something the player could say, e.g. 'Search the bookshelf for hidden compartments'." },
      },
    },
    required: ["suggestions"],
  },
};
