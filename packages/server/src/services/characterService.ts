import {
  calculateDerivedStats,
  isValidPointBuy,
  STANDARD_ARRAY,
  type AbilityScoreKey,
  type AbilityScoreMethod,
  type AbilityScores,
  type EquipmentItem,
  type Skill,
} from "@dnd-ai-sim/shared";
import { CharacterModel } from "../db/models/Character.js";

export interface CreateCharacterInput {
  campaignId: string;
  playerId: string;
  name: string;
  race: string;
  class: string;
  background: string;
  abilityScores: AbilityScores;
  abilityScoreMethod: AbilityScoreMethod;
  proficientSkills: Skill[];
  proficientSavingThrows: AbilityScoreKey[];
  equipment: EquipmentItem[];
  classFeatures?: string[];
  baseArmorClass?: number;
}

export class CharacterValidationError extends Error {}

function validateAbilityScores(input: CreateCharacterInput) {
  if (input.abilityScoreMethod === "pointBuy" && !isValidPointBuy(input.abilityScores)) {
    throw new CharacterValidationError("Ability scores exceed the 27-point buy budget or are out of range (8-15).");
  }
  if (input.abilityScoreMethod === "standardArray") {
    const values = Object.values(input.abilityScores).slice().sort((a, b) => b - a);
    const expected = [...STANDARD_ARRAY].sort((a, b) => b - a);
    if (JSON.stringify(values) !== JSON.stringify(expected)) {
      throw new CharacterValidationError(`Standard array must use exactly [${STANDARD_ARRAY.join(", ")}].`);
    }
  }
  // "manual" (physical dice) is intentionally unconstrained.
}

/** Level 1 only for this MVP pass — level-up flow is Phase 3 per the requirements doc. */
export async function createCharacter(input: CreateCharacterInput) {
  validateAbilityScores(input);

  const derived = calculateDerivedStats({
    className: input.class,
    level: 1,
    abilityScores: input.abilityScores,
    proficientSkills: input.proficientSkills,
    proficientSavingThrows: input.proficientSavingThrows,
    baseArmorClass: input.baseArmorClass,
  });

  const character = await CharacterModel.create({
    campaignId: input.campaignId,
    playerId: input.playerId,
    name: input.name,
    race: input.race,
    class: input.class,
    background: input.background,
    level: 1,
    abilityScores: input.abilityScores,
    abilityScoreMethod: input.abilityScoreMethod,
    proficientSkills: input.proficientSkills,
    proficientSavingThrows: input.proficientSavingThrows,
    equipment: input.equipment,
    classFeatures: input.classFeatures ?? [],
    baseArmorClass: input.baseArmorClass ?? 10,
    derived,
    hitPoints: { current: derived.hitPointMax, max: derived.hitPointMax, temp: 0 },
    conditions: [],
  });

  return character;
}

export async function getCharacter(id: string) {
  return CharacterModel.findById(id);
}

export async function listCharactersForCampaign(campaignId: string) {
  return CharacterModel.find({ campaignId }).sort({ createdAt: 1 });
}

export interface CharacterOverrides {
  name?: string;
  equipment?: EquipmentItem[];
  baseArmorClass?: number;
  classFeatures?: string[];
  hitPointsCurrentOverride?: number;
}

/** Editable/overridable fields per requirement 5.1. Recomputes derived stats if AC-affecting fields change. */
export async function updateCharacterOverrides(id: string, overrides: CharacterOverrides) {
  const character = await CharacterModel.findById(id);
  if (!character) throw new CharacterValidationError("Character not found");

  if (overrides.name !== undefined) character.name = overrides.name;
  if (overrides.equipment !== undefined) character.equipment = overrides.equipment as any;
  if (overrides.classFeatures !== undefined) character.classFeatures = overrides.classFeatures;
  if (overrides.hitPointsCurrentOverride !== undefined) {
    character.hitPoints!.current = overrides.hitPointsCurrentOverride;
  }

  if (overrides.baseArmorClass !== undefined) {
    character.baseArmorClass = overrides.baseArmorClass;
    const derived = calculateDerivedStats({
      className: character.class,
      level: character.level,
      abilityScores: character.abilityScores as unknown as AbilityScores,
      proficientSkills: character.proficientSkills as Skill[],
      proficientSavingThrows: character.proficientSavingThrows as AbilityScoreKey[],
      baseArmorClass: overrides.baseArmorClass,
    });
    character.derived = derived as any;
  }

  await character.save();
  return character;
}
