import { describe, expect, it } from "vitest";
import {
  damageBonus,
  longRest,
  manaMaximum,
  maxDice,
  resolveAttack,
  resolveCast,
  resolveCheck,
  parsePositiveInteger,
  rollHitPoints,
  rollStatPool,
  shortRest,
  spendMana,
  stackedAc,
  tagCountAllowed,
} from "./index";

const faces = (...fixedFaces: number[]) => fixedFaces;

describe("to hit", () => {
  it("deals full damage when the total is higher than AC", () => {
    const result = resolveAttack({
      d12: 8,
      stat: 11,
      ac: 17,
      damageExpression: "2d6",
      damageBonus: damageBonus(11, "half"),
      fixedFaces: faces(3, 4),
    });
    expect(result.total).toBe(19);
    expect(result.outcome).toBe("full");
    expect(result.damage).toBe(3 + 4 + 5);
  });

  it("adds 5 for Combat 11, not 11", () => {
    expect(damageBonus(11, "half")).toBe(5);
    expect(damageBonus(11, "full")).toBe(11);
    expect(damageBonus(9, "half")).toBe(4);
    expect(damageBonus(12, "half")).toBe(6);
    expect(damageBonus(1, "half")).toBe(0);
  });

  it("deals half the damage, rounded down, on a tie", () => {
    const result = resolveAttack({
      d12: 6,
      stat: 11,
      ac: 17,
      damageExpression: "1d8",
      damageBonus: 5,
      fixedFaces: faces(4),
    });
    expect(result.total).toBe(17);
    expect(result.outcome).toBe("half");
    expect(result.damage).toBe(Math.floor((4 + 5) / 2));
  });

  it("rounds a 1 down to 0 on a tie", () => {
    const result = resolveAttack({
      d12: 6,
      stat: 4,
      ac: 10,
      damageExpression: "1d4",
      damageBonus: 0,
      fixedFaces: faces(1),
    });
    expect(result.outcome).toBe("half");
    expect(result.damage).toBe(0);
  });

  it("misses when the total is lower, and a natural 1 is not an automatic miss", () => {
    const miss = resolveAttack({
      d12: 4,
      stat: 11,
      ac: 17,
      damageExpression: "1d6",
      damageBonus: 5,
    });
    expect(miss.outcome).toBe("miss");
    expect(miss.damage).toBe(0);

    const nat1Hit = resolveAttack({
      d12: 1,
      stat: 20,
      ac: 10,
      damageExpression: "1d6",
      damageBonus: 0,
      fixedFaces: faces(4),
      overheatsOnNat1: true,
    });
    expect(nat1Hit.outcome).toBe("full");
    expect(nat1Hit.damage).toBe(4);
    expect(nat1Hit.overheated).toBe(true);
  });

  it("overheats an energy sword on a natural 1 even when the attack misses", () => {
    const result = resolveAttack({
      d12: 1,
      stat: 0,
      ac: 15,
      damageExpression: "2d6",
      damageBonus: 0,
      overheatsOnNat1: true,
    });
    expect(result.outcome).toBe("miss");
    expect(result.overheated).toBe(true);
  });

  it("treats a natural 12 as full potential, max dice plus the bonus", () => {
    const result = resolveAttack({
      d12: 12,
      stat: 0,
      ac: 30,
      damageExpression: "2d6",
      damageBonus: 5,
    });
    expect(result.outcome).toBe("full-potential");
    expect(result.damage).toBe(12 + 5);
    expect(maxDice("2d6")).toBe(12);
    expect(maxDice("1d10+1d4")).toBe(14);
    expect(maxDice("1d6+1")).toBe(7);
  });

  it("uses the full stat for Judge's Edge and the shota", () => {
    const edge = resolveAttack({
      d12: 12,
      stat: 12,
      ac: 10,
      damageExpression: "1d6",
      damageBonus: damageBonus(12, "full"),
    });
    expect(edge.damage).toBe(6 + 12);

    const shota = resolveAttack({
      d12: 12,
      stat: 8,
      ac: 18,
      ignoreAc: 2,
      damageExpression: "2d6",
      damageBonus: damageBonus(8, "full"),
    });
    expect(shota.effectiveAc).toBe(16);
    expect(shota.damage).toBe(12 + 8);
  });

  it("lets an energy shield swallow one full-potential hit and then drop", () => {
    const swallowed = resolveAttack({
      d12: 12,
      stat: 8,
      ac: 14,
      damageExpression: "2d6",
      damageBonus: 4,
      energyShield: true,
    });
    expect(swallowed.outcome).toBe("swallowed");
    expect(swallowed.damage).toBe(0);
    expect(swallowed.shieldDropped).toBe(true);

    const ordinary = resolveAttack({
      d12: 11,
      stat: 8,
      ac: 14,
      damageExpression: "2d6",
      damageBonus: 4,
      energyShield: true,
      fixedFaces: faces(3, 3),
    });
    expect(ordinary.outcome).toBe("full");
    expect(ordinary.damage).toBe(10);
    expect(ordinary.shieldDropped).toBe(false);
  });

  it("adds a tag's +2 before the comparison, or +1 AC when the tag is defensive", () => {
    const bare = resolveAttack({
      d12: 8,
      stat: 7,
      ac: 17,
      damageExpression: "1d6",
      damageBonus: 0,
      fixedFaces: faces(6),
    });
    expect(bare.outcome).toBe("miss");

    const tagged = resolveAttack({
      d12: 8,
      stat: 7,
      tagBonus: 2,
      ac: 17,
      damageExpression: "1d6",
      damageBonus: 0,
      fixedFaces: faces(6),
    });
    expect(tagged.total).toBe(17);
    expect(tagged.outcome).toBe("half");

    const defended = resolveAttack({
      d12: 8,
      stat: 9,
      ac: 17,
      defensiveAc: 1,
      damageExpression: "1d6",
      damageBonus: 0,
    });
    expect(defended.total).toBe(17);
    expect(defended.effectiveAc).toBe(18);
    expect(defended.outcome).toBe("miss");
  });

  it("lets a hero point's +4 change the result without rerolling damage dice", () => {
    const opened = resolveAttack({
      d12: 6,
      stat: 6,
      heroPlus: 4,
      ac: 15,
      damageExpression: "1d8",
      damageBonus: 2,
      lockedDiceTotal: 5,
    });
    expect(opened.total).toBe(16);
    expect(opened.outcome).toBe("full");
    expect(opened.damage).toBe(7);
  });

  it("ignores AC by the weapon's amount", () => {
    const result = resolveAttack({
      d12: 5,
      stat: 6,
      ac: 12,
      ignoreAc: 2,
      damageExpression: "1d6",
      damageBonus: 0,
      fixedFaces: faces(2),
    });
    expect(result.effectiveAc).toBe(10);
    expect(result.outcome).toBe("full");
  });
});

