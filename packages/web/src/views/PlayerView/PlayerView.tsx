import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveSession } from "../../state/useLiveSession";

export default function PlayerView() {
  const { sessionId, characterId } = useParams<{ sessionId: string; characterId: string }>();
  const { session, events, characters, connected, submitAction, submitRoll } = useLiveSession(sessionId ?? null);

  const [actionText, setActionText] = useState("");
  const [rollValue, setRollValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrivate, setShowPrivate] = useState(false);

  const character = characters.find((c) => c.id === characterId);

  const isMyTurn = useMemo(() => {
    if (!session || session.currentTurnIndex < 0) return false;
    return session.turnQueue[session.currentTurnIndex]?.characterId === characterId;
  }, [session, characterId]);

  const recentNarration = [...events].reverse().find((e) => e.type === "ruling" || e.type === "system");

  async function handleSubmitAction() {
    if (!actionText.trim() || !characterId) return;
    setBusy(true);
    setError(null);
    try {
      await submitAction(characterId, actionText.trim());
      setActionText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit action");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmitRoll() {
    if (!rollValue || !characterId) return;
    setBusy(true);
    setError(null);
    try {
      await submitRoll(characterId, Number(rollValue), session?.pendingRoll?.rollType);
      setRollValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit roll");
    } finally {
      setBusy(false);
    }
  }

  if (!session || !character) {
    return <div className="flex min-h-screen items-center justify-center text-lg text-ink/60">Connecting...</div>;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col p-4">
      <header className="mb-4">
        <h1 className="text-xl font-bold text-arcane">{character.name}</h1>
        <p className="text-sm text-ink/60">
          {character.race} {character.class} -- Level {character.level}
        </p>
        <div className="mt-2 flex gap-4 text-sm">
          <span>
            HP {character.hitPoints.current}/{character.hitPoints.max}
          </span>
          <span>AC {character.derived.armorClass}</span>
          {character.conditions.length > 0 && (
            <span className="text-ember">{character.conditions.map((c) => c.name).join(", ")}</span>
          )}
        </div>
        {!connected && <p className="mt-1 text-xs text-red-600">Reconnecting...</p>}
      </header>

      {recentNarration && (
        <div className="mb-4 rounded-lg bg-white/70 p-3 text-sm italic">
          {recentNarration.actorLabel && <span className="font-semibold not-italic">{recentNarration.actorLabel}: </span>}
          {recentNarration.text}
        </div>
      )}

      {session.status === "paused" ? (
        <p className="rounded-lg bg-ink/10 p-4 text-center text-sm">
          Session is paused{session.pauseReason === "disconnect" ? " -- reconnecting..." : " by the Admin"}.
        </p>
      ) : !isMyTurn ? (
        <p className="rounded-lg bg-ink/10 p-4 text-center text-sm">Waiting for your turn...</p>
      ) : session.pendingRoll ? (
        <div className="rounded-lg border-2 border-ember bg-white/70 p-4">
          <p className="mb-2 text-sm font-semibold">Roll requested: {session.pendingRoll.rollPrompt}</p>
          <input
            type="number"
            className="input"
            value={rollValue}
            onChange={(e) => setRollValue(e.target.value)}
            placeholder="Enter what you rolled"
          />
          <button
            disabled={busy || !rollValue}
            onClick={handleSubmitRoll}
            className="mt-2 w-full rounded bg-ember px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            Submit roll
          </button>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-arcane bg-white/70 p-4">
          <p className="mb-2 text-sm font-semibold">It's your turn -- what do you do?</p>
          <textarea
            className="input"
            rows={3}
            value={actionText}
            onChange={(e) => setActionText(e.target.value)}
            placeholder="Describe your action..."
          />
          <button
            disabled={busy || !actionText.trim()}
            onClick={handleSubmitAction}
            className="mt-2 w-full rounded bg-arcane px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending..." : "Submit action"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <button onClick={() => setShowPrivate((v) => !v)} className="mt-6 text-sm text-arcane underline">
        {showPrivate ? "Hide" : "Show"} inventory & details
      </button>
      {showPrivate && (
        <div className="mt-2 space-y-2 rounded-lg bg-white/50 p-3 text-sm">
          <p className="font-semibold">Equipment</p>
          <ul className="list-inside list-disc">
            {character.equipment.map((item, i) => (
              <li key={i}>
                {item.name} x{item.quantity}
              </li>
            ))}
          </ul>
          {character.spellSlots && (
            <>
              <p className="mt-2 font-semibold">Spell slots</p>
              {Object.entries(character.spellSlots).map(([level, slot]) => (
                <p key={level}>
                  Level {level}: {slot.current}/{slot.max}
                </p>
              ))}
            </>
          )}
          <p className="mt-2 font-semibold">Saving throws</p>
          {Object.entries(character.derived.savingThrows).map(([key, val]) => (
            <p key={key}>
              {key}: {val.bonus >= 0 ? "+" : ""}
              {val.bonus}
              {val.proficient ? " (proficient)" : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
