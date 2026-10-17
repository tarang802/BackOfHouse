# Architecture

The Bluff Club is a private scorekeeping app for card games played in person.
It records results; it does not run games, take payments or handle money.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Next.js 16 App Router, React 19, Tailwind CSS v4 | Server components keep data fetching on the server; one codebase for phone and desktop |
| Components | shadcn/ui-style primitives in `src/components/ui` (Radix under the hood), Lucide icons | Accessible building blocks we own and can restyle |
| Data | Supabase Postgres + Auth + Storage | Real persistence across devices, RLS for isolation |
| Writes | Server Actions → Postgres functions (RPC) | Validation in TypeScript (zod) *and* SQL; each write is one transaction |
| Tests | Vitest, React Testing Library, PGlite | PGlite runs the real migrations in-process so RLS and SQL functions are tested without Docker |

## Directory layout

```
src/
  app/                 routes (App Router)
    (marketing)/       landing page
    (auth)/            login, signup, password recovery
    onboarding/        profile + club setup
    club/              everything behind membership
  components/
    ui/                design-system primitives
    ...                feature components
  lib/
    domain/            pure business logic: scoring, ranking, stats, tournaments, achievements
    supabase/          server/browser clients and session refresh
    data/              server-only queries that read through RLS
    actions/           server actions (validate -> RPC -> revalidate)
    validation/        zod schemas shared by forms and actions
supabase/
  migrations/          version-controlled SQL (schema, RLS, functions)
tests/
  db/                  PGlite-backed tests of migrations, RLS and RPCs
```

## Trust boundaries

1. **The browser is untrusted.** It sends participant IDs and finishing positions only.
   It never sends point values, user IDs for "who am I", roles, or club membership claims.
2. **Server Actions** validate input shape with zod and resolve the active club from the
   session, then call a Postgres function.
3. **Postgres functions** (`security definer`, fixed `search_path`) re-check membership and
   role using `auth.uid()`, validate placements, compute points from the club's scoring
   rule *version*, and write all rows in one transaction.
4. **Row Level Security** makes every table readable only by members of the owning club.
   Direct inserts/updates from clients are denied except for a user's own profile row.

## Scoring model

- A club has versioned scoring rules (`placement_points`, e.g. `{3,1}` → 1st = 3, 2nd = 1,
  everyone else 0). Changing the rules creates a new version; old matches keep the version
  they were scored under.
- Ties use standard competition ranking (1, 2, 2, 4). Tied players each receive the points
  for the shared position. A shared first place counts as a win for each tied player.
- Each game type decides whether it counts toward the overall leaderboard.
- Points are stored per participant at the moment a match is recorded (`points_awarded`)
  together with the rule version, so history never silently changes.

## Derived statistics

Wins, losses, streaks, head-to-head records and achievements are computed from confirmed
match records by pure functions in `src/lib/domain`. Voiding or correcting a match changes
the inputs, so every statistic updates consistently without counter drift.
