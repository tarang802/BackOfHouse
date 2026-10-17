-- The Bluff Club — core relational schema.
-- Points are leaderboard points for friendly competition. Nothing here models money
-- except the optional, private poker ledger, which never feeds into points.

-- gen_random_uuid() is built into Postgres 13+, so no extension is required.

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user. Email stays in auth.users and is never copied here.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_url text,
  emblem text not null default 'spade',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  constraint profiles_display_name_length check (char_length(btrim(display_name)) between 1 and 40),
  constraint profiles_emblem_valid check (emblem in ('spade', 'heart', 'diamond', 'club')),
  constraint profiles_avatar_url_length check (avatar_url is null or char_length(avatar_url) <= 500)
);
create unique index profiles_username_key on public.profiles (username);

-- ---------------------------------------------------------------------------
-- Clubs and membership
-- ---------------------------------------------------------------------------
create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tagline text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  playful_titles boolean not null default false,
  legend_points_threshold integer not null default 100,
  -- IANA zone used to decide which calendar day a match belongs to (season boundaries).
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  constraint clubs_timezone_length check (char_length(timezone) between 1 and 64),
  constraint clubs_name_length check (char_length(btrim(name)) between 2 and 60),
  constraint clubs_tagline_length check (tagline is null or char_length(tagline) <= 120),
  constraint clubs_legend_threshold_range check (legend_points_threshold between 10 and 10000)
);

create table public.club_memberships (
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (club_id, profile_id),
  constraint club_memberships_role_valid check (role in ('owner', 'admin', 'member'))
);
create index club_memberships_profile_idx on public.club_memberships (profile_id);
-- Exactly one owner per club is enforced in the functions; at most one here.
create unique index club_memberships_one_owner on public.club_memberships (club_id) where role = 'owner';

create table public.club_invitations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  code text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses integer,
  use_count integer not null default 0,
  revoked_at timestamptz,
  constraint club_invitations_code_format check (code ~ '^[A-Z0-9]{8}$'),
  constraint club_invitations_max_uses_range check (max_uses is null or max_uses between 1 and 100),
  constraint club_invitations_use_count_valid check (use_count >= 0 and (max_uses is null or use_count <= max_uses))
);
create unique index club_invitations_code_key on public.club_invitations (code);
create index club_invitations_club_idx on public.club_invitations (club_id);

-- ---------------------------------------------------------------------------
-- Games and scoring
-- ---------------------------------------------------------------------------
create table public.game_types (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  slug text not null,
  name text not null,
  kind text not null default 'custom',
  counts_toward_overall boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  constraint game_types_slug_format check (slug ~ '^[a-z0-9-]{2,40}$'),
  constraint game_types_name_length check (char_length(btrim(name)) between 2 and 40),
  constraint game_types_kind_valid check (kind in ('bluff', 'poker', 'teen_patti', 'custom')),
  unique (club_id, slug),
  unique (id, club_id)
);

-- Versioned. A new version is inserted whenever the club changes its scoring;
-- matches keep a reference to the version they were scored under.
create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  version integer not null,
  placement_points integer[] not null,
  participation_points integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint scoring_rules_version_positive check (version >= 1),
  constraint scoring_rules_points_length check (cardinality(placement_points) between 1 and 10),
  constraint scoring_rules_participation_range check (participation_points between 0 and 10),
  unique (club_id, version),
  unique (id, club_id)
);

-- ---------------------------------------------------------------------------
-- Seasons
-- ---------------------------------------------------------------------------
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date,
  status text not null default 'active',
  champion_id uuid references public.profiles (id) on delete set null,
  final_standings jsonb,
  archived_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint seasons_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint seasons_status_valid check (status in ('active', 'archived')),
  constraint seasons_dates_ordered check (ends_on is null or ends_on >= starts_on)
);
create unique index seasons_one_active on public.seasons (club_id) where status = 'active';

