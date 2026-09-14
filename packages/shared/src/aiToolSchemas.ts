// Additional Anthropic tool schema beyond apply_ruling (see rulingSchema.ts):
// on-request move suggestions. World-building (requestWorldBuilding in
// aiDM.ts) deliberately does NOT use a tool schema -- forced tool_choice on
// a schema with three sibling array-of-object properties reliably corrupted
// the output (see the comment in aiDM.ts); it asks for plain JSON instead.

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
