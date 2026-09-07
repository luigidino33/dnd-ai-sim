import Anthropic from "@anthropic-ai/sdk";
import { APPLY_RULING_TOOL, type RulingResult } from "@dnd-ai-sim/shared";
import { env } from "../config/env.js";
import { buildRulesContext } from "../srd/lookup.js";
import type { CampaignDoc } from "../db/models/Campaign.js";
import type { CharacterDoc } from "../db/models/Character.js";
import type { EventLogDoc } from "../db/models/EventLog.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

function systemPrompt(campaign: CampaignDoc & { _id: any }): string {
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

function characterSummary(character: CharacterDoc & { _id: any }): string {
  const hp = character.hitPoints;
  const conditions = character.conditions?.map((c: any) => c.name).join(", ") || "none";
  return [
    `${character.name} -- Level ${character.level} ${character.race} ${character.class} (${character.background})`,
    `HP: ${hp?.current}/${hp?.max}${hp?.temp ? ` (+${hp.temp} temp)` : ""} | AC: ${character.derived?.armorClass} | Conditions: ${conditions}`,
    `Passive Perception: ${character.derived?.passivePerception} | Initiative bonus: ${character.derived?.initiativeBonus}`,
  ].join("\n");
}

function eventSummary(event: EventLogDoc & { _id: any }): string {
  const label = event.actorLabel ?? event.type;
  return `[${event.type}] ${label}: ${event.text}`;
}

export interface RequestRulingParams {
  campaign: CampaignDoc & { _id: any };
  actingCharacter: CharacterDoc & { _id: any };
  partySummaries: (CharacterDoc & { _id: any })[];
  recentEvents: (EventLogDoc & { _id: any })[];
  playerActionText: string;
  rollType?: string;
  rollValue?: number;
}

export async function requestRuling(params: RequestRulingParams): Promise<RulingResult> {
  const { campaign, actingCharacter, partySummaries, recentEvents, playerActionText, rollType, rollValue } = params;

  const worldBible = campaign.worldBible;
  const worldBibleText = [
    worldBible?.locations?.length ? `Locations:\n${worldBible.locations.map((l: any) => `- ${l.name}: ${l.description}`).join("\n")}` : "",
    worldBible?.factions?.length ? `Factions:\n${worldBible.factions.map((f: any) => `- ${f.name}: ${f.description}`).join("\n")}` : "",
    worldBible?.plotThreads?.length
      ? `Plot threads:\n${worldBible.plotThreads.map((p: any) => `- ${p.name} (${p.status}): ${p.description}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n") || "(empty so far)";

  const rulesContext = buildRulesContext(playerActionText, {
    activeConditionNames: (actingCharacter.conditions ?? []).map((c: any) => c.name),
  });

  const rollLine =
    rollValue !== undefined
      ? `The player just entered a manual roll: ${rollValue}${rollType ? ` (${rollType})` : ""}. Resolve the outcome now.`
      : `No roll has been entered yet for this action.`;

  const userMessage = [
    `## World Bible\n${worldBibleText}`,
    `## Acting Character\n${characterSummary(actingCharacter)}`,
    partySummaries.length > 0
      ? `## Party\n${partySummaries.map((c: any) => `- ${c.name}: ${c.hitPoints.current}/${c.hitPoints.max} HP`).join("\n")}`
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
