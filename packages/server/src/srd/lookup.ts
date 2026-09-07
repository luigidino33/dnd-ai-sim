import conditions from "./data/conditions.json" with { type: "json" };
import skills from "./data/skills.json" with { type: "json" };
import spells from "./data/spells.json" with { type: "json" };
import monsters from "./data/monsters.json" with { type: "json" };
import coreRules from "./data/coreRules.json" with { type: "json" };

type Entry = { name?: string; rules: string };

const CONDITIONS = conditions as Record<string, Entry>;
const SKILLS = skills as Record<string, Entry & { ability: string }>;
const SPELLS = spells as Record<string, Entry & { name: string; level: number; school: string }>;
const MONSTERS = monsters as Record<string, Entry & { name: string; cr: string; ac: number; hp: number; speed: string }>;
const CORE_RULES = coreRules as Record<string, string>;

function normalize(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findByName<T extends { name?: string }>(table: Record<string, T>, query: string): T | undefined {
  const needle = normalize(query);
  for (const [key, value] of Object.entries(table)) {
    if (normalize(key) === needle || normalize(value.name ?? "") === needle) return value;
  }
  return undefined;
}

export function lookupCondition(name: string) {
  return findByName(CONDITIONS, name);
}

export function lookupSkill(name: string) {
  return findByName(SKILLS, name);
}

export function lookupSpell(name: string) {
  return findByName(SPELLS, name);
}

export function lookupMonster(name: string) {
  return findByName(MONSTERS, name);
}

/**
 * Builds a compact block of SRD rules text relevant to the current turn,
 * to inject into the AI DM's context. Keyword-matches the free-text action
 * against condition/skill/spell/monster names, plus always includes the
 * always-relevant core adjudication rules.
 */
export function buildRulesContext(freeText: string, opts?: { activeConditionNames?: string[] }): string {
  const haystack = freeText.toLowerCase();
  const sections: string[] = [];

  sections.push("## Core Adjudication Rules");
  for (const [key, text] of Object.entries(CORE_RULES)) {
    sections.push(`- ${key}: ${text}`);
  }

  const matchedConditions = new Set(opts?.activeConditionNames ?? []);
  for (const key of Object.keys(CONDITIONS)) {
    if (haystack.includes(key.toLowerCase())) matchedConditions.add(key);
  }
  if (matchedConditions.size > 0) {
    sections.push("\n## Relevant Conditions");
    for (const name of matchedConditions) {
      const entry = lookupCondition(name);
      if (entry) sections.push(`- ${entry.name ?? name}: ${entry.rules}`);
    }
  }

  const matchedSpells = Object.values(SPELLS).filter((s) => haystack.includes(s.name.toLowerCase()));
  if (matchedSpells.length > 0) {
    sections.push("\n## Relevant Spells");
    for (const s of matchedSpells) sections.push(`- ${s.name} (level ${s.level} ${s.school}): ${s.rules}`);
  }

  const matchedMonsters = Object.values(MONSTERS).filter((m) => haystack.includes(m.name.toLowerCase()));
  if (matchedMonsters.length > 0) {
    sections.push("\n## Relevant Monsters");
    for (const m of matchedMonsters) {
      sections.push(`- ${m.name} (CR ${m.cr}, AC ${m.ac}, HP ${m.hp}, Speed ${m.speed}): ${m.rules}`);
    }
  }

  const matchedSkills = Object.entries(SKILLS).filter(([key, s]) => haystack.includes((s.name ?? key).toLowerCase()));
  if (matchedSkills.length > 0) {
    sections.push("\n## Relevant Skills");
    for (const [key, s] of matchedSkills) sections.push(`- ${key} (${s.ability}): ${s.rules}`);
  }

  return sections.join("\n");
}
