import { getServiceClient } from "../supabase.js";
import { rowToEvent, type EventType, type RulingResult, type SessionEvent } from "@dnd-ai-sim/shared";

export interface LogEventInput {
  sessionId: string;
  campaignId: string;
  type: EventType;
  characterId?: string;
  actorLabel?: string;
  text: string;
  rollType?: string;
  rollValue?: number;
  ruling?: RulingResult;
}

export async function logEvent(input: LogEventInput): Promise<SessionEvent> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("event_logs")
    .insert({
      session_id: input.sessionId,
      campaign_id: input.campaignId,
      type: input.type,
      character_id: input.characterId,
      actor_label: input.actorLabel,
      text: input.text,
      roll_type: input.rollType,
      roll_value: input.rollValue,
      ruling: input.ruling,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function logCorrection(input: {
  sessionId: string;
  campaignId: string;
  correctedBy: string;
  originalText: string;
  correctedText: string;
  reason?: string;
}): Promise<SessionEvent> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("event_logs")
    .insert({
      session_id: input.sessionId,
      campaign_id: input.campaignId,
      type: "correction",
      actor_label: input.correctedBy,
      text: `Admin corrected: ${input.correctedText}`,
      correction: {
        correctedBy: input.correctedBy,
        originalText: input.originalText,
        correctedText: input.correctedText,
        reason: input.reason,
      },
    })
    .select()
    .single();
  if (error) throw error;
  return rowToEvent(data);
}

export async function getRecentEvents(sessionId: string, limit = 20): Promise<SessionEvent[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("event_logs")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(rowToEvent).reverse();
}

export async function getAllEvents(sessionId: string): Promise<SessionEvent[]> {
  const db = getServiceClient();
  const { data, error } = await db
    .from("event_logs")
    .select()
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}
