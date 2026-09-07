import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CampaignRecord, Character, Session } from "@dnd-ai-sim/shared";
import { useAuth } from "../state/AuthContext";
import { apiFetch } from "../api/http";

export default function AdminDashboard() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!auth) return;
    apiFetch<CampaignRecord>(`/api/campaigns/${auth.campaign.id}`, { token: auth.token }).then(setCampaign).catch((e) => setError(e.message));
    apiFetch<Character[]>(`/api/characters/campaign/${auth.campaign.id}`, { token: auth.token })
      .then(setCharacters)
      .catch((e) => setError(e.message));
    apiFetch<Session | null>(`/api/sessions/campaign/${auth.campaign.id}/current`, { token: auth.token })
      .then(setCurrentSession)
      .catch(() => {});
  }, [auth]);

  async function startSession() {
    if (!auth) return;
    setStarting(true);
    setError(null);
    try {
      const session = await apiFetch<Session>("/api/sessions", { method: "POST", token: auth.token, body: {} });
      navigate(`/host/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setStarting(false);
    }
  }

  if (!auth || !campaign) return <div className="p-8">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-arcane">{campaign.name}</h1>
          <p className="text-sm text-ink/60">Admin dashboard -- {auth.user.name}</p>
        </div>
        <button onClick={logout} className="text-sm text-ink/50 underline">
          Log out
        </button>
      </div>

      <section className="mb-6 rounded-lg border border-ink/20 bg-white/60 p-4">
        <h2 className="mb-2 font-semibold">Invite codes</h2>
        <p className="text-sm">
          Player code: <code className="font-mono text-arcane">{campaign.playerInviteCode}</code>
        </p>
        <p className="text-sm">
          Admin code: <code className="font-mono text-arcane">{campaign.adminInviteCode}</code>
        </p>
      </section>

      <section className="mb-6 rounded-lg border border-ink/20 bg-white/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Party roster ({characters.length})</h2>
        </div>
        {characters.length === 0 ? (
          <p className="text-sm text-ink/60">No characters yet -- players create theirs from their own device.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {characters.map((c) => (
              <li key={c.id} className="flex justify-between border-b border-ink/10 py-1">
                <span>
                  {c.name} -- Lvl {c.level} {c.race} {c.class}
                </span>
                <span>
                  {c.hitPoints.current}/{c.hitPoints.max} HP
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-ink/20 bg-white/60 p-4">
        <h2 className="mb-3 font-semibold">Live session</h2>
        {currentSession ? (
          <button
            onClick={() => navigate(`/host/${currentSession.id}`)}
            className="rounded bg-arcane px-4 py-2 font-semibold text-white hover:opacity-90"
          >
            Resume session ({currentSession.status})
          </button>
        ) : (
          <button
            onClick={startSession}
            disabled={starting || characters.length === 0}
            className="rounded bg-ember px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {starting ? "Starting..." : "Start new session"}
          </button>
        )}
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </section>
    </div>
  );
}
