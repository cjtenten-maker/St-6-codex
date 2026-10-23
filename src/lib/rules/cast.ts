import { assertD12, maxDice, rollDice } from "./dice";
import { damageBonus, type BonusMode } from "./attack";
import { RuleError } from "./errors";

/** Mana maximum is Arcana × 2. Willow's 13 is 26. */
export function manaMaximum(arcana: number): number {
  if (!Number.isFinite(arcana)) throw new RuleError("Arcana isn't a number.");
  return Math.max(0, Math.trunc(arcana)) * 2;
}

/**
 * Casting spends mana first. The roll happens after.
 * Not enough mana: nothing is spent and there is no roll.
 */
export function spendMana(current: number, cost: number): { ok: boolean; mana: number } {
  if (!Number.isInteger(cost) || cost < 0) throw new RuleError("Mana cost has to be a whole number.");
  if (current < cost) return { ok: false, mana: current };
  return { ok: true, mana: current - cost };
}

export type CastInput = {
  d12: number;
  arcana: number;
  dc: number;
  tagBonus?: number;
  /** Judge's Edge staff, when it is the focus. */
  focusBonus?: number;
  heroPlus?: number;
  damageExpression?: string;
  healExpression?: string;
  /** Default half Arcana. `none` when the sheet gives dice and no stat. */
  bonusMode?: BonusMode;
  tempAc?: number;
  fixedFaces?: number[];
  rng?: () => number;
  lockedDiceTotal?: number | null;
};

export type CastResult = {
  d12: number;
  total: number;
  dc: number;
  success: boolean;
  /** A natural 12 on a successful cast. Max dice. */
  potent: boolean;
  fizzle: boolean;
  damage: number | null;
  healing: number | null;
  tempAc: number;
  diceText: string;
  /** Dice total before the stat bonus. A hero-point +4 reuses it. */
  diceTotal: number | null;
  equation: string;
};

/**
 * Roll d12 + Arcana against the GM's DC (usually 10–15).
 * A miss fizzles. Mana already spent stays spent.
 * A natural 12 succeeds and is potent even if the total is under the DC.
 */
export function resolveCast(input: CastInput): CastResult {
  assertD12(input.d12);
  const tag = input.tagBonus ?? 0;
  const focus = input.focusBonus ?? 0;
  const hero = input.heroPlus ?? 0;
  if (tag !== 0 && tag !== 2) throw new RuleError("A tag adds +2 to the roll, or nothing.");
  const total = input.d12 + input.arcana + tag + focus + hero;
  const potent = input.d12 === 12;
  const success = potent || total >= input.dc;
  const equation = `${describeCast(input.d12, input.arcana, tag, focus, hero)} = ${total} vs DC ${input.dc}`;
  if (!success) {
    return {
      d12: input.d12,
      total,
      dc: input.dc,
      success: false,
      potent: false,
      fizzle: true,
      damage: null,
      healing: null,
      tempAc: 0,
      diceText: "",
      diceTotal: null,
      equation,
    };
  }
  const mode = input.bonusMode ?? (input.damageExpression || input.healExpression ? "half" : "none");
  const bonus = damageBonus(input.arcana, mode);
  const damage = input.damageExpression
    ? effectNumber(input.damageExpression, potent, bonus, input)
    : null;
  const healing = input.healExpression
    ? effectNumber(input.healExpression, potent, bonus, input)
    : null;
  const rolled = damage ?? healing;
  return {
    d12: input.d12,
    total,
    dc: input.dc,
    success: true,
    potent,
    fizzle: false,
    damage: damage?.value ?? null,
    healing: healing?.value ?? null,
    tempAc: input.tempAc ?? 0,
    diceText: rolled?.text ?? "",
    diceTotal: rolled?.diceTotal ?? null,
    equation,
  };
}

function effectNumber(
  expression: string,
  potent: boolean,
  bonus: number,
  input: CastInput,
): { value: number; text: string; diceTotal: number } {
  if (potent) {
    const max = maxDice(expression);
    return { value: max + bonus, text: "full potential", diceTotal: max };
  }
  if (input.lockedDiceTotal != null) {
    return { value: input.lockedDiceTotal + bonus, text: String(input.lockedDiceTotal), diceTotal: input.lockedDiceTotal };
  }
  const rolled = rollDice(expression, input.rng ?? Math.random, input.fixedFaces);
  return { value: rolled.total + bonus, text: rolled.text, diceTotal: rolled.total };
}

function describeCast(d12: number, arcana: number, tag: number, focus: number, hero: number): string {
  const parts = [`${d12}`, `+ ${arcana}`];
  if (tag) parts.push(`+ ${tag}`);
  if (focus) parts.push(`+ ${focus}`);
  if (hero) parts.push(`+ ${hero}`);
  return parts.join(" ");
}

export type CheckResult = {
  d12: number;
  total: number;
  dc: number;
  success: boolean;
  equation: string;
};

/** A check is d12 + stat against a DC the GM names. Meet it or beat it. */
export function resolveCheck(input: {
  d12: number;
  stat: number;
  dc: number;
  tagBonus?: number;
  heroPlus?: number;
}): CheckResult {
  assertD12(input.d12);
  const tag = input.tagBonus ?? 0;
  const hero = input.heroPlus ?? 0;
  const total = input.d12 + input.stat + tag + hero;
  const parts = [`${input.d12}`, `+ ${input.stat}`];
  if (tag) parts.push(`+ ${tag}`);
  if (hero) parts.push(`+ ${hero}`);
  return {
    d12: input.d12,
    total,
    dc: input.dc,
    success: total >= input.dc,
    equation: `${parts.join(" ")} = ${total} vs DC ${input.dc}`,
  };
}
