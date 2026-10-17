-- Clubs, invitations and joining.

-- 8-character code from an alphabet without look-alikes (no 0/O, 1/I/L).
create function public.generate_invite_code() returns text
language plpgsql volatile set search_path = public, pg_temp as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.club_invitations where code = v_code);
  end loop;
  return v_code;
end;
$$;

create function public.create_club(p_name text, p_tagline text default null, p_timezone text default 'UTC')
returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_club_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_tagline text := nullif(btrim(coalesce(p_tagline, '')), '');
  v_timezone text := coalesce(nullif(btrim(p_timezone), ''), 'UTC');
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    perform public.raise_app_error('invalid_name', 'Club names must be 2 to 60 characters.');
  end if;
  if v_tagline is not null and char_length(v_tagline) > 120 then
    perform public.raise_app_error('invalid_tagline', 'Taglines can be at most 120 characters.');
  end if;
  if not exists (select 1 from pg_timezone_names where name = v_timezone) then
    v_timezone := 'UTC';
  end if;
  if (select count(*) from public.club_memberships where profile_id = v_actor and role = 'owner') >= 5 then
    perform public.raise_app_error('limit_reached', 'You can own at most 5 clubs.');
  end if;

  insert into public.clubs (name, tagline, created_by, timezone)
  values (v_name, v_tagline, v_actor, v_timezone)
  returning id into v_club_id;

  insert into public.club_memberships (club_id, profile_id, role) values (v_club_id, v_actor, 'owner');

  insert into public.game_types (club_id, slug, name, kind, counts_toward_overall) values
    (v_club_id, 'bluff', 'Bluff', 'bluff', true),
    (v_club_id, 'poker', 'Poker', 'poker', true),
    (v_club_id, 'teen-patti', 'Teen Patti', 'teen_patti', true);

  insert into public.scoring_rules (club_id, version, placement_points, participation_points, created_by)
  values (v_club_id, 1, array[3, 1], 0, v_actor);

  insert into public.club_invitations (club_id, code, created_by)
  values (v_club_id, public.generate_invite_code(), v_actor);

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_club_id, v_actor, 'club.created', 'club', v_club_id, jsonb_build_object('name', v_name));

  return v_club_id;
end;
$$;

create function public.join_club(p_code text) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_invite public.club_invitations%rowtype;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  if v_code !~ '^[A-Z0-9]{8}$' then
    perform public.raise_app_error('invalid_invite', 'That invitation code is not valid.');
  end if;

  select * into v_invite from public.club_invitations where code = v_code for update;
  if not found
     or v_invite.revoked_at is not null
     or (v_invite.expires_at is not null and v_invite.expires_at < now()) then
    perform public.raise_app_error('invalid_invite', 'That invitation code is not valid or has expired.');
  end if;

  if exists (select 1 from public.club_memberships where club_id = v_invite.club_id and profile_id = v_actor) then
    return v_invite.club_id;
  end if;

  if v_invite.max_uses is not null and v_invite.use_count >= v_invite.max_uses then
    perform public.raise_app_error('invalid_invite', 'That invitation has already been used up.');
  end if;
  if (select count(*) from public.club_memberships where club_id = v_invite.club_id) >= 50 then
    perform public.raise_app_error('limit_reached', 'This club is full.');
  end if;

  insert into public.club_memberships (club_id, profile_id, role) values (v_invite.club_id, v_actor, 'member');
  update public.club_invitations set use_count = use_count + 1 where id = v_invite.id;

  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_invite.club_id, v_actor, 'member.joined', 'profile', v_actor, '{}'::jsonb);

  return v_invite.club_id;
end;
$$;

-- Lets someone holding a code see which club they are about to join (name only).
create function public.preview_invitation(p_code text)
returns table (club_name text, member_count integer)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform public.require_profile();
  return query
    select c.name, (select count(*)::integer from public.club_memberships m where m.club_id = c.id)
    from public.club_invitations i
    join public.clubs c on c.id = i.club_id
    where i.code = v_code
      and i.revoked_at is null
      and (i.expires_at is null or i.expires_at > now())
      and (i.max_uses is null or i.use_count < i.max_uses);
end;
$$;

create function public.create_invitation(p_club_id uuid, p_expires_in_days integer default null, p_max_uses integer default null)
returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_code text;
begin
  perform public.require_club_role(p_club_id, true);
  if p_expires_in_days is not null and (p_expires_in_days < 1 or p_expires_in_days > 90) then
    perform public.raise_app_error('invalid_invite', 'Invitations can last between 1 and 90 days.');
  end if;
  if p_max_uses is not null and (p_max_uses < 1 or p_max_uses > 100) then
    perform public.raise_app_error('invalid_invite', 'Invitations can be used between 1 and 100 times.');
  end if;
  if (select count(*) from public.club_invitations where club_id = p_club_id and revoked_at is null) >= 20 then
    perform public.raise_app_error('limit_reached', 'Revoke some old invitations first.');
  end if;
  v_code := public.generate_invite_code();
  insert into public.club_invitations (club_id, code, created_by, expires_at, max_uses)
  values (
    p_club_id, v_code, v_actor,
    case when p_expires_in_days is null then null else now() + make_interval(days => p_expires_in_days) end,
    p_max_uses
  );
  insert into public.audit_logs (club_id, actor_id, action, entity_type, details)
  values (p_club_id, v_actor, 'invitation.created', 'invitation', '{}'::jsonb);
  return v_code;
end;
$$;

create function public.revoke_invitation(p_invitation_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_club_id uuid;
begin
  select club_id into v_club_id from public.club_invitations where id = p_invitation_id;
  if v_club_id is null then
    perform public.raise_app_error('not_found', 'Invitation not found.');
  end if;
  perform public.require_club_role(v_club_id, true);
  update public.club_invitations set revoked_at = coalesce(revoked_at, now()) where id = p_invitation_id;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (v_club_id, v_actor, 'invitation.revoked', 'invitation', p_invitation_id, '{}'::jsonb);
end;
$$;

create function public.leave_club(p_club_id uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_actor uuid := public.require_profile();
  v_role text := public.require_club_role(p_club_id);
begin
  if v_role = 'owner' then
    perform public.raise_app_error('forbidden', 'Transfer ownership before leaving your club.');
  end if;
  delete from public.club_memberships where club_id = p_club_id and profile_id = v_actor;
  insert into public.audit_logs (club_id, actor_id, action, entity_type, entity_id, details)
  values (p_club_id, v_actor, 'member.left', 'profile', v_actor, '{}'::jsonb);
end;
$$;

revoke execute on function public.generate_invite_code() from public, anon, authenticated;
grant execute on function public.create_club(text, text, text) to authenticated;
grant execute on function public.join_club(text) to authenticated;
grant execute on function public.preview_invitation(text) to authenticated;
grant execute on function public.create_invitation(uuid, integer, integer) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.leave_club(uuid) to authenticated;