describe("mana and casting", () => {
  it("sets mana maximum to Arcana times 2", () => {
    expect(manaMaximum(8)).toBe(16);
    expect(manaMaximum(12)).toBe(24);
    expect(manaMaximum(13)).toBe(26);
    expect(manaMaximum(10)).toBe(20);
  });

  it("spends mana before the roll and does not refund a fizzle", () => {
    const blocked = spendMana(1, 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.mana).toBe(1);

    const spent = spendMana(10, 2);
    expect(spent).toEqual({ ok: true, mana: 8 });
    const fizzle = resolveCast({ d12: 2, arcana: 10, dc: 15 });
    expect(fizzle.fizzle).toBe(true);
    expect(fizzle.success).toBe(false);
    expect(fizzle.damage).toBeNull();
    expect(spent.mana).toBe(8);
  });

  it("does not spend mana again when the cast is rerolled", () => {
    const spent = spendMana(10, 2);
    const rerolledPool = spent.mana;
    const second = resolveCast({ d12: 11, arcana: 10, dc: 12, damageExpression: "1d8", fixedFaces: faces(3) });
    expect(second.success).toBe(true);
    expect(rerolledPool).toBe(8);
  });

  it("makes a natural 12 potent, with maximum dice, even under the DC", () => {
    const potent = resolveCast({
      d12: 12,
      arcana: 1,
      dc: 15,
      damageExpression: "2d8",
      fixedFaces: faces(1, 1),
    });
    expect(potent.total).toBe(13);
    expect(potent.success).toBe(true);
    expect(potent.potent).toBe(true);
    expect(potent.damage).toBe(16 + damageBonus(1, "half"));
  });

  it("adds half Arcana to a successful spell, including Elowynne's", () => {
    const cast = resolveCast({
      d12: 8,
      arcana: 10,
      dc: 12,
      damageExpression: "1d10",
      fixedFaces: faces(7),
    });
    expect(cast.success).toBe(true);
    expect(cast.potent).toBe(false);
    expect(cast.damage).toBe(7 + 5);
  });

  it("adds the staff's +1 and a tag before the DC", () => {
    const cast = resolveCast({ d12: 4, arcana: 6, focusBonus: 1, tagBonus: 2, dc: 12 });
    expect(cast.total).toBe(13);
    expect(cast.success).toBe(true);
  });

  it("heals and can grant temporary AC only on a success", () => {
    const heal = resolveCast({ d12: 9, arcana: 10, dc: 12, healExpression: "1d8", fixedFaces: faces(6) });
    expect(heal.healing).toBe(6 + 5);
    const ward = resolveCast({ d12: 9, arcana: 12, dc: 10, tempAc: 2 });
    expect(ward.tempAc).toBe(2);
    const failed = resolveCast({ d12: 2, arcana: 4, dc: 15, tempAc: 2, healExpression: "1d8" });
    expect(failed.tempAc).toBe(0);
    expect(failed.healing).toBeNull();
  });

  it("meets a check on a tie and keeps a natural 1 in the math", () => {
    expect(resolveCheck({ d12: 5, stat: 7, dc: 12 }).success).toBe(true);
    expect(resolveCheck({ d12: 1, stat: 8, dc: 12 }).success).toBe(false);
    expect(resolveCheck({ d12: 1, stat: 11, dc: 12 }).success).toBe(true);
  });
});

