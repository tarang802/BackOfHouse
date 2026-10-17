-- Club administration: settings, scoring versions, games and membership.
-- Owner-only: scoring rules, roles, ownership transfer.
-- Owner or admin: club settings, games, removing regular members.

create function public.update_club_settings(
  p_club_id uuid,
  p_name text,
  p_tagline text,
  p_playful_titles boolean,
  p_legend_points_threshold integer,
  p_timezone text
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_name text := btrim(coalesce(p_name, ''));
  v_tagline text := nullif(btrim(coalesce(p_tagline, '')), '');
begin
  perform public.require_club_role(p_club_id, true);
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    perform public.raise_app_error('invalid_name', 'Club names must be 2 to 60 characters.');
  end if;
  if v_tagline is not null and char_length(v_tagline) > 120 then
    perform public.raise_app_error('invalid_tagline', 'Taglines can be at most 120 characters.');
  end if;
  if p_legend_points_threshold is null or p_legend_points_threshold < 10 or p_legend_points_threshold > 10000 then
    perform public.raise_app_error('invalid_threshold', 'The legend milestone must be between 10 and 10,000 points.');
  end if;
  if not exists (select 1 from pg_timezone_names where name = p_timezone) then
    perform public.raise_app_error('invalid_timezone', 'Choose a valid time zone.');
  end if;
  update public.clubs
     set name = v_name, tagline = v_tagline, playful_titles = coalesce(p_playful_titles, false),
         legend_points_threshold = p_legend_points_threshold, timezone = p_timezone
   where id = p_club_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'club.settings_updated', 'club', p_club_id, '{}'::jsonb);
end;
$$;

create function public.update_scoring_rules(p_club_id uuid, p_placement_points integer[], p_participation_points integer)
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_role text := public.require_club_role(p_club_id);
  v_version integer;
  v_n integer := coalesce(cardinality(p_placement_points), 0);
begin
  if v_role <> 'owner' then
    perform public.raise_app_error('forbidden', 'Only the club owner can change scoring.');
  end if;
  if v_n < 1 or v_n > 10 then
    perform public.raise_app_error('invalid_scoring', 'Award points for between 1 and 10 places.');
  end if;
  if exists (select 1 from unnest(p_placement_points) p where p is null or p < 0 or p > 100) then
    perform public.raise_app_error('invalid_scoring', 'Points per place must be whole numbers from 0 to 100.');
  end if;
  if exists (select 1 from generate_series(2, v_n) i where p_placement_points[i] > p_placement_points[i - 1]) then
    perform public.raise_app_error('invalid_scoring', 'A lower finish cannot earn more points than a higher one.');
  end if;
  if p_placement_points[1] = 0 then
    perform public.raise_app_error('invalid_scoring', 'First place must earn at least one point.');
  end if;
  if p_participation_points is null or p_participation_points < 0 or p_participation_points > 10 then
    perform public.raise_app_error('invalid_scoring', 'Participation points must be from 0 to 10.');
  end if;

  -- Serialize concurrent edits so versions stay gapless.
  perform 1 from public.clubs where id = p_club_id for update;
  select coalesce(max(version), 0) + 1 into v_version from public.scoring_rules where club_id = p_club_id;
  insert into public.scoring_rules (club_id, version, placement_points, participation_points, created_by)
  values (p_club_id, v_version, p_placement_points, p_participation_points, v_actor);
  insert into public.audit_logs (club_id, actor_id, action, entity_type, details)
  values (p_club_id, v_actor, 'scoring.updated', 'scoring_rule',
          jsonb_build_object('version', v_version, 'placement_points', to_jsonb(p_placement_points),
                             'participation_points', p_participation_points));
  return v_version;
end;
$$;

create function public.add_game_type(p_club_id uuid, p_name text, p_counts_toward_overall boolean default true)
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_name text := btrim(coalesce(p_name, ''));
  v_slug text;
  v_id uuid;
begin
  perform public.require_club_role(p_club_id, true);
  if char_length(v_name) < 2 or char_length(v_name) > 40 then
    perform public.raise_app_error('invalid_name', 'Game names must be 2 to 40 characters.');
  end if;
  v_slug := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if char_length(v_slug) < 2 then
    perform public.raise_app_error('invalid_name', 'Use letters or numbers in the game name.');
  end if;
  v_slug := left(v_slug, 40);
  if exists (select 1 from public.game_types where club_id = p_club_id and slug = v_slug) then
    perform public.raise_app_error('duplicate_game', 'This club already has a game with that name.');
  end if;
  if (select count(*) from public.game_types where club_id = p_club_id) >= 30 then
    perform public.raise_app_error('limit_reached', 'A club can track at most 30 games.');
  end if;
  insert into public.game_types (club_id, slug, name, kind, counts_toward_overall)
  values (p_club_id, v_slug, v_name, 'custom', coalesce(p_counts_toward_overall, true))
  returning id into v_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'game.added', 'game_type', v_id, jsonb_build_object('name', v_name));
  return v_id;
