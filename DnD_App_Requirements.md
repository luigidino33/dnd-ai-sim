# Requirements Document: AI Dungeon Master App
**Character Creation & Autonomous AI-Run D&D Sessions**

Version 1.0 | Locked — Ready for Architecture

---

## 1. Overview

A web application where an **AI acts as the Dungeon Master itself** — running live sessions directly with players, narrating, playing NPCs, and adjudicating rules (interpreting manually-entered dice rolls, deciding outcomes, applying conditions/effects) — with no human DM required. Character creation is also automated. Dice are physically rolled and **manually entered**; the AI does not generate randomness, only interprets results.

This is a significant shift from a "DM assistant" tool to a **DM replacement**: the AI is a live participant in every session, not a background helper.

## 2. Goals

- Let the existing group play full D&D sessions **without a dedicated human DM**.
- AI handles narration, NPC roleplay, encounter pacing, and rules adjudication in real time.
- Preserve the manual dice-rolling feel — players still roll physical dice and type in results.
- Support the group's single ongoing campaign persistently over time (9 players/characters).
- Keep sessions fair and consistent — the AI's rulings should be traceable and correctable.

## 3. Non-Goals (v1)

- No automated/virtual dice rolling (RNG) — rolls are always manually entered.
- No voice/video AI (text-based interaction for v1; voice could be a future phase).
- No support for rule systems other than D&D 5e unless specified otherwise.
- No public matchmaking — this is for your existing group only.

## 4. Users & Roles

Since there's no human DM, roles simplify:

| Role | Description |
|---|---|
| **AI DM** | Runs the session: narrates, plays all NPCs/monsters, adjudicates rules, manages combat and pacing. |
| **Player** | Creates/manages their own character(s), interacts with the AI DM live during sessions. |
| **Campaign Owner/Admin** | A player (likely you) with elevated permissions: creates campaigns, configures AI DM settings/tone, moderates turn order, can override or correct AI rulings, manages homebrew/world content. |

**Confirmed**: the app is strictly turn-based, and the **Admin moderates every turn** — not just combat. The Admin acts as the "table host," controlling whose turn it is and when the AI DM processes an action. This significantly simplifies the concurrency problem (Section 6) since the app doesn't need to guess at turn order — the Admin explicitly drives it.

**Party size confirmed at 9 players.** This is large for 5e and reinforces why explicit Admin-driven turn control (rather than free-for-all chat) is the right call — it keeps the AI from being overwhelmed and keeps pacing fair.

## 5. Functional Requirements

### 5.1 Character Creation
- Guided step-by-step character builder: race, class, background, ability scores, skills, equipment, spells.
- Support standard ability score methods: point buy, standard array, and manual entry (physical dice).
- Auto-calculate derived stats: modifiers, AC, HP, saving throws, proficiency bonus, passive perception.
- Class-specific features auto-populated (spell slots, rage uses, ki points, etc.) based on class/level.
- Editable/overridable fields for flexibility.
- Level-up flow: recalculates stats, prompts for new feature/spell choices.
- Exportable/printable character sheet.
- Save multiple characters per player, scoped to a campaign.

### 5.2 AI Dungeon Master (Core Feature)

This is the heart of the app. The AI DM must:

- **Run live sessions directly with players** — no human intermediary. Players type actions/dialogue; the AI responds in real time as narrator and all NPCs/monsters.
- **Narrate scenes, environments, and events**, adapting to player choices.
- **Roleplay NPCs and monsters** with distinct personalities, consistent across a session and ideally across the campaign.
- **Adjudicate rules**, including:
  - Interpreting manually-entered roll results (e.g., player types "I rolled 17 for my attack") and applying modifiers to determine hit/miss, damage, save success/failure, etc.
  - Applying and tracking conditions (poisoned, prone, stunned, etc.) and their mechanical effects.
  - Determining when a roll is needed at all, and what type (skill check, save, attack).
  - Managing initiative order and turn structure in combat.
  - Tracking HP, resources (spell slots, limited-use abilities), and death saves.
