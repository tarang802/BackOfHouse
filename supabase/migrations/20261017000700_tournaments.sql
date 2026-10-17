-- Tournaments: creation, lifecycle, elimination brackets and completion.

create function public.validate_tournament_players(p_club_id uuid, p_format text, p_ids uuid[])
returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_n integer := coalesce(cardinality(p_ids), 0);
begin
  if v_n < 2 or v_n > 32 then
    perform public.raise_app_error('invalid_participants', 'Tournaments need between 2 and 32 players.');
  end if;
  if (select count(distinct x) from unnest(p_ids) x) <> v_n then
    perform public.raise_app_error('duplicate_participant', 'A player can only be registered once.');
  end if;
  if exists (
    select 1 from unnest(p_ids) pid
    where not exists (select 1 from public.club_memberships m where m.club_id = p_club_id and m.profile_id = pid)
  ) then
    perform public.raise_app_error('invalid_participant', 'Every player must be a member of this club.');
  end if;
  if p_format = 'elimination' and (v_n & (v_n - 1)) <> 0 then
    perform public.raise_app_error('invalid_participants',
      'Elimination brackets need 2, 4, 8, 16 or 32 players.');
  end if;
end;
$$;

create function public.create_tournament(
  p_club_id uuid,
  p_name text,
  p_description text,
  p_game_type_id uuid,
  p_format text,
  p_starts_on date,
  p_ends_on date,
  p_round_count integer,
  p_participant_ids uuid[],
  p_status text default 'draft'
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_rule_id uuid;
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_description text := nullif(btrim(coalesce(p_description, '')), '');
begin
  perform public.require_club_role(p_club_id, true);
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    perform public.raise_app_error('invalid_name', 'Tournament names must be 2 to 80 characters.');
  end if;
  if v_description is not null and char_length(v_description) > 500 then
    perform public.raise_app_error('invalid_description', 'Descriptions can be at most 500 characters.');
  end if;
  if p_format not in ('points', 'rounds', 'elimination') then
    perform public.raise_app_error('invalid_format', 'Choose a points, rounds or elimination format.');
  end if;
  if p_status not in ('draft', 'upcoming') then
    perform public.raise_app_error('invalid_tournament_state', 'New tournaments start as a draft or upcoming.');
  end if;
  if p_starts_on is null or (p_ends_on is not null and p_ends_on < p_starts_on) then
    perform public.raise_app_error('invalid_date', 'The end date must be on or after the start date.');
  end if;
  if p_format = 'rounds' and (p_round_count is null or p_round_count < 1 or p_round_count > 50) then
    perform public.raise_app_error('invalid_rounds', 'A rounds tournament needs between 1 and 50 rounds.');
  end if;
  if not exists (
    select 1 from public.game_types where id = p_game_type_id and club_id = p_club_id and not is_archived
  ) then
    perform public.raise_app_error('invalid_game', 'That game is not part of this club.');
  end if;
  perform public.validate_tournament_players(p_club_id, p_format, p_participant_ids);

  select id into v_rule_id from public.scoring_rules where club_id = p_club_id order by version desc limit 1;

  insert into public.tournaments (
    club_id, game_type_id, scoring_rule_id, name, description, format, status,
    starts_on, ends_on, round_count, created_by
  ) values (
    p_club_id, p_game_type_id, v_rule_id, v_name, v_description, p_format, p_status,
    p_starts_on, p_ends_on, case when p_format = 'rounds' then p_round_count end, v_actor
  ) returning id into v_id;

  insert into public.tournament_participants (tournament_id, profile_id, seed)
  select v_id, pid, i from unnest(p_participant_ids) with ordinality as t(pid, i);

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'tournament.created', 'tournament', v_id, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create function public.update_tournament_participants(p_tournament_id uuid, p_participant_ids uuid[])
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_t public.tournaments%rowtype;
begin
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or not public.is_club_member(v_t.club_id) then
    perform public.raise_app_error('not_found', 'Tournament not found.');
  end if;
  perform public.require_club_role(v_t.club_id, true);
  if v_t.status not in ('draft', 'upcoming') then
    perform public.raise_app_error('invalid_tournament_state', 'Players can only be changed before the tournament starts.');
  end if;
  perform public.validate_tournament_players(v_t.club_id, v_t.format, p_participant_ids);
  delete from public.tournament_participants where tournament_id = p_tournament_id;
  insert into public.tournament_participants (tournament_id, profile_id, seed)
  select p_tournament_id, pid, i from unnest(p_participant_ids) with ordinality as t(pid, i);
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_t.club_id, v_actor, 'tournament.participants_updated', 'tournament', p_tournament_id,
          jsonb_build_object('players', cardinality(p_participant_ids)));
end;
$$;

