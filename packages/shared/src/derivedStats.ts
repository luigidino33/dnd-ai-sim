// Pure D&D 5e derived-stat calculations. No I/O, no framework deps —
// used identically by the server (character creation/level-up) and the
// web character builder (live preview as the player fills the form).

import {
  ABILITY_SCORE_KEYS,
  SKILLS,
  SKILL_ABILITY,
  type AbilityScoreKey,
  type AbilityScores,
  type DerivedStats,
  type Skill,
} from "./types.js";

export const CLASS_HIT_DICE: Record<string, number> = {
  Barbarian: 12,
  Fighter: 10,
  Paladin: 10,
  Ranger: 10,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Monk: 8,
  Rogue: 8,
  Warlock: 8,
  Sorcerer: 6,
  Wizard: 6,
};

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function abilityModifiers(scores: AbilityScores): Record<AbilityScoreKey, number> {
  const result = {} as Record<AbilityScoreKey, number>;
  for (const key of ABILITY_SCORE_KEYS) {
    result[key] = abilityModifier(scores[key]);
  }
  return result;
}

export function proficiencyBonusForLevel(level: number): number {
  if (level < 1) throw new Error("level must be >= 1");
  return 2 + Math.floor((level - 1) / 4);
}

/**
 * 5e level-1 HP = hit die max + CON modifier. Levels beyond 1 use the
 * fixed "average" progression (hit die average, rounded up, + 1) per level,
 * since this app doesn't do manual per-level hit-die rolling.
 */
export function hitPointMax(className: string, level: number, conModifier: number): number {
  const hitDie = CLASS_HIT_DICE[className] ?? 8;
  const firstLevel = hitDie + conModifier;
  const perAdditionalLevel = Math.ceil(hitDie / 2) + 1 + conModifier;
  return firstLevel + Math.max(0, level - 1) * perAdditionalLevel;
}

export interface DerivedStatsInput {
  className: string;
  level: number;
  abilityScores: AbilityScores;
  proficientSkills: Skill[];
  proficientSavingThrows: AbilityScoreKey[];
  /** Base armor class before this calculation (e.g. from worn armor). Defaults to unarmored (10). */
  baseArmorClass?: number;
}

export function calculateDerivedStats(input: DerivedStatsInput): DerivedStats {
  const mods = abilityModifiers(input.abilityScores);
  const proficiencyBonus = proficiencyBonusForLevel(input.level);

  const savingThrows = {} as DerivedStats["savingThrows"];
  for (const key of ABILITY_SCORE_KEYS) {
    const proficient = input.proficientSavingThrows.includes(key);
    savingThrows[key] = {
      proficient,
      bonus: mods[key] + (proficient ? proficiencyBonus : 0),
    };
  }

  const skillBonuses = {} as DerivedStats["skillBonuses"];
  for (const skill of SKILLS) {
    const proficient = input.proficientSkills.includes(skill);
    const ability = SKILL_ABILITY[skill];
    skillBonuses[skill] = {
      proficient,
      bonus: mods[ability] + (proficient ? proficiencyBonus : 0),
    };
  }

  const armorClass = (input.baseArmorClass ?? 10) + mods.dexterity;

  return {
    abilityModifiers: mods,
    proficiencyBonus,
    armorClass,
    hitPointMax: hitPointMax(input.className, input.level, mods.constitution),
    initiativeBonus: mods.dexterity,
    passivePerception: 10 + skillBonuses.perception.bonus,
    savingThrows,
    skillBonuses,
  };
}

// --- Ability score generation methods (Section 5.1) ---

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8] as const;

export const POINT_BUY_BUDGET = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

/** Cost table for the standard 5e point-buy system. */
export function pointBuyCost(score: number): number {
  const costs: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
  if (!(score in costs)) throw new Error(`invalid point-buy score: ${score}`);
  return costs[score];
}

export function pointBuyTotalCost(scores: AbilityScores): number {
  return ABILITY_SCORE_KEYS.reduce((sum, key) => sum + pointBuyCost(scores[key]), 0);
}

export function isValidPointBuy(scores: AbilityScores): boolean {
  return (
    ABILITY_SCORE_KEYS.every((key) => scores[key] >= POINT_BUY_MIN && scores[key] <= POINT_BUY_MAX) &&
    pointBuyTotalCost(scores) <= POINT_BUY_BUDGET
  );
}
