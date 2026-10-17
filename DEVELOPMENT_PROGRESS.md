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
| 02 | `style: establish premium design system` | done | f9b7010 | lint, typecheck, UI tests, build |
| 03 | `feat: build premium landing page` | done | 9096f5b | lint, typecheck, landing tests, build, visual check (375px + desktop) |
| 04 | `feat: implement authentication` | done | 33e9be9 | lint, typecheck, validation/error-mapping tests, build |
| 05 | `feat: add database schema and migrations` | done | f337a00 | lint, typecheck, PGlite schema tests, build |
| 06 | `feat: secure database access and permissions` | done | bf66f7f | lint, typecheck, PGlite RLS / cross-club isolation tests, build |
| 07 | `feat: implement player profiles` | done | 1d1a73e | lint, typecheck, profile validation + PGlite profile/avatar tests, build |
| 08 | `feat: add club membership and invitations` | done | e750474 | lint, typecheck, PGlite club/invitation tests, build |
| 09 | `feat: build personalized club dashboard` | done | 721b1b1 | lint, typecheck, stats unit tests, build |
| 10 | `feat: implement leaderboard engine` | done | ea96fe6 | lint, typecheck, scoring + ranking unit tests, build |
| 11 | `feat: implement player directory` | done | ff13320 | lint, typecheck, directory UI tests, build |
| 12 | `feat: add match recording flow` | done | 8f3eea5 | lint, typecheck, recorder UI tests, finish-order + schema tests, build |
| 13 | `feat: persist match results transactionally` | done | daf81cd | lint, typecheck, PGlite record_match tests (scoring parity, idempotency, validation), build |
| 14 | `feat: implement bluff statistics` | done | 21bc97d | lint, typecheck, head-to-head unit tests, build |
| 15 | `feat: implement poker session tracking` | done | 8f5cd78 | lint, typecheck, ledger unit tests, build |
| 16 | `feat: add match history and corrections` | done | 20f9324 | lint, typecheck, PGlite void/correct tests, history filter tests, build |
| 17 | `feat: add head-to-head rivalries` | done | b3ee588 | lint, typecheck, head-to-head unit tests, build |
| 18 | `feat: implement tournament creation` | done | see 19 | lint, typecheck, bracket unit tests, PGlite lifecycle + knockout tests, build |
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

### 03 — Landing page
- Hero (“Trust No One. Play Your Hand.”), Enter the Club / Discover the Game CTAs, how-it-works
  steps, features, honest “house rules” (no wagering), closing tagline.
- Branded 404 and error pages. Checked at 375px (no horizontal scroll) and desktop widths.

### 04 — Authentication
- Supabase Auth (email + password) with `@supabase/ssr` cookie sessions. `src/proxy.ts` (Next 16’s
  renamed middleware) refreshes the session and redirects signed-out visitors away from `/club`.
- Sign up (with email confirmation), sign in, sign out, password recovery (`/forgot-password` →
  email link → `/auth/confirm` → `/reset-password`). Redirect targets are restricted to in-app
  paths. Recovery responses never reveal whether an email has an account.
- Errors from Supabase are mapped to short, safe messages (`src/lib/errors.ts`).
- Without Supabase configuration the app shows a `/setup` page instead of crashing.

### 05 — Schema
- `supabase/migrations/20261017000100_schema.sql`: profiles, clubs, memberships, invitations,
  game types, versioned scoring rules, seasons, tournaments (+participants, bracket), matches,
  match participants, private poker ledger, audit log. Composite foreign keys stop any row
  from pointing at another club's game, rules or tournament; `(club_id, submission_id)` is
  unique so a submission can never be recorded twice.
- Test harness: PGlite (Postgres in WebAssembly) + a small Supabase `auth`/`storage` shim run
  the real migrations, so schema and policy tests need no Docker.

### 06 — Security
- RLS on every table: members read their own club; anonymous users have no privileges.
  Clients cannot write club data directly — only `security definer` functions can, after
  re-checking `auth.uid()` membership and role. The only direct write is a user's own profile.
- Invitation codes are visible to owners/admins only; emails never leave `auth.users`.
- Server-side session helpers (`requireProfile`, `requireClub`) re-validate the active-club
  cookie against real memberships on every request.
- Tests prove cross-club isolation: guessed IDs return nothing, forged writes are refused.

### 07 — Player profiles
- Onboarding step 1 creates the player card (display name, unique username with live
  suggestion, suit emblem). Users can edit it at `/club/profile`.
- Avatars: resized to a 256px WebP in the browser, uploaded to the user's own folder in the
  `avatars` bucket (storage policies), and a database constraint only accepts URLs inside that
  folder. Without a photo, players get a monogram card with their suit.
- Club shell (desktop sidebar, mobile header + bottom navigation) and the player profile page
  (identity card; statistics are added with the leaderboard engine).

### 08 — Clubs and invitations
- `create_club` makes the creator owner and seeds Bluff, Poker, Teen Patti, scoring v1 (+3/+1)
  and a first invitation. Club time zone is taken from the creator's browser.
- Invitations: 8-character codes without look-alike characters, optional expiry and use
  limits, revocable; shareable `/join/<code>` links carry new users through sign-up and
  profile creation straight to the join form. Joining is idempotent.
