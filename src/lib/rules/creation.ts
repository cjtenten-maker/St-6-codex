import { rollDie } from "./dice";

export type StatPool = {
  /** Five totals of 3d4, in the order rolled. */
  sets: number[];
  droppedIndex: number;
  /** The four totals left to assign. */
  kept: number[];
};

/**
 * Roll 5 sets of 3d4. Drop the lowest total. Assign the other four.
 * One lowest set is dropped; a second set with the same total is kept.
 */
export function rollStatPool(rng: () => number = Math.random): StatPool {
  const sets = [0, 1, 2, 3, 4].map(() => rollDie(4, rng) + rollDie(4, rng) + rollDie(4, rng));
  let droppedIndex = 0;
  for (let i = 1; i < sets.length; i++) {
    if (sets[i] < sets[droppedIndex]) droppedIndex = i;
  }
  return {
    sets,
    droppedIndex,
    kept: sets.filter((_, i) => i !== droppedIndex),
  };
}

export type HitPointRoll = {
  rolls: number[];
  droppedIndex: number;
  total: number;
};

/** Roll 5d10 and drop the lowest die. */
export function rollHitPoints(rng: () => number = Math.random): HitPointRoll {
  const rolls = [0, 1, 2, 3, 4].map(() => rollDie(10, rng));
  let droppedIndex = 0;
  for (let i = 1; i < rolls.length; i++) {
    if (rolls[i] < rolls[droppedIndex]) droppedIndex = i;
  }
  const total = rolls.reduce((sum, face, i) => sum + (i === droppedIndex ? 0 : face), 0);
  return { rolls, droppedIndex, total };
}

/**
 * A whole number of 1 or more, as written.
 * Zero, fractions, and blank text are refused. The dice ranges are not checked.
 */
export function parsePositiveInteger(raw: string): number | null {
  const text = raw.trim();
  if (!/^[1-9]\d*$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/** New characters carry 3 to 5 tags. Sheets already written may have fewer. */
export function tagCountAllowed(count: number, fresh: boolean): boolean {
  if (fresh) return count >= 3 && count <= 5;
  return count >= 0 && count <= 5;
}

/** Armor plus a shield, never past 20. A handwritten AC bypasses this. */
export function stackedAc(base: number, shieldBonus: number): number {
  return Math.min(20, base + shieldBonus);
}
