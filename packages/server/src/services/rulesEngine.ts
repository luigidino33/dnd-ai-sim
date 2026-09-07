import type { RulingResult } from "@dnd-ai-sim/shared";
import { CharacterModel } from "../db/models/Character.js";

/**
 * Applies a resolved AI DM ruling to persistent character state. This is the
 * only place HP/conditions/resources actually change — the AI's output is
 * treated as a proposal until this runs, keeping state authoritative in Mongo
 * rather than "remembered" by the model (requirement 6).
 */
export async function applyRuling(actingCharacterId: string, ruling: RulingResult) {
  const targetId = ruling.targetCharacterId ?? actingCharacterId;
  // Cast to any: Mongoose's InferSchemaType marks nested subdocument fields as
  // optional even though hitPoints/conditions are always populated at creation.
  const character: any = await CharacterModel.findById(targetId);
  if (!character) throw new Error(`applyRuling: character ${targetId} not found`);

  const wasUp = character.hitPoints.current > 0;

  if (typeof ruling.hpChange === "number" && ruling.hpChange !== 0) {
    applyHpChange(character, ruling.hpChange);
  }

  const isDown = character.hitPoints.current <= 0;
  if (wasUp && isDown) {
    character.hitPoints.current = 0;
    if (!hasCondition(character, "unconscious")) {
      character.conditions.push({ name: "unconscious", source: "0 HP", appliedAt: new Date() } as any);
    }
    character.deathSaves = { successes: 0, failures: 0 };
  } else if (!wasUp && !isDown) {
    // Healed back up: clear unconscious/dying state.
    character.conditions = character.conditions.filter(
      (c: any) => c.name !== "unconscious"
    ) as any;
    character.deathSaves = { successes: 0, failures: 0 };
  }

  if (ruling.rollType === "deathSave" && ruling.outcome) {
    applyDeathSaveOutcome(character, ruling.outcome);
  }

  for (const added of ruling.conditionsAdded ?? []) {
    if (!hasCondition(character, added.name)) {
      character.conditions.push({
        name: added.name,
        roundsRemaining: added.roundsRemaining,
        appliedAt: new Date(),
      } as any);
    }
  }
  for (const removedName of ruling.conditionsRemoved ?? []) {
    character.conditions = character.conditions.filter((c: any) => c.name !== removedName) as any;
  }

  for (const resource of ruling.resourcesConsumed ?? []) {
    consumeResource(character, resource.kind, resource.amount);
  }

  await character.save();
  return character;
}

function applyHpChange(character: any, hpChange: number) {
  if (hpChange < 0) {
    let remaining = -hpChange;
    const tempAbsorbed = Math.min(character.hitPoints.temp, remaining);
    character.hitPoints.temp -= tempAbsorbed;
    remaining -= tempAbsorbed;
    character.hitPoints.current = Math.max(0, character.hitPoints.current - remaining);
  } else {
    character.hitPoints.current = Math.min(character.hitPoints.max, character.hitPoints.current + hpChange);
  }
}

function hasCondition(character: any, name: string): boolean {
  return character.conditions.some((c: any) => c.name === name);
}

function applyDeathSaveOutcome(character: any, outcome: RulingResult["outcome"]) {
  if (!character.deathSaves) character.deathSaves = { successes: 0, failures: 0 };
  if (outcome === "success" || outcome === "criticalHit") {
    character.deathSaves.successes = Math.min(3, character.deathSaves.successes + 1);
    if (character.deathSaves.successes >= 3) {
      character.deathSaves = { successes: 0, failures: 0 };
    }
  } else if (outcome === "failure" || outcome === "criticalMiss") {
    character.deathSaves.failures = Math.min(3, character.deathSaves.failures + 1);
    if (character.deathSaves.failures >= 3 && !hasCondition(character, "dead")) {
      character.conditions.push({ name: "dead", source: "failed death saves", appliedAt: new Date() });
    }
  }
}

/** Only spellSlotN resources are mechanically tracked in the MVP; other kinds are logged but not enforced. */
function consumeResource(character: any, kind: string, amount: number) {
  const match = /^spellSlot(\d+)$/.exec(kind);
  if (match && character.spellSlots) {
    const level = match[1];
    const slot = character.spellSlots[level];
    if (slot) slot.current = Math.max(0, slot.current - amount);
  }
}
