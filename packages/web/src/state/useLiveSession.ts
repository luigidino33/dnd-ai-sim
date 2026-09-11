import { useCallback, useEffect, useState } from "react";
import {
  rowToCharacter,
  rowToEvent,
  rowToSession,
  type Character,
  type Session,
  type SessionEvent,
} from "@dnd-ai-sim/shared";
import { useAuth } from "./AuthContext";
import { apiFetch } from "../api/http";
import { getSupabaseClient } from "../api/realtime";

/**
 * Live session state comes from two sources: an initial REST fetch, then
 * Supabase Realtime (`postgres_changes`) pushes every subsequent DB write --
 * there's no explicit "broadcast" step in the API handlers, the UPDATE/INSERT
 * itself is what reaches every subscribed client.
 */
export function useLiveSession(sessionId: string | null) {
  const { auth } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !auth) return;
    let cancelled = false;
    Promise.all([
      apiFetch<Session>(`/api/sessions/${sessionId}`, { token: auth.token }),
      apiFetch<SessionEvent[]>(`/api/sessions/${sessionId}?include=events`, { token: auth.token }),
      apiFetch<Character[]>(`/api/characters?campaignId=${auth.campaign.id}`, { token: auth.token }),
    ])
      .then(([s, e, c]) => {
        if (cancelled) return;
        setSession(s);
        setEvents(e);
        setCharacters(c);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Failed to load session"));
    return () => {
      cancelled = true;
    };
  }, [sessionId, auth]);

  useEffect(() => {
    if (!sessionId || !auth) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`session-data:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(rowToSession(payload.new))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_logs", filter: `session_id=eq.${sessionId}` },
        (payload) => setEvents((prev) => [...prev, rowToEvent(payload.new)])
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "characters", filter: `campaign_id=eq.${auth.campaign.id}` },
        (payload) => {
          const updated = rowToCharacter(payload.new);
          setCharacters((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        }
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, auth]);

  // Presence (requirement 6 graceful degradation): every client tracks itself
  // on a presence channel and watches for the Admin's entry disappearing --
  // there's no long-lived server process left to notice a socket drop, so any
  // connected client that observes the change reports it (idempotent server-side).
  useEffect(() => {
    if (!sessionId || !auth) return;
    const supabase = getSupabaseClient();
    const presenceChannel = supabase.channel(`presence:${sessionId}`, {
      config: { presence: { key: auth.user.id } },
    });
    let adminWasPresent = false;

    function checkAdminPresence() {
      const state = presenceChannel.presenceState();
      const adminPresent = Object.values(state).some((entries) =>
        (entries as any[]).some((e) => e.isAdmin)
      );
      if (adminPresent !== adminWasPresent) {
        adminWasPresent = adminPresent;
        apiFetch("/api/presence/report", {
          method: "POST",
          token: auth!.token,
          body: { sessionId, event: adminPresent ? "admin-joined" : "admin-left" },
        }).catch(() => {});
      }
    }

    presenceChannel.on("presence", { event: "sync" }, checkAdminPresence).subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await presenceChannel.track({ isAdmin: auth.user.isAdmin, name: auth.user.name });
      }
    });

    return () => {
      void supabase.removeChannel(presenceChannel);
    };
  }, [sessionId, auth]);

  const advanceTurn = useCallback(() => {
    if (!auth || !sessionId) return Promise.resolve();
    return apiFetch("/api/turn/advance", { method: "POST", token: auth.token, body: { sessionId } });
  }, [auth, sessionId]);

  const pauseTurn = useCallback(() => {
    if (!auth || !sessionId) return Promise.resolve();
    return apiFetch("/api/turn/pause", { method: "POST", token: auth.token, body: { sessionId } });
  }, [auth, sessionId]);

  const resumeTurn = useCallback(() => {
    if (!auth || !sessionId) return Promise.resolve();
    return apiFetch("/api/turn/resume", { method: "POST", token: auth.token, body: { sessionId } });
  }, [auth, sessionId]);

  const submitAction = useCallback(
    (characterId: string, actionText: string) => {
      if (!auth || !sessionId) return Promise.reject(new Error("Not connected"));
      return apiFetch("/api/turn/action", { method: "POST", token: auth.token, body: { sessionId, characterId, actionText } });
    },
    [auth, sessionId]
  );

  const submitRoll = useCallback(
    (characterId: string, rollValue: number, rollType?: string) => {
      if (!auth || !sessionId) return Promise.reject(new Error("Not connected"));
      return apiFetch("/api/turn/roll", { method: "POST", token: auth.token, body: { sessionId, characterId, rollValue, rollType } });
    },
    [auth, sessionId]
  );

  const issueCorrection = useCallback(
    (payload: {
      originalText: string;
      correctedText: string;
      reason?: string;
      characterId?: string;
      hpChange?: number;
      conditionsAdded?: { name: string; roundsRemaining?: number }[];
      conditionsRemoved?: string[];
    }) => {
      if (!auth || !sessionId) return Promise.reject(new Error("Not connected"));
      return apiFetch("/api/turn/correction", { method: "POST", token: auth.token, body: { sessionId, ...payload } });
    },
    [auth, sessionId]
  );

  return {
    session,
    events,
    characters,
    connected,
    error,
    advanceTurn,
    pauseTurn,
    resumeTurn,
    submitAction,
    submitRoll,
    issueCorrection,
  };
}
