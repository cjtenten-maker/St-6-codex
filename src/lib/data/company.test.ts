import { describe, expect, it } from "vitest";
import { manaMaximum } from "../rules";
import { companyCharacters } from "./company";

describe("the company from the brief", () => {
  const company = companyCharacters();

  it("seats all ten, unclaimed, with the spellings from the brief", () => {
    expect(company.map((character) => character.name)).toEqual([
      "Naibroch Britheam",
      "Elowynne",
      "Willow",
      "Mystie",
      "Emma",
      "Nixy",
      "Rob Goodfellow",
      "Apple Pot",
      "Grino",
      "Reginald Crowe",
    ]);
    expect(company.every((character) => character.ownerId === null && character.seated)).toBe(true);
  });

  it("keeps the written numbers", () => {
    const expectLine = (
      name: string,
      line: { cha: number; str: number; com: number; arc: number; hp: number; mana: number; ac: number; hero: number; tags: number },
    ) => {
      const character = company.find((item) => item.name === name);
      expect(character, name).toBeTruthy();
      expect(character).toMatchObject({
        charisma: line.cha,
        strength: line.str,
        combat: line.com,
        arcana: line.arc,
        hp: line.hp,
        hpMax: line.hp,
        mana: line.mana,
        ac: line.ac,
        heroPoints: line.hero,
      });
      expect(character?.tags).toHaveLength(line.tags);
      expect(manaMaximum(line.arc)).toBe(character?.name === "Reginald Crowe" ? 20 : line.mana);
    };

    expectLine("Naibroch Britheam", { cha: 10, str: 9, com: 11, arc: 12, hp: 36, mana: 24, ac: 17, hero: 3, tags: 4 });
    expectLine("Elowynne", { cha: 9, str: 8, com: 8, arc: 10, hp: 29, mana: 20, ac: 14, hero: 3, tags: 3 });
    expectLine("Willow", { cha: 9, str: 10, com: 7, arc: 13, hp: 27, mana: 26, ac: 7, hero: 3, tags: 0 });
    expectLine("Mystie", { cha: 7, str: 8, com: 8, arc: 10, hp: 31, mana: 20, ac: 6, hero: 3, tags: 2 });
    expectLine("Emma", { cha: 12, str: 11, com: 10, arc: 10, hp: 34, mana: 20, ac: 6, hero: 3, tags: 0 });
    expectLine("Nixy", { cha: 12, str: 8, com: 10, arc: 12, hp: 33, mana: 24, ac: 8, hero: 3, tags: 1 });
    expectLine("Rob Goodfellow", { cha: 12, str: 6, com: 7, arc: 11, hp: 37, mana: 22, ac: 17, hero: 3, tags: 3 });
    expectLine("Apple Pot", { cha: 10, str: 11, com: 10, arc: 10, hp: 28, mana: 20, ac: 10, hero: 3, tags: 1 });
    expectLine("Grino", { cha: 6, str: 8, com: 8, arc: 8, hp: 32, mana: 16, ac: 17, hero: 3, tags: 1 });
    expectLine("Reginald Crowe", { cha: 7, str: 7, com: 10, arc: 10, hp: 23, mana: 14, ac: 14, hero: 3, tags: 3 });
  });

  it("gives full-stat damage only to Judge's Edge and the shota", () => {
    const full = company.flatMap((character) =>
      character.weapons.filter((weapon) => weapon.bonusMode === "full").map((weapon) => `${character.name}: ${weapon.name}`),
    );
    expect(full).toEqual([
      "Naibroch Britheam: Judge's Edge — Staff",
      "Naibroch Britheam: Judge's Edge — Greatsword",
      "Naibroch Britheam: Judge's Edge — Bow",
      "Grino: Shota",
    ]);
    const shota = company.find((character) => character.name === "Grino")?.weapons.find((weapon) => weapon.name === "Shota");
    expect(shota?.ignoreAc).toBe(2);
    const staff = company.find((character) => character.name === "Naibroch Britheam");
    expect(staff?.focusCastBonus).toBe(1);
    expect(staff?.focusOn).toBe(true);
  });

  it("leaves the calls in the notes: unexplained +2s, the suit, conditional AC, tallies", () => {
    const notes = company.map((character) => `${character.name} ${character.notes}`).join("\n");
    expect(notes).toMatch(/12\+2/);
    expect(notes).toContain("not added");
    expect(notes).toContain("not applied");
    expect(notes).toContain("not counted");
    expect(company.find((character) => character.name === "Rob Goodfellow")?.suit).toMatchObject({
      on: true,
      onCha: 12,
      offCha: 9,
      onAc: 17,
      offAc: 14,
    });
    expect(company.find((character) => character.name === "Emma")?.charisma).toBe(12);
    expect(company.find((character) => character.name === "Nixy")?.arcana).toBe(12);
    expect(company.find((character) => character.name === "Grino")?.arcana).toBe(8);
  });
});
