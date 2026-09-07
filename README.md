# AI Dungeon Master App

A web app where an AI runs live, turn-based D&D 5e sessions as the Dungeon Master itself — narration, NPCs, and rules adjudication on manually-entered dice rolls — for an in-person group, with an Admin who drives the turn queue and can pause/correct AI rulings.

This is the **Phase 1 MVP** vertical slice: character creation, a live turn-based session loop, persistent HP/conditions, local SRD rules grounding, and Admin pause-and-correct. See [`DnD_App_Requirements.md`](./DnD_App_Requirements.md) for the full requirements and phasing.

## Stack

Built to deploy on **Vercel** end to end:
- **Frontend**: React + TypeScript, Vite, Tailwind CSS, React Router
- **Backend**: Vercel Serverless Functions (Node) under `packages/web/api/`
- **Database + Realtime**: Supabase (Postgres, with Row Level Security + built-in Realtime for live updates)
- **AI**: Anthropic SDK (`claude-sonnet-5`)
- **Shared**: `packages/shared` — D&D 5e derived-stat math, types, and DB row↔type mappers used by both the frontend and the API functions

There's no long-lived server process — Vercel functions are stateless, so live updates (turn changes, narration, HP/condition changes) are delivered via **Supabase Realtime** (`postgres_changes`) instead of a WebSocket server: a function writes to Postgres, and every subscribed browser gets the update automatically.

## One-time setup

### 1. Supabase project
1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run [`packages/web/supabase/schema.sql`](./packages/web/supabase/schema.sql) once — it creates the tables, indexes, RLS policies, and registers the live tables with Supabase Realtime.
3. From Project Settings → API, grab:
   - **Project URL**
   - **anon/public key**
   - **service_role key** (secret — never expose this to the browser)

### 2. Anthropic API key
Get one at [console.anthropic.com](https://console.anthropic.com/).

### 3. Local environment
```bash
cd packages/web
cp .env.local.example .env.local
```
Fill in `.env.local` with the Supabase URL/keys (both the `SUPABASE_*` server vars and the `VITE_SUPABASE_*` client vars), `ANTHROPIC_API_KEY`, and a random `JWT_SECRET`.

### 4. Vercel CLI
```bash
npm i -g vercel
vercel login
cd packages/web
vercel link
```
When prompted, this creates/links a Vercel project. In the Vercel dashboard for that project, confirm **Root Directory** is set to `packages/web` (needed since this is an npm-workspaces monorepo).

Then copy the same variables from `.env.local` into the Vercel project's **Environment Variables** (Settings → Environment Variables) so they're available in Preview/Production deploys.

### 5. Bootstrap the campaign
```bash
npm run seed
```
(from `packages/web`) — creates the single ongoing campaign and prints its invite codes. Keep the **Admin** code for yourself; share the **Player** code with the rest of the group.

## Running locally

```bash
cd packages/web
vercel dev
```
This runs the Vite frontend and every `/api` serverless function together on one local port, matching production. (Run `vercel dev` directly — don't wrap it in an `npm run` script; the Vercel CLI refuses to run if it detects itself as the configured dev command, to avoid infinite recursion.)

## Deploying

```bash
cd packages/web
vercel deploy --prod
```
Or connect the GitHub repo in the Vercel dashboard for automatic deploys on push.

## How a session works

1. Each player creates a level-1 character through the guided builder (`+ Create a character` on their home screen).
2. The Admin opens their dashboard and clicks **Start new session** — this builds the turn queue from the current roster and opens the Host View (best on an iPad or a laptop mirrored to a TV).
3. The Admin clicks **Advance Turn** to activate the next character. That player's device then shows an action box.
4. The player types their action; the AI DM narrates and, if a roll is needed, asks for it. The player rolls their physical dice and types the result back in.
5. The AI DM resolves the outcome via a structured tool-use ruling — HP, conditions, and resources update in Postgres and are pushed to every device via Supabase Realtime.
6. The Admin can **Pause** at any time, and use **Correct last ruling** to override an AI ruling — the correction is broadcast to everyone, never silently changed.
7. If a device's connection drops mid-session, other connected clients detect the Admin's Realtime presence disappearing and report it, which auto-pauses the session; reconnecting auto-resumes it. (This is client-observed rather than server-guaranteed, since there's no persistent server process to catch a socket drop the way the original Socket.io design did — a reasonable trade-off for a small trusted group over brief venue wifi blips.)

## Project layout

```
packages/
  shared/           # D&D 5e math + types + DB row<->type mappers, shared by web src and api
  web/
    api/            # Vercel serverless functions (the "backend")
      _lib/         # services, Supabase client, JWT auth, SRD data -- not directly routable
      auth/, campaigns/, characters/, sessions/, turn/, presence/   # route handlers
    src/            # React app: join flow, character builder, host view, player view
    supabase/schema.sql
```

## Testing

```bash
npm run test
```
Runs the `shared` package's Vitest suite (derived-stat calculations: ability modifiers, proficiency bonus, HP, AC, point buy validation).

```bash
npm run build
```
Typechecks both the frontend (`src/`) and every serverless function (`api/`), then builds the Vite production bundle.

There's no automated end-to-end test for the live session loop — it needs a real Supabase project, Vercel deployment (or `vercel dev`), and Anthropic key to exercise. Verify manually by running through the flow above with two browser tabs/devices (one Admin, one Player).

## What's not in this MVP

Per the requirements doc's own phasing, these are intentionally out of scope for Phase 1 and left for later phases: level-up flow, full spell slot/spellcasting management, exportable/printable character sheets, and a world-bible editing UI (the API exists at `PATCH /api/campaigns/:id/world-bible`, but there's no admin screen for it yet). The SRD rules data included is a starter set (core conditions, skills, a handful of spells/monsters) — extend the JSON files in `packages/web/api/_lib/srd/data/` as needed.
