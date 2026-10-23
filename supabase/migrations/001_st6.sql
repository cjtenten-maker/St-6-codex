-- ST-6 Codex. Run this once in the Supabase SQL editor (or as the first migration).
-- The app never uses the service role key. Row-level security is the lock.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_by uuid not null references public.profiles (id),
  current_gm_id uuid references public.profiles (id),
  gm_eligible_ids uuid[] not null default '{}',
  scene_note text not null default '',
  side_first text check (side_first in ('heroes', 'trouble')),
  turn_order uuid[] not null default '{}',
  session_active boolean not null default false,
  session_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.table_members (
  table_id uuid not null references public.tables (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (table_id, profile_id)
);

-- Private to whoever currently holds the GM screen. The row stays, so the next GM inherits it.
create table public.gm_notes (
  table_id uuid primary key references public.tables (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  owner_id uuid references public.profiles (id),
  seated boolean not null default false,
  sheet jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.foes (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  foe jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.log_entries (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.tables (id) on delete cascade,
  session_id uuid,
  entry jsonb not null,
  created_at timestamptz not null default now()
);

create index characters_table_idx on public.characters (table_id);
create index foes_table_idx on public.foes (table_id);
create index log_table_idx on public.log_entries (table_id, created_at);
create index members_profile_idx on public.table_members (profile_id);

alter table public.characters replica identity full;
alter table public.foes replica identity full;
alter table public.log_entries replica identity full;
alter table public.tables replica identity full;
alter table public.gm_notes replica identity full;
alter table public.table_members replica identity full;

create or replace function public.is_member(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.table_members
    where table_id = tid and profile_id = auth.uid()
  );
$$;

create or replace function public.is_current_gm(tid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.tables
    where id = tid and current_gm_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, 'player'), '@', 1)
    )
  )
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.profiles.display_name, excluded.display_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.create_table(
  p_name text,
  p_code text,
  p_scene text default '',
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if p_code !~ '^[A-Z0-9]{4,8}$' then
    raise exception 'Use a code of 4 to 8 letters or numbers.';
  end if;
  if length(trim(p_name)) = 0 then raise exception 'Give the table a name.'; end if;
  insert into public.tables (code, name, created_by, gm_eligible_ids, scene_note)
  values (p_code, trim(p_name), auth.uid(), array[auth.uid()], coalesce(p_scene, ''))
  returning id into tid;
  insert into public.table_members (table_id, profile_id) values (tid, auth.uid());
  insert into public.gm_notes (table_id, body) values (tid, coalesce(p_notes, ''));
  return tid;
end;
$$;

create or replace function public.join_table(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  tid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select id into tid from public.tables where code = upper(trim(p_code));
  if tid is null then raise exception 'No table uses that code.'; end if;
  insert into public.table_members (table_id, profile_id)
  values (tid, auth.uid())
  on conflict do nothing;
  return tid;
end;
$$;

-- Members may reorder. Only the GM changes the scene, the side, and the session.
-- Only an eligible player can take the screen, and only for themselves.
-- Only the GM or the founder changes who is eligible, and four is the limit.
create or replace function public.save_table_meta(
  p_table_id uuid,
  p_scene text,
  p_side text,
  p_turn uuid[],
  p_session_active boolean,
  p_session_id uuid,
  p_current_gm uuid,
  p_eligible uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tables;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not public.is_member(p_table_id) then raise exception 'You are not at this table.'; end if;
  select * into t from public.tables where id = p_table_id;
  if t.id is null then raise exception 'No table.'; end if;

  if p_current_gm is distinct from t.current_gm_id then
    if p_current_gm is null then
      if t.current_gm_id is distinct from auth.uid() then
        raise exception 'Only the current GM can set the screen down.';
      end if;
    elsif p_current_gm = auth.uid() then
      if not (auth.uid() = any (t.gm_eligible_ids)) then
        raise exception 'You are not GM-eligible.';
      end if;
    else
      raise exception 'You can only take the screen yourself.';
    end if;
  end if;

  if p_eligible is distinct from t.gm_eligible_ids then
    if auth.uid() is distinct from t.current_gm_id and auth.uid() is distinct from t.created_by then
      raise exception 'Only the GM or the founder can mark GM-eligible players.';
    end if;
    if coalesce(array_length(p_eligible, 1), 0) > 4 then
      raise exception 'At most four players can be GM-eligible.';
    end if;
    if t.current_gm_id is not null and not (t.current_gm_id = any (p_eligible)) then
      raise exception 'The GM tonight stays eligible.';
    end if;
  end if;

  if p_scene is distinct from t.scene_note
     or p_side is distinct from t.side_first
     or p_session_active is distinct from t.session_active
     or p_session_id is distinct from t.session_id then
    if t.current_gm_id is distinct from auth.uid() and p_current_gm is distinct from auth.uid() then
      raise exception 'Only the GM can change the scene, the side, or the session.';
    end if;
  end if;

  update public.tables set
    scene_note = coalesce(p_scene, ''),
    side_first = p_side,
    turn_order = coalesce(p_turn, '{}'),
    session_active = coalesce(p_session_active, false),
    session_id = p_session_id,
    current_gm_id = p_current_gm,
    gm_eligible_ids = coalesce(p_eligible, '{}'),
    updated_at = now()
  where id = p_table_id;
end;
$$;

create or replace function public.guard_character_owner()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.table_id is distinct from old.table_id then
    raise exception 'A character stays at their table.';
  end if;
  if tg_op = 'UPDATE' and new.owner_id is distinct from old.owner_id then
    if old.owner_id is not null
       and old.owner_id is distinct from auth.uid()
       and not public.is_current_gm(old.table_id) then
      raise exception 'That character is already claimed.';
    end if;
    if new.owner_id is not null and new.owner_id is distinct from auth.uid() then
      raise exception 'Claim a character for yourself.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists characters_owner_guard on public.characters;
create trigger characters_owner_guard
  before update on public.characters
  for each row execute function public.guard_character_owner();

alter table public.profiles enable row level security;
alter table public.tables enable row level security;
alter table public.table_members enable row level security;
alter table public.gm_notes enable row level security;
alter table public.characters enable row level security;
alter table public.foes enable row level security;
alter table public.log_entries enable row level security;

create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1
      from public.table_members mine
      join public.table_members theirs on theirs.table_id = mine.table_id
      where mine.profile_id = auth.uid() and theirs.profile_id = profiles.id
    )
  );

create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy tables_select on public.tables
  for select using (public.is_member(id));

create policy members_select on public.table_members
  for select using (public.is_member(table_id));

create policy notes_select on public.gm_notes
  for select using (public.is_current_gm(table_id));

create policy notes_update on public.gm_notes
  for update using (public.is_current_gm(table_id))
  with check (public.is_current_gm(table_id));

create policy characters_select on public.characters
  for select using (public.is_member(table_id));

create policy characters_insert on public.characters
  for insert with check (
    public.is_member(table_id)
    and (owner_id is null or owner_id = auth.uid())
  );

-- Any member can update a sheet so a heal or a ward can land on an ally,
-- and so the player who was hit can be marked by the GM or by themselves.
-- Claiming is still locked by guard_character_owner. Other tables stay out.
create policy characters_update on public.characters
  for update using (public.is_member(table_id))
  with check (public.is_member(table_id));

create policy characters_delete on public.characters
  for delete using (
    public.is_member(table_id)
    and (owner_id is null or owner_id = auth.uid() or public.is_current_gm(table_id))
  );

create policy foes_select on public.foes
  for select using (public.is_member(table_id));

create policy foes_insert on public.foes
  for insert with check (public.is_current_gm(table_id));

create policy foes_update on public.foes
  for update using (public.is_member(table_id))
  with check (public.is_member(table_id));

create policy foes_delete on public.foes
  for delete using (public.is_current_gm(table_id));

create policy log_select on public.log_entries
  for select using (public.is_member(table_id));

create policy log_insert on public.log_entries
  for insert with check (public.is_member(table_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select on public.tables to authenticated;
grant select on public.table_members to authenticated;
grant select, update on public.gm_notes to authenticated;
grant select, insert, update, delete on public.characters to authenticated;
grant select, insert, update, delete on public.foes to authenticated;
grant select, insert on public.log_entries to authenticated;

grant execute on function public.create_table(text, text, text, text) to authenticated;
grant execute on function public.join_table(text) to authenticated;
grant execute on function public.save_table_meta(uuid, text, text, uuid[], boolean, uuid, uuid, uuid[]) to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_current_gm(uuid) to authenticated;

do $$
declare
  rel text;
begin
  foreach rel in array array['tables', 'table_members', 'gm_notes', 'characters', 'foes', 'log_entries']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', rel);
    exception
      when duplicate_object then null;
    end;
  end loop;
end $$;