describe("rests, hero points, creation", () => {
  it("restores Arcana mana on a short rest and no hit points", () => {
    const rested = shortRest(
      { hp: 10, hpMax: 30, mana: 3, arcana: 10, tempAc: 2, defenseTagActive: true },
      20,
    );
    expect(rested).toEqual({ hp: 10, mana: 13, tempAc: 0, defenseTagActive: false });
  });

  it("caps a short rest at mana maximum and still gives 1 if Arcana is 0", () => {
    const capped = shortRest({ hp: 4, hpMax: 4, mana: 14, arcana: 10, tempAc: 0, defenseTagActive: false }, 20);
    expect(capped.mana).toBe(20);
    const minimum = shortRest({ hp: 4, hpMax: 4, mana: 0, arcana: 0, tempAc: 1, defenseTagActive: true }, 0);
    expect(minimum.mana).toBe(0);
    expect(minimum.tempAc).toBe(0);
    const emptyMax = shortRest({ hp: 4, hpMax: 4, mana: 0, arcana: 0, tempAc: 0, defenseTagActive: false }, 2);
    expect(emptyMax.mana).toBe(1);
  });

  it("fills hit points and mana on a long rest", () => {
    const rested = longRest(
      { hp: 4, hpMax: 23, mana: 14, arcana: 10, tempAc: 2, defenseTagActive: true },
      20,
    );
    expect(rested).toEqual({ hp: 23, mana: 20, tempAc: 0, defenseTagActive: false });
  });

  it("rolls five 3d4 sets, drops the lowest total, and leaves four to assign", () => {
    const sequence = [1, 1, 1, 4, 4, 4, 2, 2, 2, 3, 3, 3, 1, 2, 3];
    let i = 0;
    const pool = rollStatPool(() => (sequence[i++] - 1) / 4);
    expect(pool.sets).toEqual([3, 12, 6, 9, 6]);
    expect(pool.droppedIndex).toBe(0);
    expect(pool.kept).toEqual([12, 6, 9, 6]);
    for (let n = 0; n < 200; n++) {
      const rolled = rollStatPool(Math.random);
      expect(rolled.sets).toHaveLength(5);
      expect(rolled.kept).toHaveLength(4);
      expect(Math.min(...rolled.sets)).toBe(rolled.sets[rolled.droppedIndex]);
      for (const set of rolled.sets) expect(set).toBeGreaterThanOrEqual(3);
      for (const set of rolled.sets) expect(set).toBeLessThanOrEqual(12);
    }
  });

  it("rolls 5d10 for hit points and drops the lowest die", () => {
    const sequence = [10, 1, 8, 8, 7];
    let i = 0;
    const hp = rollHitPoints(() => (sequence[i++] - 1) / 10);
    expect(hp.rolls).toEqual([10, 1, 8, 8, 7]);
    expect(hp.droppedIndex).toBe(1);
    expect(hp.total).toBe(33);
    for (let n = 0; n < 200; n++) {
      const rolled = rollHitPoints(Math.random);
      expect(rolled.total).toBeGreaterThanOrEqual(4);
      expect(rolled.total).toBeLessThanOrEqual(40);
    }
  });

  it("asks a new character for 3 to 5 tags and caps armor plus shield at 20", () => {
    expect(tagCountAllowed(3, true)).toBe(true);
    expect(tagCountAllowed(5, true)).toBe(true);
    expect(tagCountAllowed(2, true)).toBe(false);
    expect(tagCountAllowed(0, false)).toBe(true);
    expect(tagCountAllowed(6, false)).toBe(false);
    expect(stackedAc(18, 3)).toBe(20);
    expect(stackedAc(10, 0)).toBe(10);
    expect(stackedAc(14, 2)).toBe(16);
  });

  it("accepts any positive whole number and refuses anything else", () => {
    expect(parsePositiveInteger("1")).toBe(1);
    expect(parsePositiveInteger(" 18 ")).toBe(18);
    expect(parsePositiveInteger("99")).toBe(99);
    expect(parsePositiveInteger("2")).toBe(2);
    expect(parsePositiveInteger("400")).toBe(400);
    expect(parsePositiveInteger("")).toBeNull();
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger("-3")).toBeNull();
    expect(parsePositiveInteger("1.5")).toBeNull();
    expect(parsePositiveInteger("12d")).toBeNull();
    expect(parsePositiveInteger("01")).toBeNull();
  });
});
