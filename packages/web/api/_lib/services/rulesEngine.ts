import { rowToCharacter, type RulingResult, type Character } from "@dnd-ai-sim/shared";
import { getServiceClient } from "../supabase.js";

/**
 * Applies a resolved AI DM ruling to persistent character state. This is the
 * only place HP/conditions/resources actually change -- the AI's output is
 * treated as a proposal until this runs, keeping state authoritative in
 * Postgres rather than "remembered" by the model (requirement 6). The UPDATE
 * itself is what fans out to subscribed clients via Supabase Realtime.
 */
export async function applyRuling(actingCharacterId: string, ruling: RulingResult): Promise<Character> {
  const targetId = ruling.targetCharacterId ?? actingCharacterId;
  const db = getServiceClient();
  const { data: row, error: findErr } = await db.from("characters").select().eq("id", targetId).maybeSingle();
  if (findErr) throw findErr;
  if (!row) throw new Error(`applyRuling: character ${targetId} not found`);

  const wasUp = row.hp_current > 0;
  let hpCurrent = row.hp_current;
  let hpTemp = row.hp_temp;

  if (typeof ruling.hpChange === "number" && ruling.hpChange !== 0) {
    if (ruling.hpChange < 0) {
      let remaining = -ruling.hpChange;
      const tempAbsorbed = Math.min(hpTemp, remaining);
      hpTemp -= tempAbsorbed;
      remaining -= tempAbsorbed;
      hpCurrent = Math.max(0, hpCurrent - remaining);
    } else {
      hpCurrent = Math.min(row.hp_max, hpCurrent + ruling.hpChange);
    }
  }

  const isDown = hpCurrent <= 0;
  let conditions: any[] = row.conditions ?? [];
  let deathSaveSuccesses = row.death_save_successes;
  let deathSaveFailures = row.death_save_failures;

  if (wasUp && isDown) {
    hpCurrent = 0;
    if (!conditions.some((c) => c.name === "unconscious")) {
      conditions = [...conditions, { name: "unconscious", source: "0 HP", appliedAt: new Date().toISOString() }];
    }
    deathSaveSuccesses = 0;
    deathSaveFailures = 0;
  } else if (!wasUp && !isDown) {
    conditions = conditions.filter((c) => c.name !== "unconscious");
    deathSaveSuccesses = 0;
    deathSaveFailures = 0;
  }

  if (ruling.rollType === "deathSave" && ruling.outcome) {
    if (ruling.outcome === "success" || ruling.outcome === "criticalHit") {
      deathSaveSuccesses = Math.min(3, deathSaveSuccesses + 1);
      if (deathSaveSuccesses >= 3) {
        deathSaveSuccesses = 0;
        deathSaveFailures = 0;
      }
    } else if (ruling.outcome === "failure" || ruling.outcome === "criticalMiss") {
      deathSaveFailures = Math.min(3, deathSaveFailures + 1);
      if (deathSaveFailures >= 3 && !conditions.some((c) => c.name === "dead")) {
        conditions = [...conditions, { name: "dead", source: "failed death saves", appliedAt: new Date().toISOString() }];
      }
    }
  }

  for (const added of ruling.conditionsAdded ?? []) {
    if (!conditions.some((c) => c.name === added.name)) {
      conditions = [...conditions, { name: added.name, roundsRemaining: added.roundsRemaining, appliedAt: new Date().toISOString() }];
    }
  }
  for (const removedName of ruling.conditionsRemoved ?? []) {
    conditions = conditions.filter((c) => c.name !== removedName);
  }

  let spellSlots = row.spell_slots;
  for (const resource of ruling.resourcesConsumed ?? []) {
    const match = /^spellSlot(\d+)$/.exec(resource.kind);
    if (match && spellSlots) {
      const level = match[1];
      if (spellSlots[level]) {
        spellSlots = { ...spellSlots, [level]: { ...spellSlots[level], current: Math.max(0, spellSlots[level].current - resource.amount) } };
      }
    }
  }

  const { data, error } = await db
    .from("characters")
    .update({
      hp_current: hpCurrent,
      hp_temp: hpTemp,
      conditions,
      death_save_successes: deathSaveSuccesses,
      death_save_failures: deathSaveFailures,
      spell_slots: spellSlots,
    })
    .eq("id", targetId)
    .select()
    .single();
  if (error) throw error;
  return rowToCharacter(data);
}
