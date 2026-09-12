import { useEffect, useRef, useState } from "react";
import type { SessionEvent } from "@dnd-ai-sim/shared";

/**
 * Per-device voice on/off preference, persisted in localStorage.
 * Host and Player use separate keys/defaults: the shared Host screen (TV/
 * iPad) defaults to on -- it's the one "table narrator" voice -- while each
 * player's own phone defaults to off, since 9 phones all reading the same
 * narration aloud at once would be chaos, not immersion.
 */
export function useVoicePreference(storageKey: string, defaultEnabled: boolean): [boolean, (enabled: boolean) => void] {
  const fullKey = `dnd-ai-sim-voice-enabled-${storageKey}`;
  const [enabled, setEnabledState] = useState(() => {
    try {
      const stored = localStorage.getItem(fullKey);
      return stored === null ? defaultEnabled : stored === "true";
    } catch {
      return defaultEnabled;
    }
  });

  function setEnabled(value: boolean) {
    setEnabledState(value);
    try {
      localStorage.setItem(fullKey, String(value));
    } catch {
      // ignore -- private browsing / storage disabled
    }
  }

  return [enabled, setEnabled];
}

// AI DM narration/rulings and admin corrections are worth reading aloud;
// system turn-order chatter and the player's own typed action aren't.
const SPEAKABLE_TYPES = new Set<SessionEvent["type"]>(["narration", "ruling", "correction"]);

export function isSpeechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string) {
  if (!isSpeechSupported() || !text.trim()) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (isSpeechSupported()) window.speechSynthesis.cancel();
}

/**
 * Reads new narration/ruling/correction events aloud as they arrive via
 * Realtime. Never replays the backlog on mount/reconnect -- only events
 * appended after this hook first sees the list get spoken.
 */
export function useSpeakNewEvents(events: SessionEvent[], enabled: boolean) {
  const seenIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      events.forEach((e) => seenIds.current.add(e.id));
      initialized.current = true;
      return;
    }
    for (const event of events) {
      if (seenIds.current.has(event.id)) continue;
      seenIds.current.add(event.id);
      if (enabled && SPEAKABLE_TYPES.has(event.type)) {
        speak(event.text);
      }
    }
  }, [events, enabled]);

  useEffect(() => {
    if (!enabled) stopSpeaking();
  }, [enabled]);
}
