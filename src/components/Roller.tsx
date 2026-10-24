"use client";

import { useMemo, useState } from "react";
import type { Action, Character, Foe, LogKind, Spell, StatName, Weapon } from "@/lib/model";
import { effectiveAc, statValue } from "@/lib/model";
import {
  damageBonus,
  outcomeLabel,
  resolveAttack,
  resolveCast,
  resolveCheck,
  type AttackResult,
  type CastResult,
  type CheckResult,
} from "@/lib/rules";
import { QUICK_DCS } from "@/lib/data/catalog";
import { Button, Kicker } from "./ui";

type Kind = "attack" | "cast" | "check";

export function Roller({
  kind,
  character,
  weapon,
  spell,
  foes,
  heroes,
  canSpend,
  dispatch,
  onClose,
}: {
  kind: Kind;
  character: Character;
  weapon?: Weapon;
  spell?: Spell;
  foes: Foe[];
  heroes: Character[];
  canSpend: boolean;
  dispatch: (action: Action) => Promise<unknown>;
  onClose: () => void;
}) {
  const [tagId, setTagId] = useState("");
  const [hitStat, setHitStat] = useState<StatName | "none">(weapon?.hitStat ?? "combat");
  const [targetId, setTargetId] = useState(foes[0]?.id ?? "custom");
  const [ac, setAc] = useState(String(foes[0]?.ac ?? 12));
  const [dc, setDc] = useState(12);
  const [focus, setFocus] = useState(Boolean(character.focusOn && character.focusCastBonus));
  const [checkStat, setCheckStat] = useState<StatName>("combat");
  const [saveMade, setSaveMade] = useState(false);
  const [healId, setHealId] = useState(character.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blows, setBlows] = useState<Blow[] | null>(null);
  const [cast, setCast] = useState<CastResult | null>(null);
  const [check, setCheck] = useState<CheckResult | null>(null);

  const foe = foes.find((item) => item.id === targetId);
  const count = weapon?.attacksPerRound ?? 1;
  const tagArmed = Boolean(tagId);

  const title = kind === "attack" ? weapon?.name : kind === "cast" ? spell?.name : "Check";

  const rollDie = () => 1 + Math.floor(Math.random() * 12);

  const attackOnce = (d12: number, heroPlus: number, locked: number | null): AttackResult => {
    const statName = hitStat;
    const bonusName = weapon?.bonusStat ?? weapon?.hitStat ?? "none";
    return resolveAttack({
      d12,
      stat: statValue(character, statName),
      tagBonus: tagArmed ? 2 : 0,
      heroPlus,
      ac: Number(ac) || 0,
      ignoreAc: weapon?.ignoreAc,
      damageExpression: weapon?.damage ?? "0",
      damageBonus: damageBonus(statValue(character, bonusName), weapon?.bonusMode ?? "half"),
      energyShield: Boolean(foe?.energyShield),
      overheatsOnNat1: weapon?.overheatsOnNat1,
      lockedDiceTotal: locked,
    });
  };

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(12);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The roll didn't land.");
    } finally {
      setBusy(false);
    }
  };

  const log = (kindName: LogKind, summary: string) => dispatch({ type: "log", kind: kindName, summary });

  const rollAttack = () =>
    run(async () => {
      const next = Array.from({ length: count }, () => {
        const d12 = rollDie();
        return { d12, heroPlus: 0, result: attackOnce(d12, 0, null) };
      });
      setBlows(next);
      const overheated = next.some((blow) => blow.result.overheated);
      if (overheated && weapon) {
        await dispatch({
          type: "patchCharacter",
          characterId: character.id,
          patch: { weapons: character.weapons.map((item) => (item.id === weapon.id ? { ...item, overheated: true } : item)) },
        });
      }
      await log("roll", attackSummary(character.name, weapon?.name ?? "Strike", next.map((blow) => blow.result)));
    });

  const adjust = (index: number, mode: "reroll" | "plus4") =>
    run(async () => {
      await dispatch({ type: "spendHero", characterId: character.id, reason: mode });
      const fresh = mode === "reroll" ? rollDie() : null;
      setBlows((current) => {
        if (!current) return current;
        return current.map((blow, i) => {
          if (i !== index) return blow;
          if (fresh != null) return { d12: fresh, heroPlus: 0, result: attackOnce(fresh, 0, null) };
          const heroPlus = blow.heroPlus + 4;
          return { ...blow, heroPlus, result: attackOnce(blow.d12, heroPlus, blow.result.diceTotal) };
        });
      });
    });

  const rollCast = () =>
    run(async () => {
      if (!spell) return;
      await dispatch({ type: "spendMana", characterId: character.id, amount: spell.cost });
      const d12 = rollDie();
      const result = resolveCast({
        d12,
        arcana: character.arcana,
        dc,
        tagBonus: tagArmed ? 2 : 0,
        focusBonus: focus ? character.focusCastBonus ?? 0 : 0,
        damageExpression: spell.damage,
        healExpression: spell.heal,
        bonusMode: spell.bonusMode,
        tempAc: spell.tempAc,
      });
      setCast(result);
      const end = result.fizzle ? "Fizzle. The mana stays spent." : result.potent ? "Potent." : "It takes.";
      await log("spell", `${character.name} casts ${spell.name} (${spell.cost} mana). ${result.equation}. ${end}`);
    });

  const rerollCast = () =>
    run(async () => {
      if (!spell) return;
      await dispatch({ type: "spendHero", characterId: character.id, reason: "reroll" });
      const d12 = rollDie();
      const result = resolveCast({
        d12,
        arcana: character.arcana,
        dc,
        tagBonus: tagArmed ? 2 : 0,
        focusBonus: focus ? character.focusCastBonus ?? 0 : 0,
        damageExpression: spell.damage,
        healExpression: spell.heal,
        bonusMode: spell.bonusMode,
        tempAc: spell.tempAc,
      });
      setCast(result);
      await log("spell", `${character.name} rerolls ${spell.name}. ${result.equation}. ${result.fizzle ? "Fizzle." : "It takes."}`);
    });

  const plusCast = () =>
    run(async () => {
      if (!spell || !cast) return;
      await dispatch({ type: "spendHero", characterId: character.id, reason: "plus4" });
      const previous =
        cast.total - cast.d12 - character.arcana - (tagArmed ? 2 : 0) - (focus ? character.focusCastBonus ?? 0 : 0);
      const result = resolveCast({
        d12: cast.d12,
        arcana: character.arcana,
        dc,
        tagBonus: tagArmed ? 2 : 0,
        focusBonus: focus ? character.focusCastBonus ?? 0 : 0,
        heroPlus: previous + 4,
        damageExpression: spell.damage,
        healExpression: spell.heal,
        bonusMode: spell.bonusMode,
        tempAc: spell.tempAc,
        lockedDiceTotal: cast.diceTotal,
      });
      setCast(result);
    });

  const rollCheck = () =>
    run(async () => {
      const d12 = rollDie();
      const result = resolveCheck({
        d12,
        stat: character[checkStat],
        dc,
        tagBonus: tagArmed ? 2 : 0,
      });
      setCheck(result);
      await log("roll", `${character.name} checks ${checkStat}. ${result.equation}. ${result.success ? "Success." : "Short."}`);
    });

  const harm = blows ? blows.reduce((sum, blow) => sum + shownDamage(blow.result, saveMade), 0) : 0;
  const castDamage = cast?.damage == null ? null : saveMade ? Math.floor(cast.damage / 2) : cast.damage;

  const applyAttack = () =>
    run(async () => {
      if (!foe || !blows) return;
      const swallowed = blows.some((blow) => blow.result.shieldDropped);
      const names = blows.map((blow) => outcomeLabel(blow.result.outcome)).join(", ");
      await dispatch({
        type: "applyHarm",
        target: { kind: "foe", id: foe.id },
        amount: harm,
        direction: "harm",
        breakShield: swallowed,
        summary: `${character.name} hits ${foe.name}: ${names}, ${harm} damage.${swallowed ? " The energy shield drops." : ""}`,
      });
      onClose();
    });

  const applyCast = () =>
    run(async () => {
      if (!spell || !cast?.success) return;
      if (castDamage != null && foe) {
        await dispatch({
          type: "applyHarm",
          target: { kind: "foe", id: foe.id },
          amount: castDamage,
          direction: "harm",
          summary: `${spell.name} deals ${castDamage} to ${foe.name}.`,
        });
      }
      if (cast.healing) {
        const who = heroes.find((hero) => hero.id === healId);
        await dispatch({
          type: "applyHarm",
          target: { kind: "character", id: healId },
          amount: cast.healing,
          direction: "heal",
          summary: `${spell.name} heals ${who?.name ?? "them"} for ${cast.healing}.`,
        });
      }
      if (cast.tempAc) {
        const ids = spell.aoeAc ? heroes.filter((hero) => hero.seated).map((hero) => hero.id) : [healId];
        await dispatch({ type: "grantCover", characterIds: ids, tempAc: cast.tempAc });
      }
      onClose();
    });

  const seatedAllies = useMemo(() => heroes.filter((hero) => hero.seated), [heroes]);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink px-4 py-5">
      <div className="mx-auto grid max-w-lg gap-4 pb-24">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Kicker>{character.name}</Kicker>
            <h2 className="font-display text-3xl leading-tight">{title}</h2>
          </div>
          <Button tone="quiet" onClick={onClose}>Close</Button>
        </div>

        {kind !== "check" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-mute">Target</span>
            <select className="min-h-11 rounded-xl border border-line bg-panel px-3" value={targetId} onChange={(event) => {
              setTargetId(event.target.value);
              const next = foes.find((item) => item.id === event.target.value);
              if (next) setAc(String(next.ac));
            }}>
              {foes.map((item) => (
                <option key={item.id} value={item.id}>{item.name} · AC {item.ac}{item.energyShield ? " · shield" : ""}</option>
              ))}
              <option value="custom">Type an AC</option>
            </select>
          </label>
        ) : null}

        {kind === "attack" ? (
          <label className="grid gap-1 text-sm">
            <span className="text-mute">AC</span>
            <input className="num min-h-11 rounded-xl border border-line bg-panel px-3" inputMode="numeric" value={ac} onChange={(event) => setAc(event.target.value)} />
          </label>
        ) : (
          <div className="flex flex-wrap gap-2">
            {QUICK_DCS.map((value) => (
              <Button key={value} tone={dc === value ? "brass" : "ghost"} onClick={() => setDc(value)}>DC {value}</Button>
            ))}
            <input className="num min-h-11 w-24 rounded-xl border border-line bg-panel px-3" inputMode="numeric" value={dc} aria-label="Difficulty" onChange={(event) => setDc(Number(event.target.value) || 0)} />
          </div>
        )}

        {weapon?.altHitStat ? (
          <div className="flex gap-2">
            <Button tone={hitStat === weapon.hitStat ? "brass" : "ghost"} onClick={() => setHitStat(weapon.hitStat)}>To hit {weapon.hitStat}</Button>
            <Button tone={hitStat === weapon.altHitStat ? "brass" : "ghost"} onClick={() => setHitStat(weapon.altHitStat ?? weapon.hitStat)}>
              To hit {weapon.altHitStat}
            </Button>
          </div>
        ) : null}

        {kind === "check" ? (
          <div className="flex flex-wrap gap-2">
            {(["charisma", "strength", "combat", "arcana"] as StatName[]).map((stat) => (
              <Button key={stat} tone={checkStat === stat ? "brass" : "ghost"} onClick={() => setCheckStat(stat)}>
                {stat} {character[stat]}
              </Button>
            ))}
          </div>
        ) : null}

        <label className="grid gap-1 text-sm">
          <span className="text-mute">Tag, declared before the roll · +2</span>
          <select className="min-h-11 rounded-xl border border-line bg-panel px-3" value={tagId} onChange={(event) => setTagId(event.target.value)}>
            <option value="">No tag</option>
            {character.tags.map((tag) => (
              <option key={tag.id} value={tag.id}>{tag.label}</option>
            ))}
          </select>
        </label>

        {kind === "cast" && character.focusCastBonus ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={focus} onChange={(event) => setFocus(event.target.checked)} />
            Staff focus +{character.focusCastBonus} to the casting roll
          </label>
        ) : null}

        {!blows && !cast && !check ? (
          <Button disabled={busy} onClick={() => void (kind === "attack" ? rollAttack() : kind === "cast" ? rollCast() : rollCheck())}>
            {kind === "cast" ? `Spend ${spell?.cost ?? 0} and roll` : count > 1 ? `Roll ${count} attacks` : "Roll the d12"}
          </Button>
        ) : null}

        {blows?.map((blow, index) => (
          <article key={index} className="rounded-2xl border border-line bg-panel p-4">
            <p className="num text-6xl font-medium leading-none text-brass">{blow.d12}</p>
            <p className="mt-2 text-sm text-mute">{blow.result.equation}</p>
            <p className="mt-1 text-xl">{outcomeLabel(blow.result.outcome)}</p>
            <p className="num text-lg">{shownDamage(blow.result, false)} damage{blow.result.diceText ? ` · ${blow.result.diceText}` : ""}</p>
            {blow.result.overheated ? <p className="mt-2 text-sm text-hp">The weapon overheats. A rest clears it.</p> : null}
            {canSpend && character.heroPoints > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button tone="ghost" disabled={busy} onClick={() => void adjust(index, "reroll")}>Reroll · 1</Button>
                <Button tone="ghost" disabled={busy} onClick={() => void adjust(index, "plus4")}>+4 · 1</Button>
              </div>
            ) : null}
          </article>
        ))}

        {cast ? (
          <article className="rounded-2xl border border-line bg-panel p-4">
            <p className="num text-6xl font-medium leading-none text-brass">{cast.d12}</p>
            <p className="mt-2 text-sm text-mute">{cast.equation}</p>
            <p className="mt-1 text-xl">{cast.fizzle ? "Fizzle" : cast.potent ? "Potent" : "Success"}</p>
            {cast.damage != null ? <p className="num text-lg">{castDamage} damage · {cast.diceText}</p> : null}
            {cast.healing != null ? <p className="num text-lg">Heal {cast.healing}</p> : null}
            {cast.fizzle ? <p className="mt-2 text-sm text-mute">The mana stays spent.</p> : null}
            {canSpend && character.heroPoints > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button tone="ghost" disabled={busy} onClick={() => void rerollCast()}>Reroll · 1 · mana stays spent</Button>
                <Button tone="ghost" disabled={busy} onClick={() => void plusCast()}>+4 · 1</Button>
              </div>
            ) : null}
          </article>
        ) : null}

        {check ? (
          <article className="rounded-2xl border border-line bg-panel p-4">
            <p className="num text-6xl font-medium leading-none text-brass">{check.d12}</p>
            <p className="mt-2 text-sm text-mute">{check.equation}</p>
            <p className="mt-1 text-xl">{check.success ? "Success" : "Short"}</p>
          </article>
        ) : null}

        {(spell?.saveForHalf || weapon?.notes?.toLowerCase().includes("half")) && (blows || cast?.damage != null) ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saveMade} onChange={(event) => setSaveMade(event.target.checked)} />
            They made the save. Half damage, rounded down.
          </label>
        ) : null}

        {cast?.healing ? (
          <label className="grid gap-1 text-sm">
            <span className="text-mute">Heal</span>
            <select className="min-h-11 rounded-xl border border-line bg-panel px-3" value={healId} onChange={(event) => setHealId(event.target.value)}>
              {seatedAllies.map((hero) => (
                <option key={hero.id} value={hero.id}>{hero.name}</option>
              ))}
            </select>
          </label>
        ) : null}

        {cast?.tempAc && !cast.healing ? (
          <label className="grid gap-1 text-sm">
            <span className="text-mute">{spell?.aoeAc ? "Cover lands on the seated sheets you can edit" : "Ward"}</span>
            {spell?.aoeAc ? null : (
              <select className="min-h-11 rounded-xl border border-line bg-panel px-3" value={healId} onChange={(event) => setHealId(event.target.value)}>
                {seatedAllies.map((hero) => (
                  <option key={hero.id} value={hero.id}>{hero.name}</option>
                ))}
              </select>
            )}
          </label>
        ) : null}

        {blows && foe ? (
          <Button disabled={busy || harm < 0} onClick={() => void applyAttack()}>
            Apply {harm} to {foe.name}
          </Button>
        ) : null}
        {cast?.success && (cast.damage != null || cast.healing || cast.tempAc) ? (
          <Button disabled={busy} onClick={() => void applyCast()}>Apply the spell</Button>
        ) : null}

        {canSpend && character.heroPoints > 0 ? (
          <Button
            tone="quiet"
            disabled={busy}
            onClick={() => void run(async () => {
              const beat = window.prompt("What advantage do they seize?");
              if (!beat?.trim()) return;
              await dispatch({ type: "spendHero", characterId: character.id, reason: "narrative" });
              await log("hero", `${character.name}: ${beat.trim()}`);
            })}
          >
            Narrative beat · 1 hero point
          </Button>
        ) : null}

        <p className="text-sm text-mute">Hero points {character.heroPoints}. A reroll keeps the new die. A cast that misses still spends its mana.</p>
        {error ? <p className="text-sm text-hp">{error}</p> : null}
      </div>
    </div>
  );
}

type Blow = { d12: number; heroPlus: number; result: AttackResult };

function shownDamage(result: AttackResult, save: boolean): number {
  return save ? Math.floor(result.damage / 2) : result.damage;
}

function attackSummary(name: string, weapon: string, results: AttackResult[]): string {
  const parts = results.map((result) => `${result.equation}. ${outcomeLabel(result.outcome)} ${result.damage}`);
  return `${name} — ${weapon}. ${parts.join(" · ")}`;
}

export function heroAc(character: Character): number {
  return effectiveAc(character);
}
