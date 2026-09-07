import { describe, expect, it } from "vitest";
import {
  abilityModifier,
  calculateDerivedStats,
  hitPointMax,
  isValidPointBuy,
  pointBuyTotalCost,
  proficiencyBonusForLevel,
} from "./derivedStats.js";
import type { AbilityScores } from "./types.js";

describe("abilityModifier", () => {
  it("matches the 5e modifier table", () => {
    expect(abilityModifier(8)).toBe(-1);
    expect(abilityModifier(10)).toBe(0);
    expect(abilityModifier(11)).toBe(0);
    expect(abilityModifier(15)).toBe(2);
    expect(abilityModifier(20)).toBe(5);
  });
});

describe("proficiencyBonusForLevel", () => {
  it("steps every 4 levels starting at +2", () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(4)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(9)).toBe(4);
    expect(proficiencyBonusForLevel(17)).toBe(6);
  });
});

describe("hitPointMax", () => {
  it("is hit die max + CON mod at level 1", () => {
    expect(hitPointMax("Fighter", 1, 2)).toBe(10 + 2);
    expect(hitPointMax("Wizard", 1, 0)).toBe(6);
  });

  it("adds the average-progression amount per additional level", () => {
    // Fighter (d10) level 3, +2 CON: 12 + 2*(6+2) = 12 + 16 = 28
    expect(hitPointMax("Fighter", 3, 2)).toBe(28);
  });
});

describe("point buy", () => {
  const scores: AbilityScores = {
    strength: 15,
    dexterity: 14,
    constitution: 13,
    intelligence: 12,
    wisdom: 10,
    charisma: 8,
  };

  it("costs exactly the standard 27-point spread", () => {
    expect(pointBuyTotalCost(scores)).toBe(27);
    expect(isValidPointBuy(scores)).toBe(true);
  });

  it("rejects scores over budget or out of range", () => {
    expect(isValidPointBuy({ ...scores, strength: 16 })).toBe(false);
    expect(isValidPointBuy({ ...scores, charisma: 7 })).toBe(false);
  });
});

describe("calculateDerivedStats", () => {
  const stats = calculateDerivedStats({
    className: "Fighter",
    level: 1,
    abilityScores: {
      strength: 16,
      dexterity: 14,
      constitution: 14,
      intelligence: 10,
      wisdom: 12,
      charisma: 8,
    },
    proficientSkills: ["athletics", "perception"],
    proficientSavingThrows: ["strength", "constitution"],
  });

  it("computes AC from unarmored base + DEX", () => {
    expect(stats.armorClass).toBe(10 + 2);
  });

  it("computes HP from class hit die + CON", () => {
    expect(stats.hitPointMax).toBe(10 + 2);
  });

  it("applies proficiency only to proficient saves/skills", () => {
    expect(stats.savingThrows.strength).toEqual({ proficient: true, bonus: 3 + 2 });
    expect(stats.savingThrows.dexterity).toEqual({ proficient: false, bonus: 2 });
    expect(stats.skillBonuses.athletics).toEqual({ proficient: true, bonus: 3 + 2 });
    expect(stats.skillBonuses.stealth).toEqual({ proficient: false, bonus: 2 });
  });

  it("derives passive perception from the perception skill bonus", () => {
    expect(stats.passivePerception).toBe(10 + stats.skillBonuses.perception.bonus);
  });

  it("derives initiative from DEX modifier", () => {
    expect(stats.initiativeBonus).toBe(2);
  });
});
