import Anthropic from "@anthropic-ai/sdk";
import {
  APPLY_RULING_TOOL,
  type CampaignRecord,
  type Character,
  type RulingResult,
  type SessionEvent,
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
      worldBible?.locations?.length
        ? `Locations:\n${worldBible.locations.map((l: any) => `- ${l.name}: ${l.description}`).join("\n")}`
        : "",
      worldBible?.factions?.length
        ? `Factions:\n${worldBible.factions.map((f: any) => `- ${f.name}: ${f.description}`).join("\n")}`
        : "",
      worldBible?.plotThreads?.length
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
