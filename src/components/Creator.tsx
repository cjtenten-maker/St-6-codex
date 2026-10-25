"use client";

import { useState } from "react";
import { ARMORS, SHIELDS, SPELLS, WEAPONS } from "@/lib/data/catalog";
import type { Character, StatName, Tag } from "@/lib/model";
import { HERO_START, manaMaximum, parsePositiveInteger, rollHitPoints, rollStatPool, stackedAc, tagCountAllowed, type HitPointRoll, type StatPool } from "@/lib/rules";
import { Button, Card, Kicker, TextField, cx } from "./ui";

const STATS: StatName[] = ["charisma", "strength", "combat", "arcana"];
const STAT_LABEL: Record<StatName, string> = { charisma: "Charisma", strength: "Strength", combat: "Combat", arcana: "Arcana" };
const EMPTY_SLOTS: Record<StatName, number | null> = { charisma: null, strength: null, combat: null, arcana: null };
const EMPTY_MANUAL: Record<StatName, string> = { charisma: "", strength: "", combat: "", arcana: "" };

type EntryMode = "roll" | "manual";

export function Creator({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (character: Character) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [statMode, setStatMode] = useState<EntryMode>("roll");
  const [hpMode, setHpMode] = useState<EntryMode>("roll");
  const [pool, setPool] = useState<StatPool | null>(null);
  const [slots, setSlots] = useState<Record<StatName, number | null>>(EMPTY_SLOTS);
  const [manualStats, setManualStats] = useState<Record<StatName, string>>(EMPTY_MANUAL);
  const [hpRoll, setHpRoll] = useState<HitPointRoll | null>(null);
  const [manualHp, setManualHp] = useState("");
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
    const stats = statMode === "roll" ? rolledStats() : typedStats();
    if (!stats) return;
    const hp = hpMode === "roll" ? hpRoll?.total : parsePositiveInteger(manualHp);
    if (hp == null) {
      return setError(hpMode === "roll" ? "Roll hit points." : "Enter hit points as a whole number, 1 or more.");
    }
    if (!tagCountAllowed(cleanTags.length, true)) return setError("A new hero carries 3 to 5 tags.");
    if (!Number.isFinite(ac)) return setError("AC has to be a number. Handwritten scores under 10 are allowed.");
    const strength = stats.strength + (armor.strengthBonus ?? 0);
    const arcana = stats.arcana;
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
      charisma: stats.charisma,
      strength,
      combat: stats.combat,
      arcana,
      hp,
      hpMax: hp,
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

  const rolledStats = (): Record<StatName, number> | null => {
    if (!pool || STATS.some((stat) => assigned[stat] == null)) {
      setError("Roll the sets, then assign all four.");
      return null;
    }
    return {
      charisma: assigned.charisma ?? 0,
      strength: assigned.strength ?? 0,
      combat: assigned.combat ?? 0,
      arcana: assigned.arcana ?? 0,
    };
  };

  const typedStats = (): Record<StatName, number> | null => {
    const parsed = {
      charisma: parsePositiveInteger(manualStats.charisma),
      strength: parsePositiveInteger(manualStats.strength),
      combat: parsePositiveInteger(manualStats.combat),
      arcana: parsePositiveInteger(manualStats.arcana),
    };
    if (STATS.some((stat) => parsed[stat] == null)) {
      setError("Enter a whole number, 1 or more, for each stat.");
      return null;
    }
    return parsed as Record<StatName, number>;
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
          <Kicker>{statMode === "roll" ? "Stats · 5×3d4, drop the lowest total" : "Stats · from the paper sheet"}</Kicker>
          <ModeToggle label="How to set stats" value={statMode} onChange={setStatMode} />
          {statMode === "roll" ? (
            <>
              <Button className="mt-3" tone="ghost" onClick={() => { setPool(rollStatPool()); setSlots(EMPTY_SLOTS); }}>
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
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-mute">Copy the numbers from paper. Any whole number from 1 up is allowed.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {STATS.map((stat) => (
                  <NumberEntry
                    key={stat}
                    label={STAT_LABEL[stat]}
                    value={manualStats[stat]}
                    onChange={(value) => setManualStats({ ...manualStats, [stat]: value })}
                  />
                ))}
              </div>
            </>
          )}
        </Card>
        <Card>
          <Kicker>{hpMode === "roll" ? "Hit points · 5d10, drop the lowest" : "Hit points · from the paper sheet"}</Kicker>
          <ModeToggle label="How to set hit points" value={hpMode} onChange={setHpMode} />
          {hpMode === "roll" ? (
            <>
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
            </>
          ) : (
            <div className="mt-3">
              <NumberEntry label="Hit points" value={manualHp} onChange={setManualHp} />
            </div>
          )}
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

function ModeToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const options: { mode: EntryMode; text: string }[] = [
    { mode: "roll", text: "Roll" },
    { mode: "manual", text: "Enter manually" },
  ];
  return (
    <div role="group" aria-label={label} className="mt-3 grid grid-cols-2 gap-2">
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={value === option.mode}
          className={cx(
            "min-h-11 rounded-xl border px-2 text-center text-sm font-medium leading-tight",
            value === option.mode ? "border-brass bg-brass text-ink" : "border-line bg-ink text-paper",
          )}
          onClick={() => onChange(option.mode)}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

function NumberEntry({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const invalid = value.trim() !== "" && parsePositiveInteger(value) == null;
  return (
    <label className="grid gap-1 text-sm">
      <span>{label}</span>
      <TextField inputMode="numeric" aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      {invalid ? <span className="text-xs text-hp">Use a whole number, 1 or more.</span> : null}
    </label>
  );
}
