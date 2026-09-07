// Maps Postgres rows (snake_case columns) to the camelCase shapes in
// types.ts. jsonb columns (ability_scores, derived, equipment, conditions,
// turn_queue, pending_roll, ruling, correction, world_bible) already store
// camelCase keys matching the shared types directly -- only the outer
// column names need converting. Pure, DB-client-agnostic, so both the
// serverless API handlers and the browser (reading raw Realtime payloads)
// can use the same mapping.
import type { Character, Session, SessionEvent } from "./types.js";

export function rowToCharacter(row: any): Character {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    playerId: row.player_id,
    name: row.name,
    race: row.race,
    class: row.class,
    background: row.background,
    level: row.level,
    abilityScores: row.ability_scores,
    abilityScoreMethod: row.ability_score_method,
    proficientSkills: row.proficient_skills ?? [],
    proficientSavingThrows: row.proficient_saving_throws ?? [],
    equipment: row.equipment ?? [],
    classFeatures: row.class_features ?? [],
    spellSlots: row.spell_slots ?? undefined,
    derived: row.derived,
    hitPoints: { current: row.hp_current, max: row.hp_max, temp: row.hp_temp },
    conditions: row.conditions ?? [],
    deathSaves: { successes: row.death_save_successes, failures: row.death_save_failures },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToSession(row: any): Session {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    status: row.status,
    pauseReason: row.pause_reason ?? undefined,
    turnQueue: row.turn_queue ?? [],
    currentTurnIndex: row.current_turn_index,
    round: row.round,
    pendingRoll: row.pending_roll ?? undefined,
    pendingActionText: row.pending_action_text ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToEvent(row: any): SessionEvent {
  return {
    id: row.id,
    sessionId: row.session_id,
    campaignId: row.campaign_id,
    type: row.type,
    characterId: row.character_id ?? undefined,
    actorLabel: row.actor_label ?? undefined,
    text: row.text,
    rollType: row.roll_type ?? undefined,
    rollValue: row.roll_value ?? undefined,
    ruling: row.ruling ?? undefined,
    correction: row.correction ?? undefined,
    createdAt: row.created_at,
  };
}

export interface CampaignRecord {
  id: string;
  name: string;
  playerInviteCode: string;
  adminInviteCode: string;
  dmTone: string;
  worldBible: { locations: any[]; factions: any[]; plotThreads: any[] };
  createdAt: string;
}

export function rowToCampaign(row: any): CampaignRecord {
  return {
    id: row.id,
    name: row.name,
    playerInviteCode: row.player_invite_code,
    adminInviteCode: row.admin_invite_code,
    dmTone: row.dm_tone,
    worldBible: row.world_bible ?? { locations: [], factions: [], plotThreads: [] },
    createdAt: row.created_at,
  };
}
