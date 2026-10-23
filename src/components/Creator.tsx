"use client";

import { useState } from "react";
import { ARMORS, SHIELDS, SPELLS, WEAPONS } from "@/lib/data/catalog";
import type { Character, StatName, Tag } from "@/lib/model";
import { HERO_START, manaMaximum, rollHitPoints, rollStatPool, stackedAc, tagCountAllowed, type HitPointRoll, type StatPool } from "@/lib/rules";
import { Button, Card, Kicker, TextField } from "./ui";

const STATS: StatName[] = ["charisma", "strength", "combat", "arcana"];
const STAT_LABEL: Record<StatName, string> = { charisma: "Charisma", strength: "Strength", combat: "Combat", arcana: "Arcana" };

export function Creator({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (character: Character) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pool, setPool] = useState<StatPool | null>(null);
  const [slots, setSlots] = useState<Record<StatName, number | null>>({
    charisma: null,
    strength: null,
    combat: null,
    arcana: null,
  });
  const [hpRoll, setHpRoll] = useState<HitPointRoll | null>(null);
  const [armorId, setArmorId] = useState("clothes");
  const [shieldId, setShieldId] = useState("none");
  const [customAc, setCustomAc] = useState("");
  const [tags, setTags] = useState<string[]>(["", "", ""]);
  const [weapons, setWeapons] = useState<string[]>(["unarmed"]);
  const [spells, setSpells] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const used = new Set(Object.values(slots).filter((value): value is number => value != null));
  const assigned: Record<StatName, number | null> = {
    charisma: slots.charisma == null || !pool ? null : pool.kept[slots.charisma],
    strength: slots.strength == null || !pool ? null : pool.kept[slots.strength],
    combat: slots.combat == null || !pool ? null : pool.kept[slots.combat],
    arcana: slots.arcana == null || !pool ? null : pool.kept[slots.arcana],
  };
  const armor = ARMORS.find((item) => item.id === armorId) ?? ARMORS[0];
  const shield = SHIELDS.find((item) => item.id === shieldId) ?? SHIELDS[0];
  const listedAc = stackedAc(armor.ac, shield.bonus);
  const ac = customAc.trim() === "" ? listedAc : Number(customAc);

  const take = (stat: StatName, index: number) => {
    setSlots((current) => {
      const next = { ...current };
      for (const key of STATS) if (next[key] === index && key !== stat) next[key] = null;
      next[stat] = current[stat] === index ? null : index;
      return next;
    });
  };

  const save = async () => {
    const cleanTags = tags.map((tag) => tag.trim()).filter(Boolean);
    if (!name.trim()) return setError("The hero needs a name.");
    if (!pool || STATS.some((stat) => assigned[stat] == null)) return setError("Roll the sets, then assign all four.");
    if (!hpRoll) return setError("Roll hit points.");
    if (!tagCountAllowed(cleanTags.length, true)) return setError("A new hero carries 3 to 5 tags.");
    if (!Number.isFinite(ac)) return setError("AC has to be a number. Handwritten scores under 10 are allowed.");
    const strength = (assigned.strength ?? 0) + (armor.strengthBonus ?? 0);
    const arcana = assigned.arcana ?? 0;
    const tagList: Tag[] = cleanTags.map((label) => ({
      id: crypto.randomUUID(),
      label,
      defensive: false,
    }));
    const character: Character = {
      id: crypto.randomUUID(),
      name: name.trim(),
      playerName: "",
      ownerId: null,
      role: role.trim(),
      concept: "",
      look: "",
      notes: armor.strengthBonus ? "+1 Strength from powered armor is included." : "",
      abilities: "",
      inventory: "",
      charisma: assigned.charisma ?? 0,
      strength,
      combat: assigned.combat ?? 0,
      arcana,
      hp: hpRoll.total,
      hpMax: hpRoll.total,
      mana: manaMaximum(arcana),
      ac,
      acNote: customAc.trim() === "" ? `${armor.name}${shield.bonus ? ` + ${shield.name}` : ""}` : "Handwritten.",
      tempAc: 0,
      defenseTagActive: false,
      heroPoints: HERO_START,
      tags: tagList,
      weapons: WEAPONS.filter((weapon) => weapons.includes(weapon.id)).map((weapon) => ({
        id: crypto.randomUUID(),
        name: weapon.name,
        damage: weapon.damage,
        hitStat: weapon.hitStat,
        altHitStat: weapon.altHitStat,
        bonusStat: weapon.bonusStat,
        bonusMode: weapon.bonusMode,
        ignoreAc: weapon.ignoreAc,
        overheatsOnNat1: weapon.overheatsOnNat1,
        notes: weapon.notes,
      })),
      spells: SPELLS.filter((spell) => spells.includes(spell.id)).map((spell) => ({
        id: crypto.randomUUID(),
        name: spell.name,
        cost: spell.cost,
        effect: spell.effect,
        damage: spell.damage,
        heal: spell.heal,
        tempAc: spell.tempAc,
        aoeAc: spell.aoeAc,
        saveForHalf: spell.saveForHalf,
        notes: spell.notes,
      })),
      energyShield: Boolean(shield.energyShield),
      seated: false,
    };
    try {
      await onCreate(character);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't add them.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/95 px-4 py-6">
      <div className="mx-auto grid max-w-lg gap-4 pb-16">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">New hero</h2>
          <Button tone="quiet" onClick={onClose}>
            Close
          </Button>
        </div>
        <Card>
          <Kicker>Name</Kicker>
          <div className="mt-2 grid gap-2">
            <TextField value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" aria-label="Name" />
            <TextField value={role} onChange={(event) => setRole(event.target.value)} placeholder="Role" aria-label="Role" />
          </div>
        </Card>
        <Card>
          <Kicker>Stats · 5×3d4, drop the lowest total</Kicker>
          <Button className="mt-3" tone="ghost" onClick={() => { setPool(rollStatPool()); setSlots({ charisma: null, strength: null, combat: null, arcana: null }); }}>
            Roll five sets
          </Button>
          {pool ? (
            <p className="mt-3 text-sm">
              {pool.sets.map((set, index) => (
                <span key={index} className={index === pool.droppedIndex ? "mx-1 text-mute line-through" : "mx-1 text-brass"}>
                  {set}
                </span>
              ))}
            </p>
          ) : null}
          <div className="mt-3 grid gap-3">
            {STATS.map((stat) => (
              <div key={stat}>
                <p className="text-sm">{STAT_LABEL[stat]} {assigned[stat] != null ? <span className="num text-brass">{assigned[stat]}</span> : null}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {pool?.kept.map((value, index) => (
                    <button
                      key={`${value}-${index}`}
                      type="button"
                      disabled={used.has(index) && slots[stat] !== index}
                      className="min-h-11 min-w-11 rounded-xl border border-line px-3 disabled:opacity-30"
                      onClick={() => take(stat, index)}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Kicker>Hit points · 5d10, drop the lowest</Kicker>
          <Button className="mt-3" tone="ghost" onClick={() => setHpRoll(rollHitPoints())}>
            Roll hit points
          </Button>
          {hpRoll ? (
            <p className="mt-3">
              {hpRoll.rolls.map((face, index) => (
                <span key={index} className={index === hpRoll.droppedIndex ? "mx-1 text-mute line-through" : "mx-1"}>
                  {face}
                </span>
              ))}
              <span className="num text-brass"> = {hpRoll.total}</span>
            </p>
          ) : null}
        </Card>
        <Card>
          <Kicker>Armor · shield stacks stop at 20</Kicker>
          <div className="mt-3 grid gap-2">
            <select className="min-h-11 rounded-xl border border-line bg-ink px-3" value={armorId} onChange={(event) => setArmorId(event.target.value)} aria-label="Armor">
              {ARMORS.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · AC {item.ac}</option>
              ))}
            </select>
            <select className="min-h-11 rounded-xl border border-line bg-ink px-3" value={shieldId} onChange={(event) => setShieldId(event.target.value)} aria-label="Shield">
              {SHIELDS.map((item) => (
                <option key={item.id} value={item.id}>{item.name}{item.bonus ? ` · +${item.bonus}` : ""}</option>
              ))}
            </select>
            <TextField
              inputMode="numeric"
              placeholder={`Or a handwritten AC (list gives ${listedAc})`}
              value={customAc}
              onChange={(event) => setCustomAc(event.target.value)}
              aria-label="Handwritten AC"
            />
            <p className="text-sm text-mute">AC {Number.isFinite(ac) ? ac : "—"}{armor.strengthBonus ? " · powered armor adds +1 Strength" : ""}</p>
          </div>
        </Card>
        <Card>
          <Kicker>Tags · 3 to 5</Kicker>
          <div className="mt-3 grid gap-2">
            {tags.map((tag, index) => (
              <TextField key={index} value={tag} aria-label={`Tag ${index + 1}`} placeholder="A short phrase" onChange={(event) => setTags(tags.map((item, i) => (i === index ? event.target.value : item)))} />
            ))}
            {tags.length < 5 ? (
              <Button tone="ghost" onClick={() => setTags([...tags, ""])}>Add a tag</Button>
            ) : null}
          </div>
        </Card>
        <Card>
          <Kicker>Weapons and spells</Kicker>
          <div className="mt-3 grid gap-1">
            {WEAPONS.map((weapon) => (
              <label key={weapon.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={weapons.includes(weapon.id)} onChange={() => setWeapons(toggle(weapons, weapon.id))} />
                {weapon.name} · {weapon.damage}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-1">
            {SPELLS.map((spell) => (
              <label key={spell.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={spells.includes(spell.id)} onChange={() => setSpells(toggle(spells, spell.id))} />
                {spell.name} · {spell.cost} mana
              </label>
            ))}
          </div>
        </Card>
        {error ? <p className="text-sm text-hp">{error}</p> : null}
        <Button onClick={() => void save()}>Save to the company</Button>
      </div>
    </div>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}
