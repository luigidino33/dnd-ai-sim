import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { apiFetch } from "../api/http";
import type { Character } from "@dnd-ai-sim/shared";

interface SessionDoc {
  _id: string;
  status: string;
}

export default function PlayerHome() {
  const { auth, logout } = useAuth();
  const navigate = useNavigate();
  const [characters, setCharacters] = useState<(Character & { _id: string })[]>([]);
  const [session, setSession] = useState<SessionDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) return;
    apiFetch<(Character & { _id: string })[]>(`/api/characters/campaign/${auth.campaign.id}`, { token: auth.token })
      .then((chars) => setCharacters(chars.filter((c: any) => String(c.playerId) === auth.user.id)))
      .finally(() => setLoading(false));
  }, [auth]);

  // Poll for a live session starting -- this screen has no open socket to be pushed to,
  // so a short poll is how "the Admin just started a session" reaches a waiting player.
  useEffect(() => {
    if (!auth) return;
    let cancelled = false;
    const check = () =>
      apiFetch<SessionDoc | null>(`/api/sessions/campaign/${auth.campaign.id}/current`, { token: auth.token }).then(
        (sess) => {
          if (!cancelled) setSession(sess);
        }
      );
    check();
    const interval = setInterval(check, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [auth]);

  if (!auth) return null;

  return (
    <div className="mx-auto max-w-lg p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-arcane">{auth.campaign.name}</h1>
          <p className="text-sm text-ink/60">Welcome, {auth.user.name}</p>
        </div>
        <button onClick={logout} className="text-sm text-ink/50 underline">
          Log out
        </button>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <section className="mb-6 space-y-3">
            {characters.map((c) => (
              <div key={c._id} className="rounded-lg border border-ink/20 bg-white/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-ink/60">
                      Level {c.level} {c.race} {c.class}
                    </p>
                  </div>
                  <p className="text-sm">
                    {c.hitPoints.current}/{c.hitPoints.max} HP
                  </p>
                </div>
                {session ? (
                  <button
                    onClick={() => navigate(`/session/${session._id}/character/${c._id}`)}
                    className="w-full rounded bg-ember px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Join live session
                  </button>
                ) : (
                  <p className="text-sm italic text-ink/50">Waiting for the Admin to start a session...</p>
                )}
              </div>
            ))}
          </section>

          <button
            onClick={() => navigate("/characters/new")}
            className="w-full rounded border-2 border-dashed border-arcane/40 px-4 py-3 text-sm font-semibold text-arcane hover:bg-arcane/5"
          >
            + Create a character
          </button>
        </>
      )}
    </div>
  );
}
