-- Row Level Security and authorization helpers.
--
-- Model: every club-owned row is readable only by members of that club. Clients never
-- write club data directly — all writes go through security-definer functions that
-- re-check membership and role with auth.uid(). The only direct client write allowed is
-- a user editing their own profile row.

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can call them without recursing into RLS)
-- ---------------------------------------------------------------------------
create function public.club_role(p_club_id uuid) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.club_memberships
  where club_id = p_club_id and profile_id = auth.uid();
$$;

create function public.is_club_member(p_club_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.club_memberships
    where club_id = p_club_id and profile_id = auth.uid()
  );
$$;

create function public.is_club_admin(p_club_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(public.club_role(p_club_id) in ('owner', 'admin'), false);
$$;

create function public.shares_club_with(p_profile_id uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1
    from public.club_memberships mine
    join public.club_memberships theirs on theirs.club_id = mine.club_id
    where mine.profile_id = auth.uid() and theirs.profile_id = p_profile_id
  );
$$;

-- Raise a typed, user-safe error. The code prefix lets the app map errors to messages.
create function public.raise_app_error(p_code text, p_message text) returns void
language plpgsql as $$
begin
  raise exception '%', p_message using errcode = 'P0001', hint = p_code;
end;
$$;

-- Require a signed-in user with a profile; returns their id.
create function public.require_profile() returns uuid
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    perform public.raise_app_error('unauthenticated', 'You need to sign in first.');
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    perform public.raise_app_error('profile_required', 'Create your player profile first.');
  end if;
  return v_uid;
end;
$$;

-- Require membership (optionally an admin role) in a club; returns the caller's role.
create function public.require_club_role(p_club_id uuid, p_admin boolean default false) returns text
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_role text;
begin
  perform public.require_profile();
  v_role := public.club_role(p_club_id);
  if v_role is null then
    -- Same message whether the club exists or not, so IDs cannot be probed.
    perform public.raise_app_error('forbidden', 'You are not a member of this club.');
  end if;
  if p_admin and v_role not in ('owner', 'admin') then
    perform public.raise_app_error('forbidden', 'Only the club owner or an admin can do that.');
  end if;
  return v_role;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_invitations enable row level security;
alter table public.game_types enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.seasons enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_bracket_matches enable row level security;
alter table public.matches enable row level security;
alter table public.match_participants enable row level security;
alter table public.poker_ledger_entries enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Profiles: see yourself and people you share a club with; edit only yourself.
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_club_with(id));

create policy profiles_insert_self on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Club data: members read, nobody writes directly.
-- ---------------------------------------------------------------------------
create policy clubs_select on public.clubs for select to authenticated
  using (public.is_club_member(id));

create policy club_memberships_select on public.club_memberships for select to authenticated
  using (public.is_club_member(club_id));

-- Invitation codes are only visible to people who can manage them.
create policy club_invitations_select on public.club_invitations for select to authenticated
  using (public.is_club_admin(club_id));

create policy game_types_select on public.game_types for select to authenticated
  using (public.is_club_member(club_id));

create policy scoring_rules_select on public.scoring_rules for select to authenticated
  using (public.is_club_member(club_id));

create policy seasons_select on public.seasons for select to authenticated
  using (public.is_club_member(club_id));

create policy tournaments_select on public.tournaments for select to authenticated
  using (public.is_club_member(club_id));

create policy tournament_participants_select on public.tournament_participants for select to authenticated
  using (exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and public.is_club_member(t.club_id)
  ));

create policy tournament_bracket_matches_select on public.tournament_bracket_matches for select to authenticated
  using (exists (
    select 1 from public.tournaments t
    where t.id = tournament_id and public.is_club_member(t.club_id)
  ));

create policy matches_select on public.matches for select to authenticated
  using (public.is_club_member(club_id));

create policy match_participants_select on public.match_participants for select to authenticated
  using (public.is_club_member(club_id));

create policy poker_ledger_entries_select on public.poker_ledger_entries for select to authenticated
  using (public.is_club_member(club_id));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (public.is_club_member(club_id));

-- ---------------------------------------------------------------------------
-- Privileges. Anonymous visitors get nothing. Authenticated users may read (RLS filters
-- rows) and may only insert/update their own profile.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant insert (id, username, display_name, avatar_url, emblem) on public.profiles to authenticated;
grant update (username, display_name, avatar_url, emblem) on public.profiles to authenticated;

-- Supabase grants new functions to the API roles by default; take that back and grant
-- only what clients may call.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.club_role(uuid) to authenticated;
grant execute on function public.is_club_member(uuid) to authenticated;
grant execute on function public.is_club_admin(uuid) to authenticated;
grant execute on function public.shares_club_with(uuid) to authenticated;

-- Functions created by later migrations are not executable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
