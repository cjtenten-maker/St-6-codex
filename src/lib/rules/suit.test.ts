import { describe, expect, it } from "vitest";
import type { Suit } from "../model";
import { hpAfterSuit, suitToggleLabel } from "./suit";

const mask = (on: boolean): Suit => ({
  on,
  name: "Bronze Lion Mask",
  onCha: 8,
  offCha: 8,
  onAc: 10,
  offAc: 15,
  onHpMax: 38,
  offHpMax: 28,
});

describe("suit hit points", () => {
  it("adds the bonus when the mask goes on, and caps at the on maximum", () => {
    expect(hpAfterSuit(20, mask(false), mask(true))).toBe(30);
    expect(hpAfterSuit(28, mask(false), mask(true))).toBe(38);
  });

  it("removes the bonus when the mask comes off, and keeps damage that was taken", () => {
    expect(hpAfterSuit(34, mask(true), mask(false))).toBe(24);
    expect(hpAfterSuit(15, mask(true), mask(false))).toBe(5);
    expect(hpAfterSuit(8, mask(true), mask(false))).toBe(0);
    expect(hpAfterSuit(38, mask(true), mask(false))).toBe(28);
  });

  it("does not grant the bonus just because the suit was attached", () => {
    expect(hpAfterSuit(20, undefined, mask(false))).toBe(20);
    expect(hpAfterSuit(30, undefined, mask(false))).toBe(28);
  });

  it("leaves hit points alone for a suit that only changes Charisma and AC", () => {
    const worn: Suit = { on: true, onCha: 12, offCha: 9, onAc: 17, offAc: 14 };
    const off: Suit = { ...worn, on: false };
    expect(hpAfterSuit(37, worn, off)).toBe(37);
    expect(hpAfterSuit(37, off, worn)).toBe(37);
  });

  it("keeps the jester wording and names the mask", () => {
    expect(suitToggleLabel({ on: true, onCha: 12, offCha: 9, onAc: 17, offAc: 14 })).toBe(
      "Suit on · Charisma 12, AC 17",
    );
    expect(suitToggleLabel(mask(false))).toBe("Bronze Lion Mask off · AC 15, max HP 28");
    expect(suitToggleLabel(mask(true))).toBe("Bronze Lion Mask on · AC 10, max HP 38");
  });
});
