import { useState, type FormEvent } from "react";
import { useAuth } from "../state/AuthContext";
import { ApiError } from "../api/http";

export default function JoinView() {
  const { join } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await join(inviteCode, name);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join -- check the invite code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border-2 border-ink/20 bg-white/60 p-8 shadow-lg">
        <h1 className="mb-1 text-3xl font-bold text-arcane">AI Dungeon Master</h1>
        <p className="mb-6 text-sm text-ink/70">Enter your invite code to join the campaign.</p>

        <label className="mb-3 block text-sm font-medium">
          Your name
          <input
            className="mt-1 w-full rounded border border-ink/30 px-3 py-2 focus:border-arcane focus:outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <label className="mb-6 block text-sm font-medium">
          Invite code
          <input
            className="mt-1 w-full rounded border border-ink/30 px-3 py-2 uppercase tracking-widest focus:border-arcane focus:outline-none"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            required
          />
        </label>

        {error && <p className="mb-4 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-ember px-4 py-2 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Joining..." : "Join Campaign"}
        </button>
      </form>
    </div>
  );
}
