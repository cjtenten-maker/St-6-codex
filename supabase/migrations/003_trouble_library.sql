-- Trouble library. Run after 002_character_privacy.sql.
-- The library belongs to the table. Only the current GM can read or write it.
-- Past GMs lose it the moment they hand the screen off. Players never see it.
-- This file also creates the private trouble-art bucket. No Storage dashboard step.
--
-- The app treats a missing trouble / trouble_folders table as "library not ready"
-- and still opens the rest of the table. Apply this when you can; until then the
-- GM screen says the library is waiting, and adding a foe by hand still works.

create table if not exists public.trouble_folders (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  sort integer not null default 0,
  unique (table_id, name)
);

create table if not exists public.trouble (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  folder_id uuid references public.trouble_folders (id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  hp integer not null check (hp between 1 and 9999),
  ac integer not null check (ac between 0 and 99),
  attack_bonus integer not null default 0 check (attack_bonus between -30 and 40),
  damage text not null default '1d6' check (char_length(damage) between 1 and 40),
  abilities text not null default '',
  notes text not null default '',
  energy_shield boolean not null default false,
  ignore_ac integer check (ignore_ac is null or ignore_ac between 0 and 30),
  portrait_path text,
  sort integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists trouble_folders_table_idx on public.trouble_folders (table_id);
create index if not exists trouble_table_idx on public.trouble (table_id);

alter table public.trouble_folders replica identity full;
alter table public.trouble replica identity full;

alter table public.trouble_folders enable row level security;
alter table public.trouble enable row level security;

drop policy if exists trouble_folders_select on public.trouble_folders;
create policy trouble_folders_select on public.trouble_folders
  for select to authenticated
  using (public.is_current_gm(table_id));

drop policy if exists trouble_folders_insert on public.trouble_folders;
create policy trouble_folders_insert on public.trouble_folders
  for insert to authenticated
  with check (public.is_current_gm(table_id));

drop policy if exists trouble_folders_update on public.trouble_folders;
create policy trouble_folders_update on public.trouble_folders
  for update to authenticated
  using (public.is_current_gm(table_id))
  with check (public.is_current_gm(table_id));

drop policy if exists trouble_folders_delete on public.trouble_folders;
create policy trouble_folders_delete on public.trouble_folders
  for delete to authenticated
  using (public.is_current_gm(table_id));

drop policy if exists trouble_select on public.trouble;
create policy trouble_select on public.trouble
  for select to authenticated
  using (public.is_current_gm(table_id));

drop policy if exists trouble_insert on public.trouble;
create policy trouble_insert on public.trouble
  for insert to authenticated
  with check (public.is_current_gm(table_id));

drop policy if exists trouble_update on public.trouble;
create policy trouble_update on public.trouble
  for update to authenticated
  using (public.is_current_gm(table_id))
  with check (public.is_current_gm(table_id));

drop policy if exists trouble_delete on public.trouble;
create policy trouble_delete on public.trouble
  for delete to authenticated
  using (public.is_current_gm(table_id));

revoke all on table public.trouble_folders from public, anon, authenticated;
revoke all on table public.trouble from public, anon, authenticated;
grant select, insert, update, delete on public.trouble_folders to authenticated;
grant select, insert, update, delete on public.trouble to authenticated;

-- Private bucket. Only the current GM of the table that owns the template can
-- read or write. Object name: {table_id}/{trouble_id}/{revision}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trouble-art',
  'trouble-art',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_see_trouble_art(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  tid uuid;
  trouble_id uuid;
begin
  if object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,16}\.jpg$' then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  tid := parts[1]::uuid;
  trouble_id := parts[2]::uuid;
  return exists (
    select 1
    from public.trouble t
    where t.id = trouble_id
      and t.table_id = tid
      and public.is_current_gm(t.table_id)
  );
end;
$$;

create or replace function public.can_write_trouble_art(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.can_see_trouble_art(object_name);
end;
$$;

revoke all on function public.can_see_trouble_art(text) from public, anon, authenticated;
revoke all on function public.can_write_trouble_art(text) from public, anon, authenticated;
grant execute on function public.can_see_trouble_art(text) to authenticated;
grant execute on function public.can_write_trouble_art(text) to authenticated;

drop policy if exists trouble_art_read on storage.objects;
create policy trouble_art_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trouble-art'
    and public.can_see_trouble_art(name)
  );

drop policy if exists trouble_art_insert on storage.objects;
create policy trouble_art_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trouble-art'
    and public.can_write_trouble_art(name)
  );

drop policy if exists trouble_art_update on storage.objects;
create policy trouble_art_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'trouble-art'
    and public.can_write_trouble_art(name)
  )
  with check (
    bucket_id = 'trouble-art'
    and public.can_write_trouble_art(name)
  );

drop policy if exists trouble_art_delete on storage.objects;
create policy trouble_art_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'trouble-art'
    and public.can_write_trouble_art(name)
  );

create or replace function public.delete_trouble_art()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'trouble-art'
    and split_part(name, '/', 1) = old.table_id::text
    and split_part(name, '/', 2) = old.id::text;
  return old;
end;
$$;

revoke all on function public.delete_trouble_art() from public, anon, authenticated;

drop trigger if exists trouble_delete_art on public.trouble;
create trigger trouble_delete_art
  after delete on public.trouble
  for each row execute function public.delete_trouble_art();

do $$
begin
  alter publication supabase_realtime add table public.trouble_folders;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.trouble;
exception
  when duplicate_object then null;
end $$;
