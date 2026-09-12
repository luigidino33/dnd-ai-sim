import Anthropic from "@anthropic-ai/sdk";
import {
  APPLY_RULING_TOOL,
  BUILD_WORLD_TOOL,
  SUGGEST_ACTIONS_TOOL,
  type CampaignRecord,
  type Character,
  type RulingResult,
  type SessionEvent,
  type WorldBible,
} from "@dnd-ai-sim/shared";
import { env } from "../env.js";
import { buildRulesContext } from "../srd/lookup.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

function systemPrompt(campaign: CampaignRecord): string {
  return [
    `You are the Dungeon Master for a live, in-person Dungeons & Dragons 5th Edition session. There is no human DM -- you are it.`,
    `Tone/style: ${campaign.dmTone}.`,
    ``,
    `Rules you must follow:`,
    `- Dice are physical: players roll real dice and type in the result. You NEVER invent a die roll. When an action needs a roll you don't have yet, set requiresRoll=true and stop there -- do not resolve the outcome.`,
    `- When a roll result is provided, apply the character's modifiers (given to you) and the rules context (given to you) to determine the outcome yourself.`,
    `- Stay strictly consistent with the world bible and prior session log provided below -- don't contradict established facts.`,
    `- Roleplay NPCs/monsters with distinct, consistent personalities.`,
    `- You MUST call the apply_ruling tool exactly once per response, even for pure narration with no mechanical effect (leave the mechanical fields empty in that case).`,
    `- Keep narration tight and table-paceable -- a few sentences, not a novel -- since 9 players are waiting on turns live.`,
  ].join("\n");
}

function characterSummary(character: Character): string {
  const hp = character.hitPoints;
  const conditions = character.conditions?.map((c) => c.name).join(", ") || "none";
  return [
    `${character.name} -- Level ${character.level} ${character.race} ${character.class} (${character.background})`,
    `HP: ${hp?.current}/${hp?.max}${hp?.temp ? ` (+${hp.temp} temp)` : ""} | AC: ${character.derived?.armorClass} | Conditions: ${conditions}`,
    `Passive Perception: ${character.derived?.passivePerception} | Initiative bonus: ${character.derived?.initiativeBonus}`,
  ].join("\n");
}

function eventSummary(event: SessionEvent): string {
  const label = event.actorLabel ?? event.type;
  return `[${event.type}] ${label}: ${event.text}`;
}

