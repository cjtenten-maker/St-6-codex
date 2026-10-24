-- Character privacy. Apply this after 001_st6.sql.
-- It creates the private character-art bucket. No Storage dashboard step.
--
-- A character row (the full sheet) is visible only to the character's player
-- and whoever currently holds the GM screen. Taking the screen grants that
-- access. Setting it down removes it, unless the character is theirs.
--
-- Other players at the table can read public.character_cards only:
--   id, table_id, name, seated, down, claimed, portrait_path
-- down is true when hit points are 0 or below. The number is not stored here.
-- claimed is true when someone owns the sheet. It does not say who.
-- portrait_path is the Storage object, after the character has been claimed.
-- There is no portrait until the owner or the current GM uploads one.
--
-- Stats, tags, inventory, notes, abilities, weapons, spells, mana, armor class,
-- hero points, the hit point numbers, look, concept, role, the written player
-- name, and the owner's id stay on public.characters and are not copied out.

alter table public.characters
  add column if not exists portrait_path text;

create table if not exists public.character_cards (
  id uuid primary key references public.characters (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  name text not null,
  seated boolean not null default false,
  down boolean not null default false,
  claimed boolean not null default false,
  portrait_path text,
  updated_at timestamptz not null default now()
);

create index if not exists character_cards_table_idx on public.character_cards (table_id);
alter table public.character_cards replica identity full;

-- Mirrors src/lib/table/present.ts namesMatch. "Justin" matches "Justin Ratsprit".
create or replace function public.sheet_name_matches(player_name text, display_name text)
returns boolean
language sql
immutable
as $$
  select
    length(btrim(coalesce(player_name, ''))) > 0
    and length(btrim(coalesce(display_name, ''))) > 0
    and (
      lower(btrim(player_name)) = lower(btrim(display_name))
      or starts_with(lower(btrim(player_name)), lower(btrim(display_name)) || ' ')
      or starts_with(lower(btrim(display_name)), lower(btrim(player_name)) || ' ')
    );
$$;

create or replace function public.character_is_down(sheet jsonb)
returns boolean
language sql
immutable
as $$
  select case
    when jsonb_typeof(sheet -> 'hp') = 'number' then (sheet ->> 'hp')::numeric <= 0
    else false
  end;
$$;

create or replace function public.sync_character_card()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.character_cards where id = old.id;
    return old;
  end if;

  insert into public.character_cards (id, table_id, name, seated, down, claimed, portrait_path, updated_at)
  values (
    new.id,
    new.table_id,
    coalesce(nullif(btrim(new.sheet ->> 'name'), ''), 'Unnamed'),
    new.seated,
    public.character_is_down(new.sheet),
    new.owner_id is not null,
    new.portrait_path,
    now()
  )
  on conflict (id) do update set
    table_id = excluded.table_id,
    name = excluded.name,
    seated = excluded.seated,
    down = excluded.down,
    claimed = excluded.claimed,
    portrait_path = excluded.portrait_path,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists characters_sync_card on public.characters;
create trigger characters_sync_card
  after insert or update or delete on public.characters
  for each row execute function public.sync_character_card();

insert into public.character_cards (id, table_id, name, seated, down, claimed, portrait_path)
select
  c.id,
  c.table_id,
  coalesce(nullif(btrim(c.sheet ->> 'name'), ''), 'Unnamed'),
  c.seated,
  public.character_is_down(c.sheet),
  c.owner_id is not null,
  c.portrait_path
from public.characters c
on conflict (id) do update set
  table_id = excluded.table_id,
  name = excluded.name,
  seated = excluded.seated,
  down = excluded.down,
  claimed = excluded.claimed,
  portrait_path = excluded.portrait_path,
  updated_at = now();

-- A player who cannot see the sheet still has to be able to claim it.
-- The trigger below refuses every other change. Healing, rests, and seating
-- of someone else's character are the current GM's, or the owner's.
create or replace function public.guard_character_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.table_id is distinct from old.table_id then
    raise exception 'A character stays at their table.';
  end if;

  if tg_op = 'UPDATE'
     and not public.is_current_gm(old.table_id)
     and old.owner_id is distinct from auth.uid() then
    if old.owner_id is not null or new.owner_id is distinct from auth.uid() then
      raise exception 'That character is played by someone else.';
    end if;
    if new.sheet is distinct from old.sheet
       or new.seated is distinct from old.seated
       or new.portrait_path is distinct from old.portrait_path then
      raise exception 'Claiming only puts your name on the sheet.';
    end if;
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

drop policy if exists characters_select on public.characters;
create policy characters_select on public.characters
  for select using (
    public.is_current_gm(table_id)
    or owner_id = auth.uid()
  );

drop policy if exists characters_update on public.characters;
create policy characters_update on public.characters
  for update using (
    public.is_member(table_id)
    and (
      public.is_current_gm(table_id)
      or owner_id = auth.uid()
      or owner_id is null
    )
  )
  with check (
    public.is_member(table_id)
    and (
      public.is_current_gm(table_id)
      or owner_id = auth.uid()
      or owner_id is null
    )
  );

alter table public.character_cards enable row level security;

drop policy if exists character_cards_select on public.character_cards;
create policy character_cards_select on public.character_cards
  for select using (public.is_member(table_id));

revoke all on table public.character_cards from public, anon, authenticated;
grant select on table public.character_cards to authenticated;

-- The client cannot see unclaimed sheets, so sitting the GM's own characters
-- out (including a sheet that only matches their display name) happens here.
create or replace function public.sit_out_own_characters(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if not public.is_member(p_table_id) or not public.is_current_gm(p_table_id) then
    raise exception 'Only the GM''s characters sit out.';
  end if;

  select display_name into me_name from public.profiles where id = auth.uid();

  update public.characters c
  set seated = false,
      updated_at = now()
  where c.table_id = p_table_id
    and (
      c.owner_id = auth.uid()
      or (
        c.owner_id is null
        and public.sheet_name_matches(c.sheet ->> 'playerName', me_name)
      )
    );

  update public.tables t
  set turn_order = coalesce((
        select array_agg(c.id order by slot.ord nulls last, c.updated_at)
        from public.characters c
        left join unnest(t.turn_order) with ordinality as slot(id, ord) on slot.id = c.id
        where c.table_id = t.id
          and c.seated
      ), '{}'),
      updated_at = now()
  where t.id = p_table_id;
end;
$$;

revoke all on function public.sheet_name_matches(text, text) from public, anon, authenticated;
revoke all on function public.character_is_down(jsonb) from public, anon, authenticated;
revoke all on function public.sync_character_card() from public, anon, authenticated;
revoke all on function public.sit_out_own_characters(uuid) from public, anon, authenticated;
grant execute on function public.sit_out_own_characters(uuid) to authenticated;

-- Private bucket. Members of the table can read. Only the owner of a claimed
-- character, or the current GM, can add, replace, or remove the object.
-- Object name: {table_id}/{character_id}/{revision}.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-art',
  'character-art',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object name: {table_id}/{character_id}/{revision}.jpg
create or replace function public.can_see_character_art(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  tid uuid;
  cid uuid;
begin
  if object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,16}\.jpg$' then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  tid := parts[1]::uuid;
  cid := parts[2]::uuid;
  return exists (
    select 1
    from public.characters c
    where c.id = cid
      and c.table_id = tid
      and public.is_member(c.table_id)
  );
end;
$$;

create or replace function public.can_write_character_art(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  parts text[];
  tid uuid;
  cid uuid;
begin
  if object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9]{1,16}\.jpg$' then
    return false;
  end if;
  parts := string_to_array(object_name, '/');
  tid := parts[1]::uuid;
  cid := parts[2]::uuid;
  return exists (
    select 1
    from public.characters c
    where c.id = cid
      and c.table_id = tid
      and c.owner_id is not null
      and public.is_member(c.table_id)
      and (public.is_current_gm(c.table_id) or c.owner_id = auth.uid())
  );
end;
$$;

revoke all on function public.can_see_character_art(text) from public, anon, authenticated;
revoke all on function public.can_write_character_art(text) from public, anon, authenticated;
grant execute on function public.can_see_character_art(text) to authenticated;
grant execute on function public.can_write_character_art(text) to authenticated;

drop policy if exists character_art_read on storage.objects;
create policy character_art_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'character-art'
    and public.can_see_character_art(name)
  );

drop policy if exists character_art_insert on storage.objects;
create policy character_art_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'character-art'
    and public.can_write_character_art(name)
  );

drop policy if exists character_art_update on storage.objects;
create policy character_art_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'character-art'
    and public.can_write_character_art(name)
  )
  with check (
    bucket_id = 'character-art'
    and public.can_write_character_art(name)
  );

drop policy if exists character_art_delete on storage.objects;
create policy character_art_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'character-art'
    and public.can_write_character_art(name)
  );

create or replace function public.delete_character_art()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  delete from storage.objects
  where bucket_id = 'character-art'
    and split_part(name, '/', 1) = old.table_id::text
    and split_part(name, '/', 2) = old.id::text;
  return old;
end;
$$;

revoke all on function public.delete_character_art() from public, anon, authenticated;

drop trigger if exists characters_delete_art on public.characters;
create trigger characters_delete_art
  after delete on public.characters
  for each row execute function public.delete_character_art();

do $$
begin
  alter publication supabase_realtime add table public.character_cards;
exception
  when duplicate_object then null;
end $$;
