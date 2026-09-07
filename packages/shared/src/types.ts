// Shared domain types used by both the API functions and the web app.
// These describe the camelCase shape of data as it crosses the API boundary --
// see dbMappers.ts for how Postgres rows (snake_case columns) map onto these.

export const ABILITY_SCORE_KEYS = [
  "strength",
  "dexterity",
  "constitution",
  "intelligence",
  "wisdom",
  "charisma",
] as const;
export type AbilityScoreKey = (typeof ABILITY_SCORE_KEYS)[number];

export type AbilityScores = Record<AbilityScoreKey, number>;

export const SKILLS = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_ABILITY: Record<Skill, AbilityScoreKey> = {
  acrobatics: "dexterity",
  animalHandling: "wisdom",
  arcana: "intelligence",
  athletics: "strength",
  deception: "charisma",
  history: "intelligence",
  insight: "wisdom",
  intimidation: "charisma",
  investigation: "intelligence",
  medicine: "wisdom",
  nature: "intelligence",
  perception: "wisdom",
  performance: "charisma",
  persuasion: "charisma",
  religion: "intelligence",
  sleightOfHand: "dexterity",
  stealth: "dexterity",
  survival: "wisdom",
};

export type AbilityScoreMethod = "pointBuy" | "standardArray" | "manual";

export interface EquipmentItem {
  name: string;
  quantity: number;
  notes?: string;
}

export interface SpellSlots {
  // slot level (1-9) -> { max, current }
  [level: number]: { max: number; current: number };
}

export interface ActiveCondition {
  name: string; // e.g. "poisoned", "prone", "stunned"
  source?: string; // what applied it
  roundsRemaining?: number; // undefined = indefinite/until cured
  appliedAt: string; // ISO timestamp
}

export interface DerivedStats {
  abilityModifiers: Record<AbilityScoreKey, number>;
  proficiencyBonus: number;
  armorClass: number;
  hitPointMax: number;
  initiativeBonus: number;
  passivePerception: number;
  savingThrows: Record<AbilityScoreKey, { bonus: number; proficient: boolean }>;
  skillBonuses: Record<Skill, { bonus: number; proficient: boolean }>;
}

export interface Character {
  id: string;
  campaignId: string;
  playerId: string;
  name: string;
  race: string;
  class: string;
  background: string;
  level: number;
  abilityScores: AbilityScores;
  abilityScoreMethod: AbilityScoreMethod;
  proficientSkills: Skill[];
  proficientSavingThrows: AbilityScoreKey[];
  equipment: EquipmentItem[];
  classFeatures: string[];
  spellSlots?: SpellSlots;
  derived: DerivedStats;
  hitPoints: { current: number; max: number; temp: number };
  conditions: ActiveCondition[];
  deathSaves?: { successes: number; failures: number };
  createdAt: string;
  updatedAt: string;
}

export interface WorldBible {
  locations: { name: string; description: string }[];
  factions: { name: string; description: string }[];
  plotThreads: { name: string; status: string; description: string }[];
}

export interface Campaign {
  id: string;
  name: string;
  inviteCode: string;
  dmTone: string; // e.g. "grim", "comedic", "high fantasy"
  worldBible: WorldBible;
  createdAt: string;
}

export type SessionStatus = "active" | "paused" | "ended";

export interface TurnQueueEntry {
  characterId: string;
  hasActedThisRound: boolean;
}

export interface Session {
  id: string;
  campaignId: string;
  status: SessionStatus;
  pauseReason?: "admin" | "disconnect";
  turnQueue: TurnQueueEntry[];
  currentTurnIndex: number; // index into turnQueue, -1 if none active
  round: number;
  /** Set once the AI DM asks for a roll on the active turn, cleared once resolved. */
  pendingRoll?: { rollType: string; rollPrompt: string };
  /** The action text that triggered pendingRoll, replayed once the roll comes in. */
  pendingActionText?: string;
  createdAt: string;
  updatedAt: string;
}

export type EventType =
  | "narration"
  | "player_action"
  | "roll_submitted"
  | "ruling"
  | "correction"
  | "system";

export interface SessionEvent {
  id: string;
  sessionId: string;
  campaignId: string;
  type: EventType;
  characterId?: string;
  actorLabel?: string; // "AI DM", player name, or admin name
  text: string;
  rollType?: string;
  rollValue?: number;
  ruling?: RulingResult;
  correction?: {
    correctedBy: string;
    originalText: string;
    correctedText: string;
    reason?: string;
  };
  createdAt: string;
}

// --- AI DM structured ruling output (see rulingSchema.ts for the tool schema) ---

export type RollType =
  | "attack"
  | "savingThrow"
  | "skillCheck"
  | "abilityCheck"
  | "deathSave"
  | "none";

export interface RulingResult {
  narration: string;
  requiresRoll: boolean;
  rollType?: RollType;
  rollPrompt?: string; // what to roll, e.g. "Dexterity saving throw"
  outcome?: "success" | "failure" | "hit" | "miss" | "criticalHit" | "criticalMiss" | "partial";
  targetCharacterId?: string; // who the mechanical effects apply to (defaults to acting character)
  hpChange?: number; // negative = damage, positive = healing
  conditionsAdded?: { name: string; roundsRemaining?: number }[];
  conditionsRemoved?: string[];
  resourcesConsumed?: { kind: string; amount: number }[]; // e.g. spell slot, ki point
}
