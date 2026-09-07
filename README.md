# AI Dungeon Master App

A web app where an AI runs live, turn-based D&D 5e sessions as the Dungeon Master itself — narration, NPCs, and rules adjudication on manually-entered dice rolls — for an in-person group, with an Admin who drives the turn queue and can pause/correct AI rulings.

This is the **Phase 1 MVP** vertical slice: character creation, a live turn-based session loop over WebSockets, persistent HP/conditions, local SRD rules grounding, and Admin pause-and-correct. See [`DnD_App_Requirements.md`](./DnD_App_Requirements.md) for the full requirements and phasing.

## Stack

- **Backend**: Node.js + TypeScript, Express, Socket.io, Mongoose (MongoDB), Anthropic SDK (`claude-sonnet-5`)
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, React Router
- **Shared**: a `packages/shared` workspace with D&D 5e derived-stat math and types used by both sides

## Setup

1. **Start MongoDB locally**:
   ```bash
   docker compose up -d
   ```

2. **Install dependencies** (run once, from the repo root):
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   Then edit `.env` and set `ANTHROPIC_API_KEY` to your own key — the AI DM service will fail without it. Get one at https://console.anthropic.com/.

4. **Bootstrap the campaign** (creates the single ongoing campaign and prints invite codes):
   ```bash
   npm run seed
   ```
   Keep the printed **Admin invite code** for yourself and share the **Player invite code** with the rest of the group.

5. **Run the app** (starts both the server on :4000 and the web app on :5173):
   ```bash
   npm run dev
   ```
   Open http://localhost:5173, join with the admin code on the device you'll use as table host, and join with the player code on each player's device.

## How a session works

1. Each player creates a level-1 character through the guided builder (`+ Create a character` on their home screen).
2. The Admin opens their dashboard and clicks **Start new session** — this builds the turn queue from the current roster and opens the Host View (best on an iPad or a laptop mirrored to a TV).
3. The Admin clicks **Advance Turn** to activate the next character. That player's device then shows an action box.
4. The player types their action; the AI DM narrates and, if a roll is needed, asks for it. The player rolls their physical dice and types the result back in.
5. The AI DM resolves the outcome via a structured ruling — HP, conditions, and resources update automatically and are broadcast to every device.
6. The Admin can **Pause** at any time, and use **Correct last ruling** to override an AI ruling — the correction is broadcast to everyone, never silently changed.
7. If the venue wifi drops, the session auto-pauses when the Admin's device disconnects and auto-resumes when it reconnects — no manual restart needed.

## Project layout

```
packages/
  shared/   # D&D 5e math + types shared by server and web
  server/   # Express API + Socket.io turn engine + AI DM service + SRD lookup
  web/      # React app: join flow, character builder, host view, player view
```

## Testing

```bash
npm test
```
Runs the `shared` package's Vitest suite (derived-stat calculations: ability modifiers, proficiency bonus, HP, AC, point buy validation).

There's no automated end-to-end test for the live session loop yet — verify it manually by running through the flow above with two browser tabs (one admin, one player).

## What's not in this MVP

Per the requirements doc's own phasing, these are intentionally out of scope for Phase 1 and left for later phases: level-up flow, full spell slot/spellcasting management, exportable/printable character sheets, a world-bible editing UI (the API exists at `PATCH /api/campaigns/:id/world-bible`, but there's no admin screen for it yet), and pacing/UX polish for the full 9-player party. The SRD rules data included is a starter set (core conditions, skills, a handful of spells/monsters) — extend the JSON files in `packages/server/src/srd/data/` as needed.
