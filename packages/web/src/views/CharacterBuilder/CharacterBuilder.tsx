import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ABILITY_SCORE_KEYS,
  CLASS_HIT_DICE,
  POINT_BUY_BUDGET,
  SKILLS,
  STANDARD_ARRAY,
  calculateDerivedStats,
  isValidPointBuy,
  pointBuyTotalCost,
  type AbilityScoreKey,
  type AbilityScoreMethod,
  type AbilityScores,
  type EquipmentItem,
  type Skill,
} from "@dnd-ai-sim/shared";
import { useAuth } from "../../state/AuthContext";
import { apiFetch, ApiError } from "../../api/http";

const RACES = ["Human", "Elf", "Dwarf", "Halfling", "Half-Orc", "Tiefling", "Dragonborn", "Gnome", "Half-Elf"];
const CLASSES = Object.keys(CLASS_HIT_DICE);
const STEPS = ["Basics", "Ability Scores", "Skills & Saves", "Equipment", "Review"] as const;

const abilityLabel: Record<AbilityScoreKey, string> = {
  strength: "STR",
  dexterity: "DEX",
  constitution: "CON",
  intelligence: "INT",
  wisdom: "WIS",
  charisma: "CHA",
};

export default function CharacterBuilder() {
  const { auth } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [race, setRace] = useState(RACES[0]);
  const [charClass, setCharClass] = useState(CLASSES[0]);
  const [background, setBackground] = useState("");

  const [method, setMethod] = useState<AbilityScoreMethod>("standardArray");
  const [scores, setScores] = useState<AbilityScores>(() => {
    const initial = {} as AbilityScores;
    ABILITY_SCORE_KEYS.forEach((key, i) => (initial[key] = STANDARD_ARRAY[i] ?? 10));
    return initial;
  });

  const [proficientSkills, setProficientSkills] = useState<Skill[]>([]);
  const [proficientSaves, setProficientSaves] = useState<AbilityScoreKey[]>([]);

  const [equipment, setEquipment] = useState<EquipmentItem[]>([{ name: "", quantity: 1 }]);

  const preview = useMemo(
    () =>
      calculateDerivedStats({
        className: charClass,
        level: 1,
        abilityScores: scores,
        proficientSkills,
        proficientSavingThrows: proficientSaves,
      }),
    [charClass, scores, proficientSkills, proficientSaves]
  );

  const pointBuyValid = method !== "pointBuy" || isValidPointBuy(scores);

  function toggleSkill(skill: Skill) {
    setProficientSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
  }
  function toggleSave(key: AbilityScoreKey) {
    setProficientSaves((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  function applyStandardArray() {
    const keys = [...ABILITY_SCORE_KEYS];
    const next = { ...scores };
    keys.forEach((key, i) => (next[key] = STANDARD_ARRAY[i] ?? 10));
    setScores(next);
  }

  async function handleSubmit() {
    if (!auth) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/characters", {
        method: "POST",
        token: auth.token,
        body: {
          name,
          race,
          class: charClass,
          background,
          abilityScores: scores,
          abilityScoreMethod: method,
          proficientSkills,
          proficientSavingThrows: proficientSaves,
          equipment: equipment.filter((e) => e.name.trim()),
        },
      });
      navigate("/play");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create character");
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvance =
    (step === 0 && name.trim() && background.trim()) ||
    (step === 1 && pointBuyValid) ||
    step === 2 ||
    step === 3 ||
    step === 4;

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-bold text-arcane">Create a Character</h1>
      <p className="mb-4 text-sm text-ink/60">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="space-y-4">
          <label className="block text-sm font-medium">
            Character name
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-medium">
            Race
            <select className="input" value={race} onChange={(e) => setRace(e.target.value)}>
              {RACES.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Class
            <select className="input" value={charClass} onChange={(e) => setCharClass(e.target.value)}>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium">
            Background
            <input className="input" value={background} onChange={(e) => setBackground(e.target.value)} placeholder="e.g. Soldier, Sage, Criminal" />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div className="flex gap-2">
            {(["standardArray", "pointBuy", "manual"] as AbilityScoreMethod[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMethod(m);
                  if (m === "standardArray") applyStandardArray();
                }}
                className={`rounded px-3 py-1 text-sm ${method === m ? "bg-arcane text-white" : "bg-ink/10"}`}
              >
                {m === "standardArray" ? "Standard Array" : m === "pointBuy" ? "Point Buy" : "Manual (dice)"}
              </button>
            ))}
          </div>

          {method === "pointBuy" && (
            <p className={`text-sm ${pointBuyValid ? "text-ink/60" : "text-red-700"}`}>
              Points spent: {pointBuyTotalCost(scores)} / {POINT_BUY_BUDGET}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {ABILITY_SCORE_KEYS.map((key) => (
              <label key={key} className="block text-sm font-medium">
                {abilityLabel[key]}
                <input
                  type="number"
                  className="input"
                  min={method === "pointBuy" ? 8 : 1}
                  max={method === "pointBuy" ? 15 : 20}
                  value={scores[key]}
                  onChange={(e) => setScores({ ...scores, [key]: Number(e.target.value) })}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Saving throw proficiencies</p>
            <div className="flex flex-wrap gap-2">
              {ABILITY_SCORE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSave(key)}
                  className={`rounded px-3 py-1 text-sm ${proficientSaves.includes(key) ? "bg-arcane text-white" : "bg-ink/10"}`}
                >
                  {abilityLabel[key]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Skill proficiencies</p>
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  className={`rounded px-3 py-1 text-sm ${proficientSkills.includes(skill) ? "bg-arcane text-white" : "bg-ink/10"}`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          {equipment.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1"
                placeholder="Item name"
                value={item.name}
                onChange={(e) => {
                  const next = [...equipment];
                  next[i] = { ...next[i], name: e.target.value };
                  setEquipment(next);
                }}
              />
              <input
                type="number"
                className="input w-20"
                value={item.quantity}
                min={1}
                onChange={(e) => {
                  const next = [...equipment];
                  next[i] = { ...next[i], quantity: Number(e.target.value) };
                  setEquipment(next);
                }}
              />
              <button type="button" onClick={() => setEquipment(equipment.filter((_, j) => j !== i))} className="px-2 text-ink/50">
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setEquipment([...equipment, { name: "", quantity: 1 }])}
            className="text-sm text-arcane underline"
          >
            + Add item
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-2 rounded-lg border border-ink/20 bg-white/60 p-4 text-sm">
          <p className="text-lg font-semibold">{name || "(unnamed)"}</p>
          <p>
            {race} {charClass} -- {background}
          </p>
          <p>
            AC {preview.armorClass} | HP {preview.hitPointMax} | Initiative {preview.initiativeBonus >= 0 ? "+" : ""}
            {preview.initiativeBonus} | Passive Perception {preview.passivePerception}
          </p>
          <p>Proficiency bonus: +{preview.proficiencyBonus}</p>
          <p>Saves: {proficientSaves.map((k) => abilityLabel[k]).join(", ") || "none"}</p>
          <p>Skills: {proficientSkills.join(", ") || "none"}</p>
          <p>Equipment: {equipment.filter((e) => e.name.trim()).map((e) => `${e.name} x${e.quantity}`).join(", ") || "none"}</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => s - 1)}
          className="rounded px-4 py-2 text-sm disabled:opacity-30"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
            className="rounded bg-arcane px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
            className="rounded bg-ember px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Character"}
          </button>
        )}
      </div>
    </div>
  );
}