-- Standard seed order, e.g. 8 -> {1,8,4,5,2,7,3,6}.
create function public.bracket_seed_order(p_n integer) returns integer[]
language plpgsql immutable as $$
declare
  v_order integer[] := array[1, 2];
  v_next integer[];
  v_size integer;
  s integer;
begin
  while cardinality(v_order) < p_n loop
    v_size := cardinality(v_order) * 2;
    v_next := array[]::integer[];
    foreach s in array v_order loop
      v_next := v_next || s || (v_size + 1 - s);
    end loop;
    v_order := v_next;
  end loop;
  return v_order;
end;
$$;

create function public.set_tournament_status(p_tournament_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_t public.tournaments%rowtype;
  v_seeded uuid[];
  v_order integer[];
  v_n integer;
begin
  select * into v_t from public.tournaments where id = p_tournament_id for update;
  if not found or not public.is_club_member(v_t.club_id) then
    perform public.raise_app_error('not_found', 'Tournament not found.');
  end if;
  perform public.require_club_role(v_t.club_id, true);

  if not (
    (v_t.status = 'draft' and p_status in ('upcoming', 'in_progress', 'cancelled'))
    or (v_t.status = 'upcoming' and p_status in ('in_progress', 'cancelled'))
    or (v_t.status = 'in_progress' and p_status = 'cancelled')
  ) then
    perform public.raise_app_error('invalid_tournament_state',
      format('A tournament cannot move from %s to %s.', replace(v_t.status, '_', ' '), replace(p_status, '_', ' ')));
  end if;

  if p_status = 'in_progress' and v_t.format = 'elimination' then
    select array_agg(profile_id order by seed) into v_seeded
    from public.tournament_participants where tournament_id = p_tournament_id;
    v_n := coalesce(cardinality(v_seeded), 0);
    perform public.validate_tournament_players(v_t.club_id, 'elimination', v_seeded);
    v_order := public.bracket_seed_order(v_n);
    insert into public.tournament_bracket_matches (tournament_id, round, slot, player_a, player_b)
    select p_tournament_id, 1, (i + 1) / 2, v_seeded[v_order[i]], v_seeded[v_order[i + 1]]
    from generate_series(1, v_n, 2) as i;
  end if;

  update public.tournaments set status = p_status where id = p_tournament_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_t.club_id, v_actor, 'tournament.' || p_status, 'tournament', p_tournament_id,
          jsonb_build_object('name', v_t.name));
end;
$$;

-- Called inside insert_match after an elimination result is stored.
create or replace function public.advance_bracket(p_bracket_match_id uuid, p_match_id uuid, p_winner uuid, p_actor uuid)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_slot public.tournament_bracket_matches%rowtype;
  v_t public.tournaments%rowtype;
  v_round_size integer;
begin
  update public.tournament_bracket_matches
     set winner_id = p_winner, match_id = p_match_id
   where id = p_bracket_match_id
  returning * into v_slot;

  select * into v_t from public.tournaments where id = v_slot.tournament_id;

  select count(*) into v_round_size from public.tournament_bracket_matches
  where tournament_id = v_slot.tournament_id and round = v_slot.round;

  if exists (
    select 1 from public.tournament_bracket_matches
    where tournament_id = v_slot.tournament_id and round = v_slot.round and winner_id is null
  ) then
    return; -- round still in progress
  end if;

  if v_round_size = 1 then
    update public.tournaments
       set status = 'completed', champion_id = p_winner, completed_at = now()
     where id = v_slot.tournament_id;
    insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
    values (v_t.club_id, p_actor, 'tournament.completed', 'tournament', v_t.id,
            jsonb_build_object('name', v_t.name, 'champion_id', p_winner));
    return;
  end if;

  -- Winners of slots 2k-1 and 2k meet in slot k of the next round.
  insert into public.tournament_bracket_matches (tournament_id, round, slot, player_a, player_b)
  select v_slot.tournament_id, v_slot.round + 1, (a.slot + 1) / 2, a.winner_id, b.winner_id
  from public.tournament_bracket_matches a
  join public.tournament_bracket_matches b
    on b.tournament_id = a.tournament_id and b.round = a.round and b.slot = a.slot + 1
  where a.tournament_id = v_slot.tournament_id and a.round = v_slot.round and a.slot % 2 = 1;
end;
$$;

revoke execute on function public.validate_tournament_players(uuid, text, uuid[]) from public, anon, authenticated;
revoke execute on function public.advance_bracket(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.bracket_seed_order(integer) to authenticated;
grant execute on function public.create_tournament(uuid, text, text, uuid, text, date, date, integer, uuid[], text) to authenticated;
grant execute on function public.update_tournament_participants(uuid, uuid[]) to authenticated;
grant execute on function public.set_tournament_status(uuid, text) to authenticated;
