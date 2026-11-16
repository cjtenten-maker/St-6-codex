import type { KineticTank } from "../model";
import { RuleError } from "./errors";

/** Cap is Combat × 3. Impulse's Combat 12 caps at 36. */
export const TANK_PER_COMBAT = 3;
/** Every 1 damage banks this many points, unless Brace is armed. */
export const TANK_ON_DAMAGE = 2;
/** Brace banks this many points per damage on the triggering hit. */
export const TANK_ON_BRACE = 3;

export function tankCap(combat: number): number {
  if (!Number.isFinite(combat)) throw new RuleError("Combat isn't a number.");
  return Math.max(0, Math.trunc(combat)) * TANK_PER_COMBAT;
}

export function clampTank(points: number, cap: number): number {
  const limit = Math.max(0, Math.trunc(cap));
  const current = Number.isFinite(points) ? Math.trunc(points) : 0;
  return Math.min(limit, Math.max(0, current));
}

/** Damage taken adds `perDamage` points, and the result never passes the cap. */
export function bankTank(points: number, damage: number, cap: number, perDamage: number): number {
  const dealt = Math.max(0, Math.trunc(damage));
  const rate = Math.max(0, Math.trunc(perDamage));
  return clampTank(Math.trunc(points) + dealt * rate, cap);
}

export function spendTankPoints(points: number, amount: number): number {
  if (!Number.isInteger(amount) || amount < 0) throw new RuleError("Spend a whole number of tank points.");
  const current = Math.max(0, Math.trunc(points));
  if (current < amount) throw new RuleError("Not enough in the tank.");
  return current - amount;
}

/** Every `pointsPerDamage` tank points become 1 damage, rounded down. */
export function tankToDamage(spent: number, pointsPerDamage = 1): number {
  const rate = Math.max(1, Math.trunc(pointsPerDamage));
  const points = Math.max(0, Math.trunc(spent));
  return Math.floor(points / rate);
}

/** Overload: the next melee hit adds twice the points that were spent. */
export function overloadStrike(spent: number): number {
  return Math.max(0, Math.trunc(spent)) * 2;
}

export function normalizeTank(combat: number, tank: KineticTank | null | undefined): KineticTank | undefined {
  if (!tank) return undefined;
  const next: KineticTank = { points: clampTank(tank.points, tankCap(combat)) };
  if (tank.brace) next.brace = true;
  if (tank.overload != null && Math.trunc(tank.overload) > 0) next.overload = Math.trunc(tank.overload);
  return next;
}

/** Keep Brace and Overload when only the point total changes. */
export function tankWithPoints(tank: KineticTank, points: number): KineticTank {
  const next: KineticTank = { points };
  if (tank.brace) next.brace = true;
  if (tank.overload != null && tank.overload > 0) next.overload = Math.trunc(tank.overload);
  return next;
}

/**
 * A long rest empties the tank.
 * Brace and Overload are mid-fight, so they end here too.
 */
export function tankAfterLongRest(tank: KineticTank | undefined): KineticTank | undefined {
  if (!tank) return undefined;
  return { points: 0 };
}

export function tankChanged(before: KineticTank | undefined, after: KineticTank | undefined): boolean {
  if (!before && !after) return false;
  if (!before || !after) return true;
  return before.points !== after.points || Boolean(before.brace) !== Boolean(after.brace) || (before.overload ?? 0) !== (after.overload ?? 0);
}

export function tankLog(name: string, before: KineticTank | undefined, after: KineticTank | undefined): string {
  if (!after) return `${name}'s kinetic tank is off.`;
  if (!before) return `${name}'s kinetic tank is on at ${after.points}.`;
  const parts: string[] = [];
  if (before.points !== after.points) parts.push(`${before.points} → ${after.points}`);
  if (after.brace && !before.brace) parts.push("Brace is armed");
  if (!after.brace && before.brace) parts.push("Brace ends");
  if ((after.overload ?? 0) !== (before.overload ?? 0)) {
    parts.push(after.overload ? `Overload ${after.overload}` : "Overload ends");
  }
  return `${name}'s kinetic tank: ${parts.join(". ")}.`;
}
