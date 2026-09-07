import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLiveSession } from "../../state/useLiveSession";
import CorrectionPanel from "./CorrectionPanel";

export default function HostView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, events, characters, connected, advanceTurn, pauseTurn, resumeTurn, issueCorrection } = useLiveSession(
    sessionId ?? null
  );

  const activeCharacterId = useMemo(() => {
    if (!session || session.currentTurnIndex < 0) return null;
    return session.turnQueue[session.currentTurnIndex]?.characterId ?? null;
  }, [session]);

  const lastRuling = [...events].reverse().find((e) => e.type === "ruling");

  function charName(id?: string | null) {
    return characters.find((c) => c.id === id)?.name ?? "Unknown";
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-2xl text-ink/60">
        Connecting to session...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink text-parchment">
      <header className="flex items-center justify-between border-b border-parchment/20 px-8 py-4">
        <h1 className="text-3xl font-bold">Round {session.round}</h1>
        <div className="flex items-center gap-4">
          <span className={`h-3 w-3 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} title={connected ? "Connected" : "Disconnected"} />
          <span className="text-lg">
            {session.status === "paused" ? `⏸ Paused${session.pauseReason === "disconnect" ? " (connection lost)" : ""}` : "▶ Live"}
          </span>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-3 gap-6 p-8">
        <aside className="col-span-1">
          <h2 className="mb-3 text-xl font-semibold">Turn Queue</h2>
          <ol className="space-y-2">
            {session.turnQueue.map((entry, i) => {
              const isActive = i === session.currentTurnIndex;
              return (
                <li
                  key={entry.characterId}
                  className={`rounded-lg px-4 py-3 text-xl ${isActive ? "bg-ember font-bold text-white" : "bg-parchment/10"}`}
                >
                  {charName(entry.characterId)}
                  {entry.hasActedThisRound && !isActive && <span className="ml-2 text-sm text-parchment/50">(acted)</span>}
                </li>
              );
            })}
          </ol>

          <div className="mt-6 space-y-2">
            <button
              onClick={advanceTurn}
              className="w-full rounded bg-ember px-4 py-3 text-lg font-semibold text-white hover:opacity-90"
            >
              Advance Turn ➜
            </button>
            {session.status === "paused" ? (
              <button onClick={resumeTurn} className="w-full rounded bg-green-700 px-4 py-3 text-lg font-semibold text-white hover:opacity-90">
                Resume
              </button>
            ) : (
              <button onClick={pauseTurn} className="w-full rounded bg-parchment/20 px-4 py-3 text-lg font-semibold hover:bg-parchment/30">
                Pause
              </button>
            )}
          </div>

          {lastRuling && (
            <CorrectionPanel
              key={lastRuling.id}
              event={lastRuling}
              onSubmit={async (payload) => {
                await issueCorrection(payload);
              }}
            />
          )}
        </aside>

        <main className="col-span-2 flex flex-col">
          <h2 className="mb-3 text-xl font-semibold">
            {activeCharacterId ? `${charName(activeCharacterId)}'s turn` : "Waiting to begin"}
            {session.pendingRoll && (
              <span className="ml-3 text-lg font-normal text-ember">-- awaiting roll: {session.pendingRoll.rollPrompt}</span>
            )}
          </h2>
          <div className="flex-1 space-y-3 overflow-y-auto rounded-lg bg-parchment/5 p-4 text-xl leading-relaxed">
            {events.map((e) => (
              <p key={e.id} className={e.type === "correction" ? "text-yellow-300" : e.type === "system" ? "text-parchment/50 text-base" : ""}>
                {e.type !== "system" && <span className="font-semibold">{e.actorLabel ?? e.type}: </span>}
                {e.text}
              </p>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
