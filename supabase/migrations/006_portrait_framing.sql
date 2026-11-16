-- Portrait framing on the public card. Apply after 005_trouble_art_storage.sql.
--
-- The photo is already visible to everyone at the table. How it sits in the
-- frame is not a secret. portraitFit ("contain" or "cover") and portraitFocus
-- ({"x","y"}, each from 0 to 1) live on the character sheet jsonb. This copies
-- those two fields onto public.character_cards so the small pictures other
-- players see can crop around the face.
--
-- Stats, notes, inventory, and the rest of the sheet stay on public.characters.
-- Until this file has been run, the player and the current GM still read the
-- framing from the sheet. Everyone else sees the whole picture on the sheet
-- and a top crop on the small pictures. The app still loads a table without it.

alter table public.character_cards
  add column if not exists portrait_fit text,
  add column if not exists portrait_focus jsonb;

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

  insert into public.character_cards (
    id,
    table_id,
    name,
    seated,
    down,
    claimed,
    portrait_path,
    portrait_fit,
    portrait_focus,
    updated_at
  )
  values (
    new.id,
    new.table_id,
    coalesce(nullif(btrim(new.sheet ->> 'name'), ''), 'Unnamed'),
    new.seated,
    public.character_is_down(new.sheet),
    new.owner_id is not null,
    new.portrait_path,
    case
      when new.sheet ->> 'portraitFit' in ('contain', 'cover') then new.sheet ->> 'portraitFit'
      else null
    end,
    case
      when jsonb_typeof(new.sheet -> 'portraitFocus') = 'object'
        and jsonb_typeof(new.sheet -> 'portraitFocus' -> 'x') = 'number'
        and jsonb_typeof(new.sheet -> 'portraitFocus' -> 'y') = 'number'
        and (new.sheet -> 'portraitFocus' ->> 'x')::numeric between 0 and 1
        and (new.sheet -> 'portraitFocus' ->> 'y')::numeric between 0 and 1
      then jsonb_build_object(
        'x', (new.sheet -> 'portraitFocus' ->> 'x')::numeric,
        'y', (new.sheet -> 'portraitFocus' ->> 'y')::numeric
      )
      else null
    end,
    now()
  )
  on conflict (id) do update set
    table_id = excluded.table_id,
    name = excluded.name,
    seated = excluded.seated,
    down = excluded.down,
    claimed = excluded.claimed,
    portrait_path = excluded.portrait_path,
    portrait_fit = excluded.portrait_fit,
    portrait_focus = excluded.portrait_focus,
    updated_at = now();
  return new;
end;
$$;

update public.character_cards as card
set
  portrait_fit = case
    when c.sheet ->> 'portraitFit' in ('contain', 'cover') then c.sheet ->> 'portraitFit'
    else null
  end,
  portrait_focus = case
    when jsonb_typeof(c.sheet -> 'portraitFocus') = 'object'
      and jsonb_typeof(c.sheet -> 'portraitFocus' -> 'x') = 'number'
      and jsonb_typeof(c.sheet -> 'portraitFocus' -> 'y') = 'number'
      and (c.sheet -> 'portraitFocus' ->> 'x')::numeric between 0 and 1
      and (c.sheet -> 'portraitFocus' ->> 'y')::numeric between 0 and 1
    then jsonb_build_object(
      'x', (c.sheet -> 'portraitFocus' ->> 'x')::numeric,
      'y', (c.sheet -> 'portraitFocus' ->> 'y')::numeric
    )
    else null
  end,
  updated_at = now()
from public.characters as c
where c.id = card.id;
