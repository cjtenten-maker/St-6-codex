import type { Suit } from "../model";

function whole(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return Math.trunc(value);
}

/** Max hit points for the suit's current state. Null when the suit does not change them. */
export function suitHpMax(suit: Suit | undefined): number | null {
  if (!suit) return null;
  const on = whole(suit.onHpMax);
  const off = whole(suit.offHpMax);
  if (on == null || off == null) return null;
  const raw = suit.on ? on : off;
  return Math.max(1, raw);
}

/** Hit points the suit adds while it is on. The Bronze Lion Mask adds 10. */
export function suitBonusHp(suit: Suit): number {
  const on = whole(suit.onHpMax);
  const off = whole(suit.offHpMax);
  if (on == null || off == null) return 0;
  return on - off;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The bonus hit points exist only while the suit is on.
 * Putting it on adds that bonus to current HP, capped at the on maximum.
 * Taking it off subtracts the same bonus, then clamps to 0 and the off maximum.
 * Damage taken while it was on stays taken: a hero at 34 of 38 who removes a
 * +10 mask is at 24 of 28, not healed back to 28. A suit with no hit-point
 * fields, such as the jester suit, leaves current HP alone.
 * Attaching a suit for the first time does not add or remove the bonus.
 * It only clamps to the maximum for the state already written on the sheet.
 */
export function hpAfterSuit(currentHp: number, before: Suit | undefined, after: Suit): number {
  const nextMax = suitHpMax(after);
  const hp = Number.isFinite(currentHp) ? Math.trunc(currentHp) : 0;
  if (nextMax == null) return Math.max(0, hp);
  const hadHp = suitHpMax(before) != null;
  const flipped = Boolean(before && hadHp && before.on !== after.on);
  if (!flipped) return clamp(hp, 0, nextMax);
  const delta = after.on ? suitBonusHp(after) : -suitBonusHp(after);
  return clamp(hp + delta, 0, nextMax);
}

/** The jester suit keeps its old wording. The mask names itself and its hit points. */
export function suitToggleLabel(suit: Suit): string {
  const name = suit.name?.trim() || "Suit";
  const state = suit.on ? "on" : "off";
  const cha = suit.on ? suit.onCha : suit.offCha;
  const ac = suit.on ? suit.onAc : suit.offAc;
  const hpMax = suit.on ? suit.onHpMax : suit.offHpMax;
  let label = `${name} ${state}`;
  if (suit.onCha !== suit.offCha) label += ` · Charisma ${cha}, AC ${ac}`;
  else label += ` · AC ${ac}`;
  if (hpMax != null && suit.onHpMax != null && suit.offHpMax != null) label += `, max HP ${hpMax}`;
  return label;
}
