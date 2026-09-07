import { useCallback, useEffect, useState } from "react";
import type { Character, RulingResult, Session, SessionEvent } from "@dnd-ai-sim/shared";
import { useAuth } from "./AuthContext";
import { getSocket } from "../api/socket";

export function useLiveSession(sessionId: string | null) {
  const { auth } = useAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !auth) return;
    const socket = getSocket(auth.token);

    function join() {
      socket.emit("session:join", { sessionId }, (res: any) => {
        if (res.ok) {
          setSession(res.session);
          setEvents(res.events);
          setCharacters(res.characters);
          setError(null);
        } else {
          setError(res.error);
        }
      });
    }

    function onConnect() {
      setConnected(true);
      join();
    }
    function onDisconnect() {
      setConnected(false);
    }
    function onSessionUpdate(s: Session) {
      setSession(s);
    }
    function onSessionEvent(e: SessionEvent) {
      setEvents((prev) => [...prev, e]);
    }
    function onCharacterUpdate(c: Character) {
      setCharacters((prev) => prev.map((existing) => (String((existing as any)._id ?? existing.id) === String((c as any)._id ?? c.id) ? c : existing)));
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("session:update", onSessionUpdate);
    socket.on("session:event", onSessionEvent);
    socket.on("character:update", onCharacterUpdate);

    if (socket.connected) onConnect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("session:update", onSessionUpdate);
      socket.off("session:event", onSessionEvent);
      socket.off("character:update", onCharacterUpdate);
    };
  }, [sessionId, auth]);

  const claimCharacter = useCallback(
    (characterId: string) =>
      new Promise<void>((resolve, reject) => {
        if (!auth) return reject(new Error("Not authenticated"));
        getSocket(auth.token).emit("character:claim", { characterId }, (res: any) => {
          if (res.ok) resolve();
          else reject(new Error(res.error));
        });
      }),
    [auth]
  );

  const advanceTurn = useCallback(() => {
    if (!auth || !sessionId) return;
    getSocket(auth.token).emit("turn:advance", { sessionId }, () => {});
  }, [auth, sessionId]);

  const pauseTurn = useCallback(() => {
    if (!auth || !sessionId) return;
    getSocket(auth.token).emit("turn:pause", { sessionId }, () => {});
  }, [auth, sessionId]);

  const resumeTurn = useCallback(() => {
    if (!auth || !sessionId) return;
    getSocket(auth.token).emit("turn:resume", { sessionId }, () => {});
  }, [auth, sessionId]);

  const submitAction = useCallback(
    (actionText: string) =>
      new Promise<{ ruling: RulingResult }>((resolve, reject) => {
        if (!auth || !sessionId) return reject(new Error("Not connected"));
        getSocket(auth.token).emit("action:submit", { sessionId, actionText }, (res: any) => {
          if (res.ok) resolve(res);
          else reject(new Error(res.error));
        });
      }),
    [auth, sessionId]
  );

  const submitRoll = useCallback(
    (rollValue: number, rollType?: string) =>
      new Promise<{ ruling: RulingResult }>((resolve, reject) => {
        if (!auth || !sessionId) return reject(new Error("Not connected"));
        getSocket(auth.token).emit("roll:submit", { sessionId, rollValue, rollType }, (res: any) => {
          if (res.ok) resolve(res);
          else reject(new Error(res.error));
        });
      }),
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
    }) =>
      new Promise<void>((resolve, reject) => {
        if (!auth || !sessionId) return reject(new Error("Not connected"));
        getSocket(auth.token).emit("correction:issue", { sessionId, ...payload }, (res: any) => {
          if (res.ok) resolve();
          else reject(new Error(res.error));
        });
      }),
    [auth, sessionId]
  );

  return {
    session,
    events,
    characters,
    connected,
    error,
    claimCharacter,
    advanceTurn,
    pauseTurn,
    resumeTurn,
    submitAction,
    submitRoll,
    issueCorrection,
  };
}
