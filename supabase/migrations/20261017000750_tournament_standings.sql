-- Tournament standings and completion for points / rounds formats.
-- Elimination tournaments complete automatically in advance_bracket.

-- Points per player in a points/rounds tournament, ranked (points, then wins).
create function public.tournament_standings(p_tournament_id uuid)
returns table (profile_id uuid, points bigint, wins bigint, played bigint, rank bigint)
language sql stable security definer set search_path = public, pg_temp as $$
  with totals as (
    select tp.profile_id,
           coalesce(sum(x.points_awarded), 0) as points,
           count(*) filter (where x.placement = 1) as wins,
           count(x.placement) as played
    from public.tournament_participants tp
    left join lateral (
      select mp.points_awarded, mp.placement
      from public.match_participants mp
      join public.matches m on m.id = mp.match_id
      where m.tournament_id = tp.tournament_id and m.status = 'confirmed' and mp.profile_id = tp.profile_id
    ) x on true
    where tp.tournament_id = p_tournament_id
    group by tp.profile_id
  )
  select profile_id, points, wins, played, rank() over (order by points desc, wins desc)
  from totals
  where public.is_club_member((select club_id from public.tournaments where id = p_tournament_id));
$$;

create function public.complete_tournament(p_tournament_id uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_t public.tournaments%rowtype;
  v_played integer;
  v_leaders uuid[];
begin
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or not public.is_club_member(v_t.club_id) then
    perform public.raise_app_error('not_found', 'Tournament not found.');
  end if;
  perform public.require_club_role(v_t.club_id, true);

  if v_t.status = 'completed' then
    return v_t.champion_id;
  end if;
  if v_t.status <> 'in_progress' then
    perform public.raise_app_error('invalid_tournament_state', 'Only a tournament in progress can be completed.');
  end if;
  if v_t.format = 'elimination' then
    perform public.raise_app_error('invalid_tournament_state',
      'Elimination tournaments finish automatically when the final is recorded.');
  end if;

  select count(*) into v_played from public.matches where tournament_id = p_tournament_id and status = 'confirmed';
  if v_played = 0 then
    perform public.raise_app_error('invalid_tournament_state', 'Record at least one match before completing the tournament.');
  end if;
  if v_t.format = 'rounds' and v_played < v_t.round_count then
    perform public.raise_app_error('invalid_tournament_state',
      format('All %s rounds must be played first (%s recorded).', v_t.round_count, v_played));
  end if;

  select array_agg(s.profile_id) into v_leaders
  from public.tournament_standings(p_tournament_id) s where s.rank = 1;
  if cardinality(v_leaders) <> 1 then
    perform public.raise_app_error('tied_for_first',
      'Players are tied for first on points and wins. Play a deciding match first.');
  end if;

  update public.tournaments
     set status = 'completed', champion_id = v_leaders[1], completed_at = now()
   where id = p_tournament_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_t.club_id, v_actor, 'tournament.completed', 'tournament', p_tournament_id,
          jsonb_build_object('name', v_t.name, 'champion_id', v_leaders[1]));
  return v_leaders[1];
end;
$$;

grant execute on function public.tournament_standings(uuid) to authenticated;
grant execute on function public.complete_tournament(uuid) to authenticated;