- Members can belong to several clubs; a validated cookie remembers the active one.

### 09 — Dashboard
- `/club`: club identity and member count, current season label, your standing (points,
  win rate, last-five form with W/L letters), top players, live tournaments and recent
  champions, recent matches, club activity, and quick actions (record, invite).
- Statistics are pure functions over confirmed matches (`src/lib/domain/stats.ts`): wins,
  losses, points, win rate, average finish, current/best streaks, recent form.
- Server-side data access (`src/lib/data/*`) always queries with the user's session (RLS),
  paging past PostgREST's 1,000-row cap.

### 10 — Leaderboard engine
- Scoring (`src/lib/domain/scoring.ts`): placement validation with competition-ranked ties
  (1, 2, 2, 4), configurable placement points + optional participation points, rule validation,
  plain-language rule descriptions. Mirrors the SQL that will award points on the server.
- Ranking (`leaderboard.ts`): points → wins → win rate; full ties share a rank; players with no
  games are listed as unranked. Filters for overall (games that count), per game, tournament
  and date ranges in the club's time zone; search and alternative sorts.
- `/club/leaderboard`: All-time, per-game and live tournament boards with a “How scoring works”
  panel. The dashboard now previews the real ranked table.

### 11 — Player directory
- `/club/players`: searchable cards for every member with rank, points, games and win rate.
- Profile pages now show the full player card: rank, points, games, wins, losses, win rate,
  current and best streak, recent form, per-game statistics and recent matches. New players
  see empty states rather than invented numbers.

### 12 — Match recording flow
- `/club/matches/new`: pick the game → tap players in finishing order → adjust order/ties →
  live point preview → save. “Same table as last time” restores the previous line-up (a
  browser convenience only). Optional date, notes, and for Poker a private buy-in/cash-out
  record. The save button stays docked above the bottom navigation on phones.
- The browser sends only game, player ids, positions and a submission id generated when the
  form opens (reused on retry). Zod validates on the server before any database call; failures
  show the server's message and never a false success.

### 13 — Transactional persistence
- `record_match` (one transaction): checks the caller's membership, validates every player is
  in the club, positions follow competition ranking, the game belongs to the club, the date
  and notes are sane; picks the club's current scoring version (or the tournament's); writes
  the match, every participant's points, the optional poker ledger and an activity entry.
- Idempotent: the same submission id returns the original match — including when two
  requests race (`on conflict do nothing` + re-read). No points are ever awarded twice.
- Tests prove the SQL awards exactly the points the TypeScript preview shows, and that later
  scoring changes never rewrite earlier matches.
- `/club/matches/[id]` shows the saved result, point breakdown and the rule version used.

### 14 — Bluff
- `/club/games/bluff`: your wins, win rate, average finish and best streak (with the club
  record), the Bluff leaderboard, the most-played Bluff rivalries and recent Bluff games.
- House rules stay flexible: the app records finishing order only, never a fixed ruleset.
- Head-to-head engine (`rivalry.ts`): who finished ahead in shared matches, draws for equal
  finishes, outright wins, per-game split, tournament meetings, recent encounters.
- Built on a reusable `GameHub`, so any game type gets the same section.

### 15 — Poker
- `/club/games/poker`: sessions, wins, win rate, net leaderboard points, form, the Poker board,
  rivalries and history — quick to record (finishing order only, no hand-by-hand logging).
- Whether Poker counts toward the overall board is a per-game club setting (overall + Poker,
  or Poker only) and the page says which applies.
- Optional private session accounting (buy-in / cash-out per player) summarised per player.
  It is clearly labelled, never affects points, and nothing in the app moves money.

### 16 — History and corrections
- `/club/matches`: search plus game, player, tournament and status filters, paged.
- Owners/admins can **void** a match (kept in history with who/when/why, excluded from all
  statistics) or **correct** it (original voided, linked replacement recorded under the
  original scoring version, poker ledger carried over) — atomically, with an audit entry.
  Corrections are idempotent per submission and a failed correction leaves the original intact.
- Completed tournaments are frozen; knockout corrections roll back unplayed later rounds.

### 17 — Rivalries
- `/club/rivalries?a=…&b=…`: pick any two members (defaults to you and your most frequent
  opponent): who finished ahead more often, win share, outright wins, level finishes,
  tournament meetings, per-game breakdown and the latest encounters with links.
- Profiles list each player's regular rivals with the running score and a “Compare with me”
  shortcut. Voided matches never count.
- Stabilised a timing-sensitive recorder test (the retry now waits for the first attempt to settle).

### 18 — Tournaments
- Owners/admins create tournaments (name, description, game, dates, players, format, draft or
  upcoming). Formats: points race, fixed rounds, single-elimination knockout.
- Lifecycle draft → upcoming → in progress → completed, or cancelled; illegal transitions are
  refused in SQL. Players can only change before the start; matches only count while live.
- Knockouts: 2/4/8/16/32 players, seeded (1v8, 4v5, 2v7, 3v6 …) when started. Each pairing
  is recorded from the bracket; results must be between the two paired players with a clear
  winner; the next round is drawn automatically and the final's winner is crowned.

## Known issues

- None yet.

## Deployment status

- Not deployed. See README once milestone 25 lands.
