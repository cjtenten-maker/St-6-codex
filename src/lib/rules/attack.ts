import { assertD12, maxDice, rollDice } from "./dice";
import { RuleError } from "./errors";

export type BonusMode = "half" | "full" | "none";

/**
 * Damage adds half the governing stat, rounded down.
 * A Combat of 11 adds 5, not 11.
 * Judge's Edge and Grino's shota add the full stat. `none` adds nothing
 * (the sheet already wrote a flat number into the dice).
 */
export function damageBonus(stat: number, mode: BonusMode): number {
  if (mode === "none") return 0;
  if (!Number.isFinite(stat)) throw new RuleError("That stat isn't a number.");
  if (mode === "full") return stat;
  return Math.floor(Math.max(0, stat) / 2);
}

export type AttackInput = {
  d12: number;
  /** Full stat added to the d12. Zero when the weapon has no hit stat. */
  stat: number;
  /** +2 when a tag was declared before the roll. */
  tagBonus?: number;
  /** +4 for each hero point spent after the d12. */
  heroPlus?: number;
  ac: number;
  /** +1 when the defender is holding a defensive tag. */
  defensiveAc?: number;
  tempAc?: number;
  /** Points of AC the weapon ignores (energy sword, shota, plasma grenade). */
  ignoreAc?: number;
  damageExpression: string;
  /** Already resolved with `damageBonus`. Not rolled. */
  damageBonus: number;
  energyShield?: boolean;
  overheatsOnNat1?: boolean;
  /** Faces for the damage dice, in order. Tests pass these. A miss rolls none. */
  fixedFaces?: number[];
  rng?: () => number;
  /**
   * Dice total already rolled for this attack, before the stat bonus and
   * before halving. A hero-point +4 reuses it when the blow was already a hit.
   */
  lockedDiceTotal?: number | null;
};

export type AttackOutcome = "full-potential" | "full" | "half" | "miss" | "swallowed";

export type AttackResult = {
  d12: number;
  total: number;
  effectiveAc: number;
  outcome: AttackOutcome;
  /** Harm to mark. Zero on a miss or a swallowed full-potential. */
  damage: number;
  diceTotal: number | null;
  diceText: string;
  shieldDropped: boolean;
  overheated: boolean;
  equation: string;
};

/**
 * To hit: d12 + stat vs AC.
 * Higher is full damage, a tie is half rounded down, lower is a miss.
 * A natural 12 is full potential (max dice + bonus), even if the total
 * would have missed. A natural 1 is not an automatic miss.
 * An energy shield swallows one full-potential hit, then drops.
 */
export function resolveAttack(input: AttackInput): AttackResult {
  assertD12(input.d12);
  const tag = input.tagBonus ?? 0;
  const hero = input.heroPlus ?? 0;
  if (tag !== 0 && tag !== 2) throw new RuleError("A tag adds +2 to the roll, or nothing.");
  if (hero < 0 || hero % 4 !== 0) throw new RuleError("A hero point adds +4 after the d12.");
  const total = input.d12 + input.stat + tag + hero;
  const effectiveAc =
    input.ac + (input.defensiveAc ?? 0) + (input.tempAc ?? 0) - (input.ignoreAc ?? 0);
  const overheated = input.d12 === 1 && Boolean(input.overheatsOnNat1);
  const equation = equationFor(input.d12, input.stat, tag, hero, total, effectiveAc);

  if (input.d12 === 12) {
    const damage = maxDice(input.damageExpression) + input.damageBonus;
    if (input.energyShield) {
      return {
        d12: 12,
        total,
        effectiveAc,
        outcome: "swallowed",
        damage: 0,
        diceTotal: null,
        diceText: "full potential",
        shieldDropped: true,
        overheated,
        equation,
      };
    }
    return {
      d12: 12,
      total,
      effectiveAc,
      outcome: "full-potential",
      damage,
      diceTotal: maxDice(input.damageExpression),
      diceText: "full potential",
      shieldDropped: false,
      overheated,
      equation,
    };
  }

  if (total < effectiveAc) {
    return {
      d12: input.d12,
      total,
      effectiveAc,
      outcome: "miss",
      damage: 0,
      diceTotal: null,
      diceText: "",
      shieldDropped: false,
      overheated,
      equation,
    };
  }

  const rolled = rollDamage(input);
  const full = rolled.diceTotal + input.damageBonus;
  const hit = total > effectiveAc;
  const damage = hit ? full : Math.floor(full / 2);
  return {
    d12: input.d12,
    total,
    effectiveAc,
    outcome: hit ? "full" : "half",
    damage,
    diceTotal: rolled.diceTotal,
    diceText: rolled.diceText,
    shieldDropped: false,
    overheated,
    equation,
  };
}

function rollDamage(input: AttackInput): { diceTotal: number; diceText: string } {
  if (input.lockedDiceTotal != null) {
    return { diceTotal: input.lockedDiceTotal, diceText: String(input.lockedDiceTotal) };
  }
  const rolled = rollDice(input.damageExpression, input.rng ?? Math.random, input.fixedFaces);
  return { diceTotal: rolled.total, diceText: rolled.text };
}

function equationFor(
  d12: number,
  stat: number,
  tag: number,
  hero: number,
  total: number,
  ac: number,
): string {
  const parts = [`${d12}`];
  if (stat) parts.push(signed(stat));
  if (tag) parts.push(signed(tag));
  if (hero) parts.push(signed(hero));
  return `${parts.join(" ")} = ${total} vs AC ${ac}`;
}

function signed(n: number): string {
  return n >= 0 ? `+ ${n}` : `− ${Math.abs(n)}`;
}

export function outcomeLabel(outcome: AttackOutcome): string {
  switch (outcome) {
    case "full-potential":
      return "Full potential";
    case "full":
      return "Full damage";
    case "half":
      return "Half damage";
    case "miss":
      return "Miss";
    case "swallowed":
      return "Swallowed";
  }
}