function worldBibleText(campaign: CampaignRecord): string {
  const worldBible = campaign.worldBible;
  return (
    [
      Array.isArray(worldBible?.locations) && worldBible.locations.length
        ? `Locations:\n${worldBible.locations.map((l: any) => `- ${l.name}: ${l.description}`).join("\n")}`
        : "",
      Array.isArray(worldBible?.factions) && worldBible.factions.length
        ? `Factions:\n${worldBible.factions.map((f: any) => `- ${f.name}: ${f.description}`).join("\n")}`
        : "",
      Array.isArray(worldBible?.plotThreads) && worldBible.plotThreads.length
        ? `Plot threads:\n${worldBible.plotThreads.map((p: any) => `- ${p.name} (${p.status}): ${p.description}`).join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n") || "(empty so far)"
  );
}

export interface RequestRulingParams {
  campaign: CampaignRecord;
  actingCharacter: Character;
  partySummaries: Character[];
  recentEvents: SessionEvent[];
  playerActionText: string;
  rollType?: string;
  rollValue?: number;
}

export async function requestRuling(params: RequestRulingParams): Promise<RulingResult> {
  const { campaign, actingCharacter, partySummaries, recentEvents, playerActionText, rollType, rollValue } = params;

  const rulesContext = buildRulesContext(playerActionText, {
    activeConditionNames: (actingCharacter.conditions ?? []).map((c) => c.name),
  });

  const rollLine =
    rollValue !== undefined
      ? `The player just entered a manual roll: ${rollValue}${rollType ? ` (${rollType})` : ""}. Resolve the outcome now.`
      : `No roll has been entered yet for this action.`;

  const userMessage = [
    `## World Bible\n${worldBibleText(campaign)}`,
    `## Acting Character\n${characterSummary(actingCharacter)}`,
    partySummaries.length > 0
      ? `## Party\n${partySummaries.map((c) => `- ${c.name}: ${c.hitPoints.current}/${c.hitPoints.max} HP`).join("\n")}`
      : "",
    `## Recent Session Log\n${recentEvents.map(eventSummary).join("\n") || "(session just started)"}`,
    `## Rules Context\n${rulesContext}`,
    `## Current Turn\n${actingCharacter.name} does: "${playerActionText}"\n${rollLine}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await client.messages.create({
    model: env.aiDmModel,
    max_tokens: 1024,
    system: systemPrompt(campaign),
    tools: [APPLY_RULING_TOOL],
    tool_choice: { type: "tool", name: APPLY_RULING_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI DM did not return a structured ruling");
  }

  return toolUse.input as RulingResult;
}

export interface RequestRoundNarrationParams {
  campaign: CampaignRecord;
  recentEvents: SessionEvent[];
  round: number;
}

/**
 * Ambient scene-setting narration fired automatically whenever the round
 * number advances (requirement "narrations about the world") -- plain text,
 * not tied to any character's action, so no apply_ruling tool-use needed.
 */
export async function requestRoundNarration(params: RequestRoundNarrationParams): Promise<string> {
  const { campaign, recentEvents, round } = params;

  const userMessage = [
    `## World Bible\n${worldBibleText(campaign)}`,
    `## Recent Session Log\n${recentEvents.map(eventSummary).join("\n") || "(session just started)"}`,
    `## Round ${round} is beginning.`,
    `Give a brief (1-3 sentence) piece of ambient narration -- scene-setting, environmental detail, an NPC's ambient action, or a subtle world/plot development -- to set the mood as play continues into this round. Do not resolve any mechanics, address a specific player, or ask a question.`,
  ].join("\n\n");

  const response = await client.messages.create({
    model: env.aiDmModel,
    max_tokens: 300,
    system: systemPrompt(campaign),
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((block) => block.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
}

export interface WorldBuildingResult {
  worldBible: WorldBible;
  openingNarration: string;
}

/**
 * Fires once, when a campaign's first session starts and its world bible is
 * still empty: the AI invents the setting (locations/factions/plot threads)
 * so the world bible -- already injected into every other AI call -- has
 * something to work with from turn one, plus an opening scene to kick off.
 */
export async function requestWorldBuilding(params: { campaign: CampaignRecord }): Promise<WorldBuildingResult> {
  const { campaign } = params;

  const userMessage = [
    `A brand-new D&D 5e campaign is starting with no established world yet.`,
    `Tone/style: ${campaign.dmTone}.`,
    `Invent a small, coherent starting world: a handful of locations, a few factions with competing interests, and some seed plot threads the party could pursue. Keep everything tight and usable at the table, not an epic worldbook.`,
    `Then write a short opening narration (in-character, a few sentences) that drops the party into the world and this first scene.`,
  ].join("\n");

  const response = await client.messages.create({
    model: env.aiDmModel,
    max_tokens: 3000,
    system: systemPrompt(campaign),
    tools: [BUILD_WORLD_TOOL],
    tool_choice: { type: "tool", name: BUILD_WORLD_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  // A tool call cut off by the token limit still comes back as a tool_use
  // block, just with incomplete/malformed input -- catch that explicitly
  // instead of persisting garbage (see requirement 5.4 postmortem: a
  // truncated response once saved a string fragment into `locations`).
  if (response.stop_reason === "max_tokens") {
    throw new Error("AI DM's world-building response was truncated (hit max_tokens)");
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI DM did not return world-building content");
  }
  // BUILD_WORLD_TOOL's input_schema is flat (locations/factions/plotThreads/
  // openingNarration all top-level) -- reshape into the nested WorldBible
  // shape the rest of the app (and the DB column) expects.
  const input = toolUse.input as { locations: unknown; factions: unknown; plotThreads: unknown; openingNarration: string };
  if (!Array.isArray(input.locations) || !Array.isArray(input.factions) || !Array.isArray(input.plotThreads)) {
    // Temporary verbose diagnostic -- shows actual types and a raw snippet so
    // the malformed shape can be seen without direct log access. Trim once root-caused.
    const shapes = `locations=${typeof input.locations}, factions=${typeof input.factions}, plotThreads=${typeof input.plotThreads}`;
    const raw = JSON.stringify(input).slice(0, 800);
    throw new Error(`AI DM returned malformed world-building data (${shapes}). Raw: ${raw}`);
  }
  return {
    worldBible: { locations: input.locations, factions: input.factions, plotThreads: input.plotThreads } as WorldBible,
    openingNarration: input.openingNarration,
  };
}

/** On-request suggestions for the active player's turn -- inspiration, not a required menu; the player can still type anything. */
export async function requestMoveSuggestions(params: {
  campaign: CampaignRecord;
  character: Character;
  recentEvents: SessionEvent[];
}): Promise<string[]> {
  const { campaign, character, recentEvents } = params;

  const userMessage = [
    `## World Bible\n${worldBibleText(campaign)}`,
    `## Character\n${characterSummary(character)}`,
    `## Recent Session Log\n${recentEvents.map(eventSummary).join("\n") || "(session just started)"}`,
    `It's ${character.name}'s turn. Suggest a few concrete things they could do right now, grounded in the current scene and their character sheet.`,
  ].join("\n\n");

  const response = await client.messages.create({
    model: env.aiDmModel,
    max_tokens: 400,
    system: systemPrompt(campaign),
    tools: [SUGGEST_ACTIONS_TOOL],
    tool_choice: { type: "tool", name: SUGGEST_ACTIONS_TOOL.name },
    messages: [{ role: "user", content: userMessage }],
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI DM did not return suggestions");
  }
  return (toolUse.input as { suggestions: string[] }).suggestions;
}
