-- Seasons. A season is a named date range over the overall leaderboard. Ending a season
-- archives a snapshot of its final standings; match history itself is never touched.

create function public.create_season(p_club_id uuid, p_name text, p_starts_on date, p_ends_on date default null)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  perform public.require_club_role(p_club_id, true);
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    perform public.raise_app_error('invalid_name', 'Season names must be 2 to 80 characters.');
  end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on < p_starts_on) then
    perform public.raise_app_error('invalid_date', 'The end date must be on or after the start date.');
  end if;
  if exists (select 1 from public.seasons where club_id = p_club_id and status = 'active') then
    perform public.raise_app_error('season_active', 'End the current season before starting a new one.');
  end if;
  insert into public.seasons (club_id, name, starts_on, ends_on, created_by)
  values (p_club_id, v_name, p_starts_on, p_ends_on, v_actor)
  returning id into v_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'season.started', 'season', v_id, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

-- Standings for a date range in the club's time zone, overall-counting games only.
create function public.season_standings(p_season_id uuid)
returns table (profile_id uuid, points bigint, wins bigint, played bigint, rank bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with s as (
    select se.*, c.timezone from public.seasons se join public.clubs c on c.id = se.club_id
    where se.id = p_season_id and public.is_club_member(se.club_id)
  ),
  totals as (
    select mp.profile_id,
           sum(mp.points_awarded) as points,
           count(*) filter (where mp.placement = 1) as wins,
           count(*) as played
    from s
    join public.matches m on m.club_id = s.club_id and m.status = 'confirmed'
    join public.game_types g on g.id = m.game_type_id and g.counts_toward_overall
    join public.match_participants mp on mp.match_id = m.id
    where (m.played_at at time zone s.timezone)::date >= s.starts_on
      and (s.ends_on is null or (m.played_at at time zone s.timezone)::date <= s.ends_on)
    group by mp.profile_id
  )
  select profile_id, points, wins, played, rank() over (order by points desc, wins desc) from totals;
$$;

create function public.archive_season(p_season_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_season public.seasons%rowtype;
  v_today date;
  v_snapshot jsonb;
  v_leaders uuid[];
  v_champion uuid;
begin
  select * into v_season from public.seasons where id = p_season_id for update;
  if not found or not public.is_club_member(v_season.club_id) then
    perform public.raise_app_error('not_found', 'Season not found.');
  end if;
  perform public.require_club_role(v_season.club_id, true);
  if v_season.status = 'archived' then
    return v_season.champion_id;
  end if;

  select (now() at time zone c.timezone)::date into v_today from public.clubs c where c.id = v_season.club_id;
  if v_season.ends_on is null or v_season.ends_on > v_today then
    update public.seasons set ends_on = greatest(v_today, starts_on) where id = p_season_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'profile_id', s.profile_id, 'display_name', p.display_name, 'username', p.username,
           'points', s.points, 'wins', s.wins, 'played', s.played, 'rank', s.rank
         ) order by s.rank, p.display_name), '[]'::jsonb),
         array_agg(s.profile_id) filter (where s.rank = 1)
    into v_snapshot, v_leaders
  from public.season_standings(p_season_id) s
  join public.profiles p on p.id = s.profile_id;

  -- A shared first place leaves the champion empty; the snapshot shows the tie.
  if cardinality(v_leaders) = 1 then
    v_champion := v_leaders[1];
  end if;

  update public.seasons
     set status = 'archived', archived_at = now(), final_standings = v_snapshot, champion_id = v_champion
   where id = p_season_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_season.club_id, v_actor, 'season.archived', 'season', p_season_id,
          jsonb_build_object('name', v_season.name, 'champion_id', v_champion));
  return v_champion;
end;
$$;

grant execute on function public.create_season(uuid, text, date, date) to authenticated;
grant execute on function public.season_standings(uuid) to authenticated;
grant execute on function public.archive_season(uuid) to authenticated;

-- Realtime: members receive change events for their own club's matches and activity
-- (Realtime applies the same RLS policies), so open pages refresh when results change.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.matches, public.audit_logs;
  end if;
end;
$$;