- **Maintain campaign state and continuity**: remember prior sessions, established NPCs, world facts, and past player decisions, and stay consistent with them.
- **Follow D&D 5e SRD rules** as the ruleset baseline, with configurable tone/style (grim, comedic, high fantasy, etc.).
- **Be correctable, visibly**: the Admin can flag a ruling as wrong and override it — and the correction should be **shown to all players** (e.g., "Admin corrected: this was a hit, not a miss") rather than silently changed. This keeps trust in the system and gives everyone a clear record of what actually happened.
- **Encounter/difficulty management**: build or adapt encounters appropriately for a 9-player party — significantly above standard 5e guidelines (typically written for 3-6), so encounter math (monster count, HP pools, action economy) will need real scaling, not just multiplying standard encounters.

### 5.3 Manual Roll Handling
- Manual input fields for roll results — players type in what they physically rolled.
- The AI applies modifiers and interprets the result according to the rules; it never generates the raw roll.
- Full roll history log per character/session, visible for auditing AI rulings.

### 5.4 Session & Campaign Management
- **Live session interface, in-person use case**: the group plays together physically in the same room, using the app as a shared DM/turn-management companion rather than a remote chat tool. This implies:
  - A **shared/host view**, designed for either an iPad or a laptop mirrored to a TV — UI should be legible at a distance (larger text, high contrast) and work in both a tablet touch layout and a laptop/browser layout.
  - **Individual player views** (phone/tablet) for entering actions, rolls, and private info (inventory, spell slots) without the whole table needing to see every detail.
  - The Admin's device acts as the "turn control" — advancing to the next player, triggering the AI DM's response, and issuing corrections.
- **Turn queue**: strictly explicit, one player at a time — **every player gets their own turn**, even outside combat (no letting players free-flow back-and-forth). The Admin advances the queue: one player acts, AI responds, Admin advances to the next.
- **Pause-and-correct**: the Admin can pause the turn queue at any point — not just after the fact — to review and correct an AI ruling before play continues. This means the correction flow needs to support "hold everything, fix this, then resume" as a first-class action, not just a post-hoc log entry.
- Session notes/log auto-captured from the live session (searchable later).
- Campaign/world bible: locations, factions, plot threads — the AI should read from and write to this to stay consistent.
- **Single ongoing campaign** — no need for multi-campaign isolation or switching; the app maintains one persistent world/state that grows session over session.
- Party/character roster view for the Campaign Owner.

## 6. Consistency & Reliability Requirements (Critical)

Because the AI is now adjudicating rules and running live sessions with no human check, this becomes a **reliability-critical system**, not just a flavor-text generator:

- **State must be authoritative and persistent** — HP, conditions, initiative order, inventory, spell slots must live in a real database, not just "remembered" by the AI in conversation. The AI should read/write this state explicitly, not rely on its own memory of the chat.
- **Rules grounding**: the AI should have structured access to actual SRD rules text (via retrieval/lookup) rather than relying purely on its training knowledge, to reduce rules errors.
- **Auditability**: every AI ruling should be loggable with "what roll/inputs led to this outcome" so it can be reviewed or corrected after the fact.
- **Latency**: live session responses need to feel reasonably fast (a few seconds, not tens of seconds) to keep pacing during play — especially with 9 players in the room waiting on turns.
- **Turn ordering is Admin-driven, not AI-guessed**: confirmed the app is fully turn-based, with the Admin explicitly controlling whose turn is active and when the AI DM is triggered. The AI only ever processes one active turn's input at a time — this removes the concurrency/race-condition problem of multiple simultaneous player inputs.
- **Graceful degradation**: if the venue wifi drops mid-session, a **brief pause is acceptable** — no need for offline queuing or action buffering. The app should detect the disconnect, pause the turn queue automatically, and resume cleanly once connectivity returns, rather than losing state or requiring a manual restart.

## 7. Non-Functional Requirements

