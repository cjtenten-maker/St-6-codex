-- Claim an unclaimed sheet by setting owner_id on the existing row.
-- Drop the character-art trigger that deleted storage.objects directly.
-- One name per table, so a failed claim cannot be saved as a second hero.

-- PostgREST filters UPDATE by the SELECT policy. A player cannot see an
-- unclaimed sheet, so a claim PATCH matches zero rows and still returns 204.
-- This function locks that row and writes owner_id only. The sheet stays.
create or replace function public.claim_character(p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.characters%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;

  select * into row
  from public.characters
  where id = p_character_id
  for update;

  if not found then
    raise exception 'That character isn''t at this table.';
  end if;

  if not public.is_member(row.table_id) then
    raise exception 'Join the table first.';
  end if;

  if row.owner_id = auth.uid() then
    return;
  end if;

  if row.owner_id is not null then
    raise exception 'That character is already claimed.';
  end if;

  update public.characters
  set owner_id = auth.uid(),
      updated_at = now()
  where id = row.id
    and owner_id is null;

  if not found then
    raise exception 'That character is already claimed.';
  end if;
end;
$$;

revoke all on function public.claim_character(uuid) from public, anon, authenticated;
grant execute on function public.claim_character(uuid) to authenticated;

do $$
declare
  dupes text;
begin
  select string_agg(format('%s on table %s', name, table_id), ', ' order by name)
    into dupes
  from (
    select table_id, lower(btrim(sheet ->> 'name')) as name
    from public.characters
    where nullif(btrim(sheet ->> 'name'), '') is not null
    group by table_id, lower(btrim(sheet ->> 'name'))
    having count(*) > 1
  ) d;
  if dupes is not null then
    raise exception 'Two characters share a name. Keep one row, then run this again: %', dupes;
  end if;
end;
$$;

create unique index if not exists characters_one_name_per_table
  on public.characters (table_id, lower(btrim(sheet ->> 'name')))
  where nullif(btrim(sheet ->> 'name'), '') is not null;

-- Living portraits stay owner-or-GM. After the character row is gone, a member
-- of that table may remove the leftover file. The app does that through Storage
-- once the row delete has succeeded. Players still cannot read another sheet.
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
  if exists (
    select 1
    from public.characters c
    where c.id = cid
      and c.table_id = tid
  ) then
    return exists (
      select 1
      from public.characters c
      where c.id = cid
        and c.table_id = tid
        and c.owner_id is not null
        and public.is_member(c.table_id)
        and (public.is_current_gm(c.table_id) or c.owner_id = auth.uid())
    );
  end if;
  return public.is_member(tid);
end;
$$;

revoke all on function public.can_write_character_art(text) from public, anon, authenticated;
grant execute on function public.can_write_character_art(text) to authenticated;

-- Supabase rejects DELETE on storage.objects (protect_delete). The trigger
-- rolled the character delete back with it. The app removes the file instead.
drop trigger if exists characters_delete_art on public.characters;
drop function if exists public.delete_character_art();
