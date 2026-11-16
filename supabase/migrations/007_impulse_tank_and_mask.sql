-- Impulse's kinetic tank and Bronze Lion Mask. Apply after 006_portrait_framing.sql.
--
-- Both live on the character sheet jsonb, with mana and the jester suit.
-- No new column. The owner, and the GM tonight, already update that jsonb.
-- characters_owner_guard compares owner_id to auth.uid(). A migration has no
-- signed-in user, so the trigger would refuse a claimed sheet. It is off only
-- for this seed, then turned back on. The card sync trigger stays on.
--
-- Tank starts at 13. The cap is not stored: the app uses 3 × Combat.
-- Spells gain an optional tank field, matched by id (and by name only if the
-- id was written differently). Sprint and intercept are left alone.
--
-- The mask is the same suit object as the jester suit, plus hit-point maximums.
-- On is AC 10 and max HP 38. Off is AC 15 and max HP 28. Charisma does not change.
-- If the sheet is already at AC 10 or max HP 38, the mask is stored as on and
-- the +10 is added only when the maximum was still the off number.
-- Otherwise it is stored off. Current HP is clamped to 28 and the +10 is not
-- subtracted, because that bonus was not on the sheet yet.
--
-- Money on the sheet is not seeded. A missing number reads as 0.

alter table public.characters disable trigger characters_owner_guard;

do $$
declare
  hero public.characters%rowtype;
  sheet jsonb;
  cha int;
  ac int;
  hp int;
  hp_max int;
  mask_on boolean;
  spells jsonb;
  weapons jsonb;
begin
  select * into hero
  from public.characters
  where id = '74fa5f2e-1721-436a-b5f2-3ccc3cd8a845';

  if not found then
    raise notice 'Impulse is not on this database. Tank and mask seed skipped.';
    return;
  end if;

  sheet := hero.sheet;
  cha := coalesce((sheet->>'charisma')::int, 0);
  ac := coalesce((sheet->>'ac')::int, 15);
  hp := coalesce((sheet->>'hp')::int, 0);
  hp_max := coalesce((sheet->>'hpMax')::int, 28);
  mask_on := ac = 10 or hp_max = 38;

  if mask_on then
    if hp_max < 38 then
      hp := least(38, greatest(0, hp) + 10);
    end if;
    hp_max := 38;
    ac := 10;
    hp := least(hp_max, greatest(0, hp));
  else
    hp_max := 28;
    ac := 15;
    hp := least(hp_max, greatest(0, hp));
  end if;

  select coalesce(jsonb_agg(
    case
      when lower(spell->>'id') = 'brace'
        or lower(spell->>'name') = 'brace'
        then spell || jsonb_build_object('tank', jsonb_build_object('use', 'brace'))
      when lower(spell->>'id') = 'kinetic-throw'
        or lower(replace(spell->>'name', ' ', '-')) = 'kinetic-throw'
        then spell || jsonb_build_object('tank', jsonb_build_object('use', 'spend', 'pointsPerDamage', 2))
      when lower(spell->>'id') = 'shockwave'
        or lower(spell->>'name') = 'shockwave'
        then spell || jsonb_build_object('tank', jsonb_build_object('use', 'spend'))
      when lower(spell->>'id') = 'overload'
        or lower(spell->>'name') = 'overload'
        then spell || jsonb_build_object('tank', jsonb_build_object('use', 'overload'))
      else spell
    end
    order by ord
  ), '[]'::jsonb)
  into spells
  from jsonb_array_elements(coalesce(sheet->'spells', '[]'::jsonb)) with ordinality as listed(spell, ord);

  select coalesce(jsonb_agg(
    case
      when lower(coalesce(weapon->>'id', '') || ' ' || coalesce(weapon->>'name', ''))
        ~ '(bow|rifle|blaster|pistol|gun|crossbow|thrown|ranged)'
        then weapon || jsonb_build_object('melee', false)
      else weapon || jsonb_build_object('melee', true)
    end
    order by ord
  ), '[]'::jsonb)
  into weapons
  from jsonb_array_elements(coalesce(sheet->'weapons', '[]'::jsonb)) with ordinality as listed(weapon, ord);

  sheet := jsonb_set(sheet, '{spells}', spells, true);
  sheet := jsonb_set(sheet, '{weapons}', weapons, true);
  sheet := jsonb_set(sheet, '{kineticTank}', '{"points": 13}'::jsonb, true);
  sheet := jsonb_set(sheet, '{ac}', to_jsonb(ac), true);
  sheet := jsonb_set(sheet, '{hp}', to_jsonb(hp), true);
  sheet := jsonb_set(sheet, '{hpMax}', to_jsonb(hp_max), true);
  sheet := jsonb_set(
    sheet,
    '{suit}',
    jsonb_build_object(
      'on', mask_on,
      'name', 'Bronze Lion Mask',
      'onCha', cha,
      'offCha', cha,
      'onAc', 10,
      'offAc', 15,
      'onHpMax', 38,
      'offHpMax', 28
    ),
    true
  );

  update public.characters
  set sheet = sheet,
      updated_at = now()
  where id = hero.id;
end $$;

alter table public.characters enable trigger characters_owner_guard;
