# The Bluff Club — Development Progress

Tracks the 25 implementation milestones, their commits, the checks that were run
for each one, and known issues. Commit hashes are filled in after each commit
lands (a commit cannot contain its own hash, so each entry is recorded in the
following milestone's commit; the final hashes are listed in the release report).

## Environment snapshot

| Item | Status |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript, Tailwind CSS v4 |
| Backend | Supabase (Postgres, Auth, Storage) — migrations in `supabase/migrations` |
| Tests | Vitest + React Testing Library; PGlite runs the real SQL migrations for database tests |
| Remote | `origin` → https://github.com/tarang802/BackOfHouse.git (`main`) |
| Supabase project | Not provisioned from this environment — needs the owner's credentials |
| Vercel deployment | Not deployed from this environment — needs the owner's Vercel account |

## Milestones

| # | Commit message | Status | Hash | Checks |
| --- | --- | --- | --- | --- |
| 01 | `chore: initialize application foundation` | done | a9099c4 | lint, typecheck, unit tests, build |
| 02 | `style: establish premium design system` | done | see 03 | lint, typecheck, UI tests, build |
| 03 | `feat: build premium landing page` | pending | | |
| 04 | `feat: implement authentication` | pending | | |
| 05 | `feat: add database schema and migrations` | pending | | |
| 06 | `feat: secure database access and permissions` | pending | | |
| 07 | `feat: implement player profiles` | pending | | |
| 08 | `feat: add club membership and invitations` | pending | | |
| 09 | `feat: build personalized club dashboard` | pending | | |
| 10 | `feat: implement leaderboard engine` | pending | | |
| 11 | `feat: implement player directory` | pending | | |
| 12 | `feat: add match recording flow` | pending | | |
| 13 | `feat: persist match results transactionally` | pending | | |
| 14 | `feat: implement bluff statistics` | pending | | |
| 15 | `feat: implement poker session tracking` | pending | | |
| 16 | `feat: add match history and corrections` | pending | | |
| 17 | `feat: add head-to-head rivalries` | pending | | |
| 18 | `feat: implement tournament creation` | pending | | |
| 19 | `feat: calculate tournament standings` | pending | | |
| 20 | `feat: implement player achievements` | pending | | |
| 21 | `feat: add seasons and club activity` | pending | | |
| 22 | `feat: add club administration and scoring settings` | pending | | |
| 23 | `style: polish responsive layouts and accessibility` | pending | | |
| 24 | `test: harden scoring and authorization flows` | pending | | |
| 25 | `docs: finalize release and deployment guide` | pending | | |

## Milestone notes

### 01 — Foundation
- Scaffolded with `create-next-app` (Next.js 16.4, React 19.3, Tailwind v4, ESLint 9).
- Added architecture notes (`docs/ARCHITECTURE.md`), `.env.example` with placeholders only,
  and this tracker.
- Key decisions:
  - All point calculations happen on the server (Postgres functions) — the browser only
    ever sends *who* played and *where they finished*.
  - The app uses the signed-in user's session for every query, so Row Level Security is
    always in force. No service-role key is needed at runtime.
  - Statistics (wins, streaks, head-to-head, achievements) are derived from match records
    rather than stored as counters, so voiding or correcting a match updates everything.

### 02 — Design system
- Tokens in `src/app/globals.css` (`@theme`): ink/surface/line greys, ivory text, casino green,
  restrained gold, muted loss red. Cormorant Garamond (display) + Manrope (interface).
- Primitives in `src/components/ui`: Button/ButtonLink, Field/Input/Select/Textarea, Card/Stat,
  Badge/FormPill, Avatar (photo or suit monogram), Dialog (native `<dialog>`, sheet on phones),
  EmptyState/Skeleton/GoldDivider/PageHeader, CountUp. Brand: Logo, PlayingCard.
- Motion respects `prefers-reduced-motion` globally and via `useReducedMotion`.

## Known issues

- None yet.

## Deployment status

- Not deployed. See README once milestone 25 lands.
