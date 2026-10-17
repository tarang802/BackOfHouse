-- Voiding and correcting matches. Matches are never deleted: a voided match stays in
-- history with who voided it and why, and a correction is a new match that points at the
-- one it replaces. All statistics are derived from confirmed matches only, so both
-- operations update every leaderboard and stat consistently.

-- Shared checks + the void itself. Caller must hold the row lock on the match.
create function public.void_match_internal(p_match public.matches, p_actor uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_t public.tournaments%rowtype;
  v_slot public.tournament_bracket_matches%rowtype;
begin
  if p_match.status <> 'confirmed' then
    perform public.raise_app_error('invalid_match_state', 'This match has already been voided.');
  end if;

  if p_match.tournament_id is not null then
    select * into v_t from public.tournaments where id = p_match.tournament_id for update;
    if v_t.status = 'completed' then
      perform public.raise_app_error('invalid_tournament_state',
        'This tournament is complete, so its results are final.');
    end if;
  end if;

  if p_match.bracket_match_id is not null then
    select * into v_slot from public.tournament_bracket_matches where id = p_match.bracket_match_id for update;
    if exists (
      select 1 from public.tournament_bracket_matches
      where tournament_id = v_slot.tournament_id and round > v_slot.round and winner_id is not null
    ) then
      perform public.raise_app_error('invalid_tournament_state',
        'Later bracket rounds already have results. Correct those first.');
    end if;
    -- Unplayed later rounds were generated from this result; drop them so they are
    -- regenerated once this round is complete again.
    delete from public.tournament_bracket_matches
    where tournament_id = v_slot.tournament_id and round > v_slot.round;
    update public.tournament_bracket_matches set winner_id = null, match_id = null where id = v_slot.id;
  end if;

  update public.matches
     set status = 'voided', voided_at = now(), voided_by = p_actor, void_reason = p_reason
   where id = p_match.id;
end;
$$;

create function public.validate_reason(p_reason text) returns text
language plpgsql immutable as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if char_length(v_reason) < 3 or char_length(v_reason) > 200 then
    perform public.raise_app_error('invalid_reason', 'Give a short reason (3 to 200 characters).');
  end if;
  return v_reason;
end;
$$;

create function public.void_match(p_match_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_match public.matches%rowtype;
  v_reason text := public.validate_reason(p_reason);
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or not public.is_club_member(v_match.club_id) then
    perform public.raise_app_error('not_found', 'Match not found.');
  end if;
  perform public.require_club_role(v_match.club_id, true);
  perform public.void_match_internal(v_match, v_actor, v_reason);
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_match.club_id, v_actor, 'match.voided', 'match', p_match_id, jsonb_build_object('reason', v_reason));
end;
$$;

-- Replace a match's results. Keeps the original game, date, tournament and scoring-rule
-- version unless a new date/notes are supplied; returns the new match id.
create function public.correct_match(
  p_match_id uuid,
  p_results jsonb,
  p_reason text,
  p_submission_id uuid,
  p_played_at timestamptz default null,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_match public.matches%rowtype;
  v_reason text := public.validate_reason(p_reason);
  v_existing uuid;
  v_new_id uuid;
  v_ledger jsonb;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found or not public.is_club_member(v_match.club_id) then
    perform public.raise_app_error('not_found', 'Match not found.');
  end if;
  perform public.require_club_role(v_match.club_id, true);

  -- Replayed correction: return the replacement already created.
  select id into v_existing from public.matches
  where club_id = v_match.club_id and submission_id = p_submission_id;
  if v_existing is not null then
    return v_existing;
  end if;

  perform public.void_match_internal(v_match, v_actor, 'Corrected: ' || v_reason);

  -- Carry over any poker ledger rows for players who are still in the corrected result.
  if jsonb_typeof(p_results) = 'array' then
    select jsonb_agg(jsonb_build_object(
             'profile_id', l.profile_id, 'buy_in', l.buy_in::text, 'cash_out', l.cash_out::text))
      into v_ledger
    from public.poker_ledger_entries l
    where l.match_id = p_match_id
      and l.profile_id::text in (select e ->> 'profile_id' from jsonb_array_elements(p_results) e);
  end if;

  v_new_id := public.insert_match(
    v_actor, v_match.club_id, v_match.game_type_id, p_results,
    coalesce(p_played_at, v_match.played_at),
    coalesce(p_notes, v_match.notes),
    p_submission_id, v_match.tournament_id, v_match.bracket_match_id,
    v_ledger, v_match.scoring_rule_id, v_match.id
  );
  return v_new_id;
end;
$$;

revoke execute on function public.void_match_internal(public.matches, uuid, text) from public, anon, authenticated;
revoke execute on function public.validate_reason(text) from public, anon, authenticated;
grant execute on function public.void_match(uuid, text) to authenticated;
grant execute on function public.correct_match(uuid, jsonb, text, uuid, timestamptz, text) to authenticated;
