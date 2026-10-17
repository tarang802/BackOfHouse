# The Bluff Club

**Trust No One. Play Your Hand.** — *Your Room. Your Rivals. Your Table.*

A private club for friends who play Bluff, Poker, Teen Patti and house card games in person.
One of you records each result on a phone in a few seconds; leaderboards, streaks, rivalries,
achievements, tournaments and seasons build themselves from the record.

> Friendly scorekeeping only. Points are leaderboard points. There are no deposits, wagers,
> payments or transfers. The optional poker “session accounting” is a private memo that never
> affects points and moves no money.

## What's inside

| Area | Highlights |
| --- | --- |
| Accounts | Email + password (Supabase Auth), confirmation emails, password recovery, sign-out |
| Clubs | Create a private club, invite by code or `/join/<code>` link (expiry / use limits, revocable), owner / admin / member roles, several clubs per player |
| Profiles | Display name, unique username, suit emblem, optional photo (resized client-side, stored in your own storage folder), player card with rank, points, W/L, win rate, streaks, per-game stats, best tournament finish, rivals, achievements |
| Recording | Pick game → tap players in finishing order → ties → live point preview → save. Server validates and scores in one transaction; replays never double-count |
| Leaderboards | All-time overall, current season, per game, live tournaments; search, sort, shared ranks; plain-language scoring rules |
| Games | Bluff and Poker rooms (stats, boards, rivalries, history), Teen Patti and custom games; per-game “counts toward overall” setting |
| History | Search + filters; admins void or correct with a reason; full audit trail; corrections are linked and keep the original scoring version |
| Tournaments | Points race, fixed rounds, seeded knockout (2–32). Champions only when legitimately decided; championship screen |
| Seasons | One active season, archived standings snapshots and champions; match history is never deleted |
| Admin | Versioned scoring (owner), roles and ownership transfer, games, club settings, playful titles toggle, member removal |
| Realtime | Club pages refresh when a result is recorded on another phone |

Design: near-black felt, ivory type, restrained casino green and gold; Cormorant Garamond +
Manrope; mobile-first with bottom navigation on phones and a sidebar on desktop; respects
reduced-motion preferences.

## Stack

Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript · Tailwind CSS v4 ·
Supabase (Postgres, Auth, Storage, Realtime, Row Level Security) · Vitest + React Testing Library ·
PGlite (in-process Postgres) for database tests · axe-core accessibility checks.

Docs: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/DATABASE.md`](docs/DATABASE.md) ·
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · [`DEVELOPMENT_PROGRESS.md`](DEVELOPMENT_PROGRESS.md)

## Run it locally

Requirements: Node.js 20.9+ and a Supabase project (hosted, or local via Docker).

```bash
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Where it comes from | Exposed to browser? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | yes (safe) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API keys → publishable key (`sb_publishable_…`; legacy anon key also works) | yes (safe, RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally, your domain in production | yes |
| `SUPABASE_SECRET_KEY` | Supabase → API keys → secret key. **Only** for `npm run db:seed` on a local project. Never set it on Vercel. | no |

Create the database (see [`docs/DATABASE.md`](docs/DATABASE.md)):

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Then configure Auth (Supabase → Authentication → URL Configuration):

- **Site URL:** `http://localhost:3000` (production: your Vercel URL)
- **Redirect URLs:** `http://localhost:3000/auth/confirm` (and `https://<your-domain>/auth/confirm`)
- Email provider enabled; “Confirm email” on (recommended).

Start the app:

```bash
npm run dev
```

Open http://localhost:3000 → *Enter the Club* → sign up → create your player card → open a
club → copy the invitation link from **Club settings** and send it to your friends.

Optional demo data for a **local** Supabase only:

```bash
npm run db:seed
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | All unit, UI, accessibility and database tests (PGlite — no Docker needed) |
| `npm run check` | lint + typecheck + tests |
| `npm run db:seed` | Development-only demo club (refuses non-local URLs without `--allow-remote`) |

## How scoring works

- Default: 1st **+3**, 2nd **+1**, everyone else 0. The owner can change the table (up to 10
  places) and add participation points; each change creates a new numbered version.
- Ties use competition ranking (1, 2, 2, 4): tied players get the shared place's points; a
  shared first place is a win for each of them.
- Points are calculated and stored by the database when a match is recorded, together with
  the rule version. Changing the rules never rewrites earlier matches; corrections keep the
  version the match was played under.
- Ranking: points → wins → win rate; full ties share a rank. Players without games are listed
  as unranked.
- Each game can count toward the overall board or only its own board (e.g. Poker only).

## Security model (summary)

- Every table has Row Level Security; members can read only their club's rows. Anonymous
  users have no table access. Email addresses never leave `auth.users`.
- Clients cannot write club data directly. All writes go through `security definer` Postgres
  functions that re-check `auth.uid()`, membership and role, validate input, and write
  everything in one transaction. Server Actions validate again with zod.
- The browser never sends points, user ids for “who am I”, roles or club ids it could forge —
  the active club comes from the session and is validated against real memberships.
- The web app uses only the publishable key. No privileged key is needed at runtime.

## Deploying

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for the full Vercel + Supabase walkthrough.

## Status

Implemented and tested locally (199 automated tests, lint, typecheck and production build
passing). Not yet deployed: deployment needs the owner's Supabase project and Vercel account.
See `DEVELOPMENT_PROGRESS.md` for the milestone log and known limitations.
