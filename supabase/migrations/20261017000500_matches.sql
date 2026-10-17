-- Transactional match recording.
--
-- The browser sends: game, participants, finishing positions, optional notes, a
-- client-generated submission id, and (for tournaments) the tournament / bracket slot.
-- The server decides everything else: who is recording, whether they may, which scoring
-- rule version applies, and how many points each player earns.

-- Validates a results payload and returns it as parallel arrays.
create function public.parse_match_results(p_club_id uuid, p_results jsonb)
returns table (profile_ids uuid[], placements integer[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_ids uuid[];
  v_places integer[];
  v_n integer;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array' then
    perform public.raise_app_error('invalid_results', 'Results are missing.');
  end if;
  v_n := jsonb_array_length(p_results);
  if v_n < 2 then
    perform public.raise_app_error('too_few_participants', 'A match needs at least 2 players.');
  end if;
  if v_n > 20 then
    perform public.raise_app_error('too_many_participants', 'A match can have at most 20 players.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_results) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e ->> 'profile_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  ) then
    perform public.raise_app_error('invalid_participant', 'Every result needs a valid player.');
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_results) e
    where jsonb_typeof(e -> 'placement') is distinct from 'number'
       or (e ->> 'placement') !~ '^[0-9]+$'
  ) then
    perform public.raise_app_error('missing_placement', 'Every player needs a finishing position.');
  end if;

  select array_agg((e ->> 'profile_id')::uuid order by ord),
         array_agg((e ->> 'placement')::integer order by ord)
    into v_ids, v_places
  from jsonb_array_elements(p_results) with ordinality as t(e, ord);

  if (select count(distinct x) from unnest(v_ids) x) <> v_n then
    perform public.raise_app_error('duplicate_participant', 'A player can only appear once in a match.');
  end if;
  if exists (select 1 from unnest(v_places) p where p < 1 or p > v_n) then
    perform public.raise_app_error('invalid_placement', 'A finishing position must be between 1 and the number of players.');
  end if;
  -- Competition ranking: position = 1 + number of players who finished ahead.
  if exists (
    select 1 from unnest(v_places) p
    where p <> 1 + (select count(*) from unnest(v_places) q where q < p)
  ) then
    perform public.raise_app_error('invalid_placement_sequence',
      'Positions must follow the finishing order — after a tie, skip the shared places (1, 2, 2, 4).');
  end if;
  if exists (
    select 1 from unnest(v_ids) pid
    where not exists (
      select 1 from public.club_memberships m where m.club_id = p_club_id and m.profile_id = pid
    )
  ) then
    perform public.raise_app_error('invalid_participant', 'Every player must be a member of this club.');
  end if;

  return query select v_ids, v_places;
end;
$$;

