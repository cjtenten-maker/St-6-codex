import { describe, expect, it } from "vitest";
import {
  bankTank,
  overloadStrike,
  spendTankPoints,
  tankAfterLongRest,
  tankCap,
  tankToDamage,
  TANK_ON_BRACE,
  TANK_ON_DAMAGE,
} from "./tank";

describe("kinetic tank", () => {
  it("caps at 3 times Combat", () => {
    expect(tankCap(12)).toBe(36);
    expect(tankCap(8)).toBe(24);
    expect(tankCap(0)).toBe(0);
    expect(tankCap(11.9)).toBe(33);
  });

  it("banks 2 points per damage and never passes the cap", () => {
    expect(TANK_ON_DAMAGE).toBe(2);
    expect(bankTank(13, 4, 36, 2)).toBe(21);
    expect(bankTank(30, 5, 36, 2)).toBe(36);
    expect(bankTank(36, 8, 36, 2)).toBe(36);
    expect(bankTank(0, 0, 36, 2)).toBe(0);
  });

  it("banks 3 per damage when Brace is the rate", () => {
    expect(TANK_ON_BRACE).toBe(3);
    expect(bankTank(0, 4, 36, 3)).toBe(12);
    expect(bankTank(34, 2, 36, 3)).toBe(36);
  });

  it("spends only what is there", () => {
    expect(spendTankPoints(13, 5)).toBe(8);
    expect(spendTankPoints(13, 0)).toBe(13);
    expect(() => spendTankPoints(4, 5)).toThrow(/not enough/i);
    expect(() => spendTankPoints(4, 1.5)).toThrow(/whole number/i);
  });

  it("turns a spend into damage, and doubles an overload", () => {
    expect(tankToDamage(5, 2)).toBe(2);
    expect(tankToDamage(1, 2)).toBe(0);
    expect(tankToDamage(4, 2)).toBe(2);
    expect(tankToDamage(7, 1)).toBe(7);
    expect(overloadStrike(5)).toBe(10);
    expect(overloadStrike(0)).toBe(0);
  });

  it("empties on a long rest and drops a pending Brace or Overload", () => {
    expect(tankAfterLongRest({ points: 13, brace: true, overload: 4 })).toEqual({ points: 0 });
    expect(tankAfterLongRest(undefined)).toBeUndefined();
  });
});
