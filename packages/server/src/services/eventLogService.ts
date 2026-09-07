import { EventLogModel } from "../db/models/EventLog.js";
import type { EventType, RulingResult } from "@dnd-ai-sim/shared";

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

export async function logEvent(input: LogEventInput) {
  return EventLogModel.create(input);
}

export async function logCorrection(input: {
  sessionId: string;
  campaignId: string;
  correctedBy: string;
  originalText: string;
  correctedText: string;
  reason?: string;
}) {
  return EventLogModel.create({
    sessionId: input.sessionId,
    campaignId: input.campaignId,
    type: "correction",
    actorLabel: input.correctedBy,
    text: `Admin corrected: ${input.correctedText}`,
    correction: {
      correctedBy: input.correctedBy,
      originalText: input.originalText,
      correctedText: input.correctedText,
      reason: input.reason,
    },
  });
}

/** Recent log window for a session, oldest-first, for both AI context and client history. */
export async function getRecentEvents(sessionId: string, limit = 20) {
  const events = await EventLogModel.find({ sessionId }).sort({ createdAt: -1 }).limit(limit);
  return events.reverse();
}

export async function getAllEvents(sessionId: string) {
  return EventLogModel.find({ sessionId }).sort({ createdAt: 1 });
}