-- Shared by record_match and correct_match. Assumes the caller has been authorized.
create function public.insert_match(
  p_actor uuid,
  p_club_id uuid,
  p_game_type_id uuid,
  p_results jsonb,
  p_played_at timestamptz,
  p_notes text,
  p_submission_id uuid,
  p_tournament_id uuid,
  p_bracket_match_id uuid,
  p_ledger jsonb,
  p_scoring_rule_id uuid,
  p_corrects_match_id uuid
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ids uuid[];
  v_places integer[];
  v_game public.game_types%rowtype;
  v_rule public.scoring_rules%rowtype;
  v_tournament public.tournaments%rowtype;
  v_bracket public.tournament_bracket_matches%rowtype;
  v_round integer;
  v_match_id uuid;
  v_played_at timestamptz := coalesce(p_played_at, now());
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if p_submission_id is null then
    perform public.raise_app_error('invalid_submission', 'Missing submission id.');
  end if;

  -- Idempotency: the same submission returns the match it already created.
  select id into v_match_id from public.matches
  where club_id = p_club_id and submission_id = p_submission_id;
  if v_match_id is not null then
    return v_match_id;
  end if;

  select * into v_game from public.game_types where id = p_game_type_id and club_id = p_club_id;
  if not found then
    perform public.raise_app_error('invalid_game', 'That game is not part of this club.');
  end if;
  if v_game.is_archived and p_corrects_match_id is null then
    perform public.raise_app_error('invalid_game', 'That game has been archived.');
  end if;

  if v_played_at > now() + interval '1 day' or v_played_at < timestamptz '2000-01-01' then
    perform public.raise_app_error('invalid_date', 'The match date is not valid.');
  end if;
  if v_notes is not null and char_length(v_notes) > 500 then
    perform public.raise_app_error('invalid_notes', 'Notes can be at most 500 characters.');
  end if;

  select r.profile_ids, r.placements into v_ids, v_places
  from public.parse_match_results(p_club_id, p_results) r;

  -- Tournament rules
  if p_bracket_match_id is not null and p_tournament_id is null then
    perform public.raise_app_error('invalid_tournament', 'A bracket match must belong to a tournament.');
  end if;

  if p_tournament_id is not null then
    select * into v_tournament from public.tournaments
    where id = p_tournament_id and club_id = p_club_id
    for update;
    if not found then
      perform public.raise_app_error('invalid_tournament', 'That tournament is not part of this club.');
    end if;
    if v_tournament.status <> 'in_progress' then
      perform public.raise_app_error('invalid_tournament_state', 'Matches can only be added while a tournament is in progress.');
    end if;
    if v_tournament.game_type_id <> p_game_type_id then
      perform public.raise_app_error('invalid_game', 'This tournament is played with a different game.');
    end if;
    if exists (
      select 1 from unnest(v_ids) pid
      where not exists (
        select 1 from public.tournament_participants tp
        where tp.tournament_id = p_tournament_id and tp.profile_id = pid
      )
    ) then
      perform public.raise_app_error('invalid_participant', 'Every player must be registered in the tournament.');
    end if;

    if v_tournament.format = 'elimination' then
      if p_bracket_match_id is null then
        perform public.raise_app_error('invalid_tournament', 'Pick the bracket match this result belongs to.');
      end if;
      select * into v_bracket from public.tournament_bracket_matches
      where id = p_bracket_match_id and tournament_id = p_tournament_id
      for update;
      if not found then
        perform public.raise_app_error('invalid_tournament', 'That bracket match does not exist.');
      end if;
      if v_bracket.winner_id is not null then
        perform public.raise_app_error('duplicate_result', 'This bracket match already has a result.');
      end if;
      if v_bracket.player_a is null or v_bracket.player_b is null then
        perform public.raise_app_error('invalid_tournament_state', 'This bracket match is still waiting for its players.');
      end if;
      if cardinality(v_ids) <> 2
         or not (v_bracket.player_a = any (v_ids) and v_bracket.player_b = any (v_ids)) then
        perform public.raise_app_error('invalid_participant', 'A bracket result must be between the two paired players.');
      end if;
      if not (1 = any (v_places) and 2 = any (v_places)) then
        perform public.raise_app_error('invalid_placement', 'Elimination matches need a clear winner — no ties.');
      end if;
    elsif p_bracket_match_id is not null then
      perform public.raise_app_error('invalid_tournament', 'Only elimination tournaments have bracket matches.');
    end if;

    if v_tournament.format = 'rounds' then
      select count(*) + 1 into v_round from public.matches
      where tournament_id = p_tournament_id and status = 'confirmed';
      if v_round > v_tournament.round_count then
        perform public.raise_app_error('invalid_tournament_state', 'All rounds of this tournament have been played.');
      end if;
    elsif v_tournament.format = 'elimination' then
      v_round := v_bracket.round;
    end if;
  end if;

  -- Scoring rule: explicit (corrections keep the original version), the tournament's, or
  -- the club's latest version.
  if p_scoring_rule_id is not null then
    select * into v_rule from public.scoring_rules where id = p_scoring_rule_id and club_id = p_club_id;
  elsif p_tournament_id is not null then
    select * into v_rule from public.scoring_rules where id = v_tournament.scoring_rule_id;
  else
    select * into v_rule from public.scoring_rules
    where club_id = p_club_id order by version desc limit 1;
  end if;
  if not found then
    perform public.raise_app_error('invalid_scoring', 'This club has no scoring rules yet.');
  end if;

  insert into public.matches (
    club_id, game_type_id, scoring_rule_id, tournament_id, tournament_round, bracket_match_id,
    played_at, notes, submission_id, created_by, corrects_match_id
  ) values (
    p_club_id, p_game_type_id, v_rule.id, p_tournament_id, v_round, p_bracket_match_id,
    v_played_at, v_notes, p_submission_id, p_actor, p_corrects_match_id
  )
  on conflict (club_id, submission_id) do nothing
  returning id into v_match_id;

  if v_match_id is null then
    -- A concurrent request with the same submission id won the race.
    select id into v_match_id from public.matches
    where club_id = p_club_id and submission_id = p_submission_id;
    return v_match_id;
  end if;

  insert into public.match_participants (match_id, club_id, profile_id, placement, points_awarded)
  select v_match_id, p_club_id, ids.pid, places.p,
         coalesce(v_rule.placement_points[places.p], 0) + v_rule.participation_points
  from unnest(v_ids) with ordinality as ids(pid, i)
  join unnest(v_places) with ordinality as places(p, i) using (i);

  -- Optional private poker ledger (never affects points).
  if p_ledger is not null and jsonb_typeof(p_ledger) = 'array' and jsonb_array_length(p_ledger) > 0 then
    if v_game.kind <> 'poker' then
      perform public.raise_app_error('invalid_ledger', 'Session accounting is only available for Poker.');
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_ledger) e
      where coalesce(e ->> 'profile_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
         or not ((e ->> 'profile_id')::uuid = any (v_ids))
         or coalesce(e ->> 'buy_in', '0') !~ '^[0-9]+(\.[0-9]{1,2})?$'
         or coalesce(e ->> 'cash_out', '0') !~ '^[0-9]+(\.[0-9]{1,2})?$'
    ) then
      perform public.raise_app_error('invalid_ledger', 'Ledger entries must be for players in this session, with amounts like 100 or 99.50.');
    end if;
    insert into public.poker_ledger_entries (match_id, club_id, profile_id, buy_in, cash_out)
    select v_match_id, p_club_id, (e ->> 'profile_id')::uuid,
           coalesce((e ->> 'buy_in')::numeric, 0), coalesce((e ->> 'cash_out')::numeric, 0)
    from jsonb_array_elements(p_ledger) e;
  end if;

  if p_bracket_match_id is not null then
    perform public.advance_bracket(p_bracket_match_id, v_match_id,
      v_ids[array_position(v_places, 1)], p_actor);
  end if;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (
    p_club_id, p_actor,
    case when p_corrects_match_id is null then 'match.recorded' else 'match.corrected' end,
    'match', v_match_id,
    jsonb_build_object('game', v_game.name, 'players', cardinality(v_ids),
                       'winner_ids', to_jsonb(array(select ids.pid from unnest(v_ids) with ordinality ids(pid, i)
                                                    join unnest(v_places) with ordinality pl(p, i) using (i) where pl.p = 1)),
                       'corrects', p_corrects_match_id)
  );

  return v_match_id;
end;
$$;

-- Stub replaced by the tournament migration; kept so this migration is self-contained.
create function public.advance_bracket(p_bracket_match_id uuid, p_match_id uuid, p_winner uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.raise_app_error('not_supported', 'Elimination brackets are not available yet.');
end;
$$;

create function public.record_match(
  p_club_id uuid,
  p_game_type_id uuid,
  p_results jsonb,
  p_submission_id uuid,
  p_played_at timestamptz default null,
  p_notes text default null,
  p_tournament_id uuid default null,
  p_bracket_match_id uuid default null,
  p_ledger jsonb default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
begin
  perform public.require_club_role(p_club_id);
  return public.insert_match(
    v_actor, p_club_id, p_game_type_id, p_results, p_played_at, p_notes, p_submission_id,
    p_tournament_id, p_bracket_match_id, p_ledger, null, null
  );
end;
$$;

revoke execute on function public.parse_match_results(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.insert_match(uuid, uuid, uuid, jsonb, timestamptz, text, uuid, uuid, uuid, jsonb, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.advance_bracket(uuid, uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.record_match(uuid, uuid, jsonb, uuid, timestamptz, text, uuid, uuid, jsonb) to authenticated;
