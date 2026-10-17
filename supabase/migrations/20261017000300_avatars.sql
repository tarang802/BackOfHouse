-- Avatar storage. Images are public-read (they are shown on leaderboards) but each user
-- can only write inside their own folder: avatars/<user id>/<file>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Upserts need to see the existing object; public URLs are served without this policy.
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Profiles may only point at images in their own avatar folder.
create function public.is_valid_avatar_url(p_url text, p_profile_id uuid) returns boolean
language sql immutable as $$
  select p_url is null
      or p_url ~ ('/storage/v1/object/public/avatars/' || p_profile_id::text || '/[A-Za-z0-9._-]+(\?v=[0-9]+)?$');
$$;

grant execute on function public.is_valid_avatar_url(text, uuid) to authenticated;

alter table public.profiles
  add constraint profiles_avatar_url_own_folder check (public.is_valid_avatar_url(avatar_url, id));
