import { describe, expect, it } from "vitest";
import { ID } from "../ids";
import { effectiveAc } from "../model";
import { createDemoState } from "./demo";
import { present } from "./present";
import { allyAttackLog, allyTargets, foeAttackLog } from "./strike";

describe("friendly fire targets", () => {
  it("names an ally and a foe in the log", () => {
    expect(allyAttackLog("Impulse", "Nora", "Full damage, 9 damage.")).toBe(
      "Impulse attacks Nora (ally): Full damage, 9 damage.",
    );
    expect(foeAttackLog("Wolf", "Bandit", "Full damage 6.")).toBe("Wolf attacks Bandit (foe). Full damage 6.");
  });

  it("offers seated allies with their strike armor class, and skips a card that has none", () => {
    const state = createDemoState();
    const shown = present(state, ID.trish);
    const elowynne = state.characters.find((character) => character.id === ID.elowynne);
    const naibroch = shown.characters.find((character) => character.id === ID.naibroch);
    const realNaibroch = state.characters.find((character) => character.id === ID.naibroch);
    if (!elowynne || !naibroch || !realNaibroch) throw new Error("missing");
    expect(elowynne.concealed).toBeFalsy();
    expect(naibroch.concealed).toBe(true);
    expect(naibroch.ac).toBe(0);
    expect(naibroch.strike?.ac).toBe(effectiveAc(realNaibroch));
    expect(naibroch.hp).toBe(0);

    const mixed = state.characters.map((character) =>
      character.id === ID.elowynne ? character : (shown.characters.find((card) => card.id === character.id) ?? character),
    );
    const allies = allyTargets(mixed, ID.elowynne);
    expect(allies.some((ally) => ally.id === ID.elowynne)).toBe(false);
    const naibrochTarget = allies.find((ally) => ally.id === ID.naibroch);
    expect(naibrochTarget?.ac).toBe(naibroch.strike?.ac);
    expect(naibrochTarget?.energyShield).toBe(false);

    const hidden = { ...naibroch, strike: undefined };
    const without = allyTargets(
      mixed.map((character) => (character.id === ID.naibroch ? hidden : character)),
      ID.elowynne,
    );
    expect(without.some((ally) => ally.id === ID.naibroch)).toBe(false);

    const satOut = allyTargets(
      mixed.map((character) => (character.id === ID.naibroch ? { ...character, seated: false } : character)),
      ID.elowynne,
    );
    expect(satOut.some((ally) => ally.id === ID.naibroch)).toBe(false);
  });
});