import {
  calculateDerivedStats,
  isValidPointBuy,
  rowToCharacter,
  STANDARD_ARRAY,
  type AbilityScoreKey,
  type AbilityScoreMethod,
  type AbilityScores,
  type Character,
  type EquipmentItem,
  type Skill,
} from "@dnd-ai-sim/shared";
import { getServiceClient } from "../supabase.js";

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

/** Level 1 only for this MVP pass -- level-up flow is Phase 3 per the requirements doc. */
export async function createCharacter(input: CreateCharacterInput): Promise<Character> {
  validateAbilityScores(input);

  const derived = calculateDerivedStats({
    className: input.class,
    level: 1,
    abilityScores: input.abilityScores,
    proficientSkills: input.proficientSkills,
    proficientSavingThrows: input.proficientSavingThrows,
    baseArmorClass: input.baseArmorClass,
  });

  const db = getServiceClient();
  const { data, error } = await db
    .from("characters")
    .insert({
      campaign_id: input.campaignId,
      player_id: input.playerId,
      name: input.name,
      race: input.race,
      class: input.class,
      background: input.background,
      level: 1,
      ability_scores: input.abilityScores,
      ability_score_method: input.abilityScoreMethod,
      proficient_skills: input.proficientSkills,
      proficient_saving_throws: input.proficientSavingThrows,
      equipment: input.equipment,
      class_features: input.classFeatures ?? [],
      base_armor_class: input.baseArmorClass ?? 10,
      derived,
      hp_current: derived.hitPointMax,
      hp_max: derived.hitPointMax,
      hp_temp: 0,
      conditions: [],
    })
    .select()
    .single();
  if (error) throw error;
  return rowToCharacter(data);
}

export async function getCharacter(id: string): Promise<Character | null> {
  const db = getServiceClient();
  const { data, error } = await db.from("characters").select().eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToCharacter(data) : null;
}

export async function listCharactersForCampaign(campaignId: string): Promise<Character[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("characters")
    .select()
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToCharacter);
}

export interface CharacterOverrides {
  name?: string;
  equipment?: EquipmentItem[];
  baseArmorClass?: number;
  classFeatures?: string[];
  hitPointsCurrentOverride?: number;
}

/** Editable/overridable fields per requirement 5.1. Recomputes derived stats if AC-affecting fields change. */
export async function updateCharacterOverrides(id: string, overrides: CharacterOverrides): Promise<Character> {
  const db = getServiceClient();
  const { data: row, error: findErr } = await db.from("characters").select().eq("id", id).maybeSingle();
  if (findErr) throw findErr;
  if (!row) throw new CharacterValidationError("Character not found");

  const patch: Record<string, unknown> = {};
  if (overrides.name !== undefined) patch.name = overrides.name;
  if (overrides.equipment !== undefined) patch.equipment = overrides.equipment;
  if (overrides.classFeatures !== undefined) patch.class_features = overrides.classFeatures;
  if (overrides.hitPointsCurrentOverride !== undefined) patch.hp_current = overrides.hitPointsCurrentOverride;

  if (overrides.baseArmorClass !== undefined) {
    patch.base_armor_class = overrides.baseArmorClass;
    patch.derived = calculateDerivedStats({
      className: row.class,
      level: row.level,
      abilityScores: row.ability_scores,
      proficientSkills: row.proficient_skills ?? [],
      proficientSavingThrows: row.proficient_saving_throws ?? [],
      baseArmorClass: overrides.baseArmorClass,
    });
  }

  const { data, error } = await db.from("characters").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return rowToCharacter(data);
}
