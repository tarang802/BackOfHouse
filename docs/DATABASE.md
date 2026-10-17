# Database

All persistence lives in Supabase Postgres. The schema, security policies and server-side
functions are version-controlled in `supabase/migrations` and run in filename order.

| Migration | Contents |
| --- | --- |
| `…000100_schema.sql` | Tables, constraints, indexes, `updated_at` trigger |
| `…000200_security.sql` | Row Level Security, authorization helpers, API-role privileges |
| `…000300_avatars.sql` | `avatars` storage bucket + per-user folder policies, avatar URL constraint |
| `…000400_clubs.sql` | `create_club`, `join_club`, invitations, `leave_club` |
| `…000500_matches.sql` | `record_match` (validation, scoring, idempotency, poker ledger) |
| `…000600_corrections.sql` | `void_match`, `correct_match` |
| `…000700_tournaments.sql` | Tournament creation, lifecycle, seeded knockout brackets |
| `…000750_tournament_standings.sql` | Standings and `complete_tournament` |
| `…000800_seasons.sql` | Seasons, standings by club time zone, archiving; adds `matches` and `audit_logs` to the Realtime publication |
| `…000900_admin.sql` | Club settings, scoring versions, games, roles, ownership |

## Tables

```
profiles ──< club_memberships >── clubs ──< club_invitations
                                    │
          ┌─────────────┬──────────┼────────────┬──────────────┐
     game_types   scoring_rules  seasons    tournaments     audit_logs
          │             │                     │   │
          └──────┬──────┘        tournament_participants
                 │                tournament_bracket_matches
              matches ──< match_participants
                 └──────< poker_ledger_entries
```

Key constraints:

- `club_memberships (club_id, profile_id)` primary key — no duplicate memberships; a partial
  unique index allows only one `owner` per club.
- `matches (club_id, submission_id)` unique — the same form submission can never create two
  matches (idempotency).
- `match_participants (match_id, profile_id)` primary key — no duplicate participants.
- `matches_one_per_bracket_slot` — a knockout pairing has at most one confirmed result.
- Composite foreign keys (`game_type_id, club_id`) etc. make it impossible for a match or
  tournament to reference another club's game, rules or tournament.
- `matches_void_consistent` — a voided match always records when and why.

Deletion behaviour: deleting a club cascades to everything it owns. Matches are never
deleted by the app; they are voided. Profiles referenced by match history are protected
(`on delete restrict`), so removing a member keeps their results.

## Security model

- Every table has RLS enabled. Members can `select` their own club's rows; anonymous users
  have no table privileges at all.
- Clients cannot `insert`/`update`/`delete` club data. Writes happen only through the
  functions below, which are `security definer` with a fixed `search_path`, call
  `require_profile()` / `require_club_role()` (using `auth.uid()`), and raise typed errors
  (`hint` = error code) that the app maps to messages.
- The only direct client write is a user's own `profiles` row (column-level grants + RLS).
- `club_invitations` are visible to owners and admins only.
- Email addresses stay in `auth.users`, which the API roles cannot read.

## Client-callable functions

| Function | Who |
| --- | --- |
| `create_club(name, tagline, timezone)` | any signed-in user with a profile |
| `join_club(code)`, `preview_invitation(code)` | any signed-in user with a profile |
| `create_invitation`, `revoke_invitation` | owner, admin |
| `leave_club` | members (not the owner) |
| `record_match(...)` | members |
| `void_match`, `correct_match` | owner, admin |
| `create_tournament`, `update_tournament_participants`, `set_tournament_status`, `complete_tournament` | owner, admin |
| `tournament_standings`, `season_standings` | members |
| `create_season`, `archive_season` | owner, admin |
| `update_club_settings`, `add_game_type`, `update_game_type`, `remove_member` | owner, admin (admins cannot remove admins) |
| `update_scoring_rules`, `set_member_role`, `transfer_ownership` | owner |

## Setting up a database from scratch

### Hosted Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. Install the CLI (`npm i -g supabase` or use `npx supabase`), then:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   `db push` applies every file in `supabase/migrations` in order.
3. Alternatively paste each migration file, in order, into the SQL editor and run it.

### Local Supabase (Docker)

```bash
npx supabase start      # starts Postgres, Auth, Storage locally
npx supabase db reset   # applies all migrations to the local database
```

### Tests without Docker

`npm test` boots PGlite (Postgres compiled to WebAssembly) in-process, applies a small
stand-in for Supabase's `auth` and `storage` schemas (`tests/db/supabase-shim.sql`), then
runs every real migration. The database tests act as specific users under the
`authenticated` role, exactly like PostgREST does in Supabase.