end;
$$;

create function public.update_game_type(p_game_type_id uuid, p_counts_toward_overall boolean, p_is_archived boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_game public.game_types%rowtype;
begin
  select * into v_game from public.game_types where id = p_game_type_id;
  if not found or not public.is_club_member(v_game.club_id) then
    perform public.raise_app_error('not_found', 'Game not found.');
  end if;
  perform public.require_club_role(v_game.club_id, true);
  update public.game_types
     set counts_toward_overall = coalesce(p_counts_toward_overall, counts_toward_overall),
         is_archived = coalesce(p_is_archived, is_archived)
   where id = p_game_type_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_game.club_id, v_actor, 'game.updated', 'game_type', p_game_type_id,
          jsonb_build_object('name', v_game.name, 'counts_toward_overall', p_counts_toward_overall,
                             'archived', p_is_archived));
end;
$$;

create function public.set_member_role(p_club_id uuid, p_profile_id uuid, p_role text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_role text := public.require_club_role(p_club_id);
  v_target_role text;
begin
  if v_role <> 'owner' then
    perform public.raise_app_error('forbidden', 'Only the club owner can change roles.');
  end if;
  if p_role not in ('admin', 'member') then
    perform public.raise_app_error('invalid_role', 'Roles can be admin or member.');
  end if;
  select role into v_target_role from public.club_memberships where club_id = p_club_id and profile_id = p_profile_id;
  if v_target_role is null then
    perform public.raise_app_error('not_found', 'That player is not in this club.');
  end if;
  if v_target_role = 'owner' then
    perform public.raise_app_error('forbidden', 'Use ownership transfer to change the owner.');
  end if;
  update public.club_memberships set role = p_role where club_id = p_club_id and profile_id = p_profile_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'member.role_changed', 'profile', p_profile_id, jsonb_build_object('role', p_role));
end;
$$;

create function public.remove_member(p_club_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_role text := public.require_club_role(p_club_id, true);
  v_target_role text;
begin
  select role into v_target_role from public.club_memberships where club_id = p_club_id and profile_id = p_profile_id;
  if v_target_role is null then
    perform public.raise_app_error('not_found', 'That player is not in this club.');
  end if;
  if p_profile_id = v_actor then
    perform public.raise_app_error('forbidden', 'Use “leave club” to remove yourself.');
  end if;
  if v_target_role = 'owner' or (v_role = 'admin' and v_target_role = 'admin') then
    perform public.raise_app_error('forbidden', 'You cannot remove that member.');
  end if;
  delete from public.club_memberships where club_id = p_club_id and profile_id = p_profile_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'member.removed', 'profile', p_profile_id, '{}'::jsonb);
end;
$$;

create function public.transfer_ownership(p_club_id uuid, p_profile_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_role text := public.require_club_role(p_club_id);
begin
  if v_role <> 'owner' then
    perform public.raise_app_error('forbidden', 'Only the club owner can transfer ownership.');
  end if;
  if p_profile_id = v_actor then
    perform public.raise_app_error('invalid_role', 'You already own this club.');
  end if;
  if not exists (select 1 from public.club_memberships where club_id = p_club_id and profile_id = p_profile_id) then
    perform public.raise_app_error('not_found', 'That player is not in this club.');
  end if;
  update public.club_memberships set role = 'admin' where club_id = p_club_id and profile_id = v_actor;
  update public.club_memberships set role = 'owner' where club_id = p_club_id and profile_id = p_profile_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'club.ownership_transferred', 'profile', p_profile_id, '{}'::jsonb);
end;
$$;

grant execute on function public.update_club_settings(uuid, text, text, boolean, integer, text) to authenticated;
grant execute on function public.update_scoring_rules(uuid, integer[], integer) to authenticated;
grant execute on function public.add_game_type(uuid, text, boolean) to authenticated;
grant execute on function public.update_game_type(uuid, boolean, boolean) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.transfer_ownership(uuid, uuid) to authenticated;
