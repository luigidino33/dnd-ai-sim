import { useState } from "react";
import type { SessionEvent } from "@dnd-ai-sim/shared";

interface Props {
  event: SessionEvent;
  onSubmit: (payload: {
    originalText: string;
    correctedText: string;
    reason?: string;
    characterId?: string;
    hpChange?: number;
  }) => Promise<void>;
}

/** Admin's "pause and correct" tool (requirement 5.4): visibly overrides the AI DM's last ruling. */
export default function CorrectionPanel({ event, onSubmit }: Props) {
  const [open, setOpen] = useState(false);
  const [correctedText, setCorrectedText] = useState("");
  const [reason, setReason] = useState("");
  const [hpChange, setHpChange] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => {
          setCorrectedText(event.text);
          setOpen(true);
        }}
        className="mt-6 w-full rounded border border-parchment/30 px-4 py-2 text-sm hover:bg-parchment/10"
      >
        Correct last ruling
      </button>
    );
  }

  return (
    <div className="mt-6 space-y-2 rounded border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm">
      <p className="text-xs text-parchment/60">Original: {event.text}</p>
      <textarea
        className="w-full rounded bg-ink/40 p-2 text-parchment"
        rows={2}
        value={correctedText}
        onChange={(e) => setCorrectedText(e.target.value)}
        placeholder="Corrected outcome (shown to all players)"
      />
      <input
        className="w-full rounded bg-ink/40 p-2 text-parchment"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
      />
      <input
        className="w-full rounded bg-ink/40 p-2 text-parchment"
        type="number"
        value={hpChange}
        onChange={(e) => setHpChange(e.target.value)}
        placeholder="HP adjustment, e.g. -5 or +3 (optional)"
      />
      <div className="flex gap-2">
        <button
          disabled={submitting || !correctedText.trim()}
          onClick={async () => {
            setSubmitting(true);
            try {
              await onSubmit({
                originalText: event.text,
                correctedText,
                reason: reason || undefined,
                characterId: event.characterId,
                hpChange: hpChange ? Number(hpChange) : undefined,
              });
              setOpen(false);
            } finally {
              setSubmitting(false);
            }
          }}
          className="flex-1 rounded bg-yellow-600 px-3 py-2 font-semibold text-ink disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Broadcast correction"}
        </button>
        <button onClick={() => setOpen(false)} className="rounded px-3 py-2 text-parchment/70">
          Cancel
        </button>
      </div>
    </div>
  );
}