-- ---------------------------------------------------------------------------
-- Tournaments
-- ---------------------------------------------------------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  game_type_id uuid not null,
  scoring_rule_id uuid not null,
  name text not null,
  description text,
  format text not null default 'points',
  status text not null default 'draft',
  starts_on date not null,
  ends_on date,
  round_count integer,
  champion_id uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (game_type_id, club_id) references public.game_types (id, club_id),
  foreign key (scoring_rule_id, club_id) references public.scoring_rules (id, club_id),
  constraint tournaments_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint tournaments_description_length check (description is null or char_length(description) <= 500),
  constraint tournaments_format_valid check (format in ('points', 'rounds', 'elimination')),
  constraint tournaments_status_valid check (status in ('draft', 'upcoming', 'in_progress', 'completed', 'cancelled')),
  constraint tournaments_dates_ordered check (ends_on is null or ends_on >= starts_on),
  constraint tournaments_rounds_valid check (
    (format = 'rounds' and round_count between 1 and 50) or (format <> 'rounds' and round_count is null)
  ),
  constraint tournaments_champion_only_when_completed check (champion_id is null or status = 'completed'),
  unique (id, club_id)
);
create index tournaments_club_idx on public.tournaments (club_id, status);

create table public.tournament_participants (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  seed integer not null,
  primary key (tournament_id, profile_id),
  unique (tournament_id, seed)
);

create table public.tournament_bracket_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round integer not null,
  slot integer not null,
  player_a uuid references public.profiles (id) on delete restrict,
  player_b uuid references public.profiles (id) on delete restrict,
  winner_id uuid references public.profiles (id) on delete restrict,
  match_id uuid,
  constraint bracket_round_positive check (round >= 1 and slot >= 1),
  constraint bracket_distinct_players check (player_a is null or player_b is null or player_a <> player_b),
  constraint bracket_winner_is_player check (winner_id is null or winner_id = player_a or winner_id = player_b),
  unique (tournament_id, round, slot)
);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  game_type_id uuid not null,
  scoring_rule_id uuid not null,
  tournament_id uuid,
  tournament_round integer,
  bracket_match_id uuid references public.tournament_bracket_matches (id) on delete restrict,
  played_at timestamptz not null default now(),
  notes text,
  status text not null default 'confirmed',
  submission_id uuid not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id) on delete set null,
  void_reason text,
  corrects_match_id uuid references public.matches (id) on delete restrict,
  foreign key (game_type_id, club_id) references public.game_types (id, club_id),
  foreign key (scoring_rule_id, club_id) references public.scoring_rules (id, club_id),
  foreign key (tournament_id, club_id) references public.tournaments (id, club_id),
  constraint matches_status_valid check (status in ('confirmed', 'voided')),
  constraint matches_notes_length check (notes is null or char_length(notes) <= 500),
  constraint matches_void_consistent check (
    (status = 'voided' and voided_at is not null and void_reason is not null)
    or (status = 'confirmed' and voided_at is null)
  ),
  -- Idempotency: replaying the same submission can never create a second match.
  unique (club_id, submission_id)
);
create index matches_club_played_idx on public.matches (club_id, played_at desc);
create index matches_tournament_idx on public.matches (tournament_id) where tournament_id is not null;
create index matches_game_type_idx on public.matches (game_type_id);
-- A bracket pairing can only ever have one confirmed result.
create unique index matches_one_per_bracket_slot on public.matches (bracket_match_id)
  where bracket_match_id is not null and status = 'confirmed';

alter table public.tournament_bracket_matches
  add constraint tournament_bracket_matches_match_fk
  foreign key (match_id) references public.matches (id) on delete set null;

create table public.match_participants (
  match_id uuid not null references public.matches (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  placement integer not null,
  points_awarded integer not null,
  primary key (match_id, profile_id),
  constraint match_participants_placement_range check (placement between 1 and 20)
);
create index match_participants_profile_idx on public.match_participants (club_id, profile_id);

-- Optional private record of a friendly poker session. Kept separate from points.
create table public.poker_ledger_entries (
  match_id uuid not null references public.matches (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  buy_in numeric(10, 2) not null default 0,
  cash_out numeric(10, 2) not null default 0,
  primary key (match_id, profile_id),
  constraint poker_ledger_non_negative check (buy_in >= 0 and cash_out >= 0),
  constraint poker_ledger_reasonable check (buy_in <= 1000000 and cash_out <= 1000000)
);

-- ---------------------------------------------------------------------------
-- Audit log / activity feed. Details must never contain private data (emails etc).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  club_id uuid not null references public.clubs (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_club_idx on public.audit_logs (club_id, created_at desc);

-- updated_at maintenance for profiles
create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();
