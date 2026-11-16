-- Friendly fire. Apply after 007_impulse_tank_and_mask.sql.
--
-- A player can strike another hero, and the blow has to use that hero's armor
-- class and energy shield. Those two facts are copied onto the public card.
-- Hit points, the tank, notes, and the rest of the sheet stay private.
-- Until this file has been run, other players still see the card without an
-- armor class, and the app does not offer them as a target.
--
-- Landing the blow is apply_character_harm. It is the only way a player who
-- is not the owner or the GM can change someone else's sheet, and it only
-- changes hit points, the energy shield, and a kinetic tank. The owner guard
-- allows that narrow change from a member of the table. A direct update of
-- any other field is still refused, and row security still hides the sheet.

alter table public.character_cards
  add column if not exists strike_ac integer,
  add column if not exists energy_shield boolean not null default false;

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
    strike_ac,
    energy_shield,
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
    coalesce((new.sheet ->> 'ac')::integer, 0)
      + coalesce((new.sheet ->> 'tempAc')::integer, 0)
      + case when new.sheet ->> 'defenseTagActive' = 'true' then 1 else 0 end,
    coalesce(new.sheet ->> 'energyShield' = 'true', false),
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
    strike_ac = excluded.strike_ac,
    energy_shield = excluded.energy_shield,
    updated_at = now();
  return new;
end;
$$;

update public.character_cards as card
set
  strike_ac = coalesce((c.sheet ->> 'ac')::integer, 0)
    + coalesce((c.sheet ->> 'tempAc')::integer, 0)
    + case when c.sheet ->> 'defenseTagActive' = 'true' then 1 else 0 end,
  energy_shield = coalesce(c.sheet ->> 'energyShield' = 'true', false),
  updated_at = now()
from public.characters as c
where c.id = card.id;

-- True when the sheet change is only hit points, the energy shield, or the tank.
create or replace function public.sheet_harm_only(old_sheet jsonb, new_sheet jsonb)
returns boolean
language sql
immutable
as $$
  select (old_sheet - 'hp' - 'energyShield' - 'kineticTank')
       = (new_sheet - 'hp' - 'energyShield' - 'kineticTank');
$$;

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
    if public.is_member(old.table_id)
       and new.owner_id is not distinct from old.owner_id
       and new.seated is not distinct from old.seated
       and new.portrait_path is not distinct from old.portrait_path
       and public.sheet_harm_only(old.sheet, new.sheet) then
      return new;
    end if;
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

-- A member lands a blow they cannot see the sheet for. The math matches
-- src/lib/table/reducer.ts: harm banks 2 tank per damage, or 3 while Brace
-- is armed, capped at 3 × Combat, and Brace then ends. Healing does not bank.
create or replace function public.apply_character_harm(
  p_character_id uuid,
  p_amount integer,
  p_direction text,
  p_break_shield boolean,
  p_summary text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hero public.characters%rowtype;
  amount integer;
  hp integer;
  hp_max integer;
  combat integer;
  cap integer;
  tank jsonb;
  before_points integer;
  points integer;
  braced boolean;
  rate integer;
  note text := '';
  entry_id uuid := gen_random_uuid();
  session uuid;
  actor_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if p_direction not in ('harm', 'heal') then
    raise exception 'Harm or heal.';
  end if;

  select * into hero from public.characters where id = p_character_id for update;
  if not found then
    raise exception 'That character isn''t at this table.';
  end if;
  if not public.is_member(hero.table_id) then
    raise exception 'Join the table first.';
  end if;

  amount := greatest(0, coalesce(p_amount, 0));
  hp := coalesce((hero.sheet ->> 'hp')::integer, 0);
  hp_max := greatest(1, coalesce((hero.sheet ->> 'hpMax')::integer, 1));

  if p_direction = 'heal' then
    hp := least(hp_max, hp + amount);
  else
    hp := greatest(0, hp - amount);
    if amount > 0
       and jsonb_typeof(hero.sheet -> 'kineticTank') = 'object' then
      tank := hero.sheet -> 'kineticTank';
      before_points := coalesce((tank ->> 'points')::integer, 0);
      braced := coalesce((tank ->> 'brace')::boolean, false);
      combat := coalesce((hero.sheet ->> 'combat')::integer, 0);
      cap := greatest(0, combat) * 3;
      rate := case when braced then 3 else 2 end;
      points := least(cap, greatest(0, before_points) + amount * rate);
      tank := jsonb_build_object('points', points);
      if coalesce((hero.sheet -> 'kineticTank' ->> 'overload')::integer, 0) > 0 then
        tank := tank || jsonb_build_object('overload', (hero.sheet -> 'kineticTank' ->> 'overload')::integer);
      end if;
      note := format(
        ' Tank %s → %s%s.',
        before_points,
        points,
        case when braced then ', Brace' else '' end
      );
      hero.sheet := jsonb_set(hero.sheet, '{kineticTank}', tank);
    end if;
  end if;

  hero.sheet := jsonb_set(hero.sheet, '{hp}', to_jsonb(hp));
  if coalesce(p_break_shield, false) then
    hero.sheet := jsonb_set(hero.sheet, '{energyShield}', 'false'::jsonb);
  end if;

  update public.characters
  set sheet = hero.sheet,
      updated_at = now()
  where id = hero.id;

  select t.session_id into session from public.tables t where t.id = hero.table_id;
  select display_name into actor_name from public.profiles where id = auth.uid();

  insert into public.log_entries (id, table_id, session_id, entry)
  values (
    entry_id,
    hero.table_id,
    session,
    jsonb_build_object(
      'id', entry_id,
      'sessionId', session,
      'at', to_jsonb(now()),
      'actorId', auth.uid(),
      'actorName', coalesce(actor_name, 'Table'),
      'kind', 'damage',
      'summary', coalesce(p_summary, '') || note
    )
  );
end;
$$;

revoke all on function public.sheet_harm_only(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_character_harm(uuid, integer, text, boolean, text) from public, anon, authenticated;
grant execute on function public.apply_character_harm(uuid, integer, text, boolean, text) to authenticated;