- **Platform**: Web app, responsive.
- **Data persistence**: Character, campaign, and session state saved to a backend database — critical here since the AI depends on it for continuity and rulings.
- **Performance**: Live session interactions should feel conversational — target a few seconds per AI response.
- **Access control**: Invite-only, single-campaign permissions (Admin vs. Player) — no cross-campaign isolation needed.
- **Local/in-person network**: since the group plays together in person, the app should work reliably over local wifi or mobile data in one room. A brief pause on connectivity loss is acceptable — no offline mode required.
- **Device mix**: shared host view on **iPad or laptop-mirrored-to-TV** (legible at a distance, touch- and browser-friendly), plus individual player phones/tablets for private actions and info.

## 8. Data Sources & Rules Content

- D&D 5e SRD as the rules baseline — ideally structured (searchable/retrievable) rather than left to the AI's general knowledge, to reduce rules mistakes.
- No group-specific homebrew rules currently, but keep the system flexible for the Admin to add house rules later.

## 9. Tech Considerations (to decide)

| Decision | Options |
|---|---|
| Frontend framework | React, Vue, plain HTML/JS |
| Backend | Node/Express, Python (FastAPI) |
| Database | PostgreSQL, MongoDB |
| Real-time layer | WebSockets (for live session chat/updates) |
| AI provider/model | Claude (Sonnet 5 as default; Haiku 4.5 for cheap flavor text; Opus 5 for complex rules reasoning if needed) |
| Rules grounding | Retrieval (RAG) over structured SRD data, fed to the AI as context per turn |
| Hosting | Vercel/Render (frontend+API), managed Postgres |
| Auth | Invite-code or email-based login |

Given the live, multi-player, stateful nature of this app, a **WebSocket-based backend** (not just simple request/response) is likely necessary so all players see updates in real time during a session.

## 10. Cost Considerations

**Target: ~$10 USD per session, 4-5 hours, 9 players, turn-based.**

Since turns are Admin-moderated (one active turn at a time, not free-for-all chat), the number of AI calls per session is actually bounded and estimable — this is good news for budgeting.

**Rough estimate:**
- A 4-5 hour in-person session with 9 players, turn-based, might realistically produce **150-300 AI DM calls** (narration + rulings) — accounting for combat rounds, exploration turns, and NPC dialogue exchanges.
- Each call: ~1,000-3,000 input tokens (character state, recent context, relevant rules — much of it cacheable) and ~300-600 output tokens (narration/ruling text).
- With **Sonnet 5** ($2/$10 per MTok) and prompt caching on the static context (world bible, SRD excerpts, character sheets — cached reads cost 10% of standard input price):
  - Effective cost per call: roughly **$0.005-$0.015**
  - 300 calls × ~$0.01 ≈ **$3**, comfortably under budget
- Even without aggressive caching, or using **Opus 5** ($5/$25 per MTok) for more complex rules reasoning on some calls, a full session should stay well under $10 in most realistic scenarios.

**Recommendation**: default to Sonnet 5 for all DM narration and rules adjudication — it comfortably fits the budget with margin to spare, so there's no real need to downgrade to Haiku for cost reasons. That margin could instead go toward occasionally using Opus 5 for particularly complex adjudications (e.g., multi-effect combat interactions) if quality becomes a concern in testing.

*(These are estimates based on typical prompt/response sizes — actual costs should be measured with a test session once the MVP is running, since real context sizes and call frequency will vary.)*

## 11. Suggested Phasing

| Phase | Scope |
|---|---|
| **Phase 1 (MVP)** | Small test party, AI DM handles narration + basic rules adjudication (attacks, saves, skill checks) via live turn-based interface; persistent state for HP/conditions |
| **Phase 2** | Full initiative/combat management, roll/session audit log, Admin override/correction tools |
| **Phase 3** | Character creation & full sheet management integrated into the live flow (level-ups, spell management) |
| **Phase 4** | Scale to full 9-player party, encounter/pacing improvements for large groups, world bible depth, polish |

**Recommendation**: prove out the AI-DM-adjudicates-rules concept with a small subset of the group (2-4 players) before scaling to the full 9, since a large party live session raises pacing/turn-order complexity that's easier to solve once the core loop works.

---

*All open questions from prior review rounds are now resolved. Requirements are locked pending your final sign-off — ready to move into architecture and design.*
