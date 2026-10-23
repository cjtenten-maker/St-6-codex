import { describe, expect, it } from "vitest";
import { ID } from "../ids";
import type { Action, Character, TableState } from "../model";
import { HERO_START } from "../rules";
import { createDemoState } from "./demo";
import { exportTable, parseCodexFile } from "./export";
import { present } from "./present";
import { applyAction, type ActionContext } from "./reducer";

function ctx(actorId: string, ids: string[]): ActionContext {
  return { actorId, now: "2026-10-23T00:00:00.000Z", id: () => ids.shift() ?? "id-extra" };
}

function run(state: TableState, action: Action, actorId: string, id = "log-1"): TableState {
  return applyAction(state, action, ctx(actorId, [id]));
}

function character(state: TableState, id: string): Character {
  const found = state.characters.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
}

describe("two players and a GM handoff", () => {
  it("lets Corbin take the screen, hides his notes from Trish, and hands them to her", () => {
    let state = createDemoState();
    expect(state.table.gmEligibleIds).toEqual([ID.corbin, ID.trish, ID.justin]);
    expect(present(state, ID.trish).table.gmNotes).toBe("");

    state = run(state, { type: "claimGm" }, ID.corbin, "gm-1");
    expect(state.table.currentGmId).toBe(ID.corbin);
    expect(character(state, ID.naibroch).seated).toBe(false);
    expect(character(state, ID.elowynne).seated).toBe(true);
    expect(state.table.turnOrder).not.toContain(ID.naibroch);
    expect(present(state, ID.corbin).table.gmNotes).toContain("Elowynne's name");
    expect(present(state, ID.trish).table.gmNotes).toBe("");

    state = run(state, { type: "setGmNotes", notes: "The gate is barred from the inside." }, ID.corbin, "note-1");
    state = run(state, { type: "claimGm" }, ID.trish, "gm-2");
    expect(state.table.currentGmId).toBe(ID.trish);
    expect(state.table.gmNotes).toBe("The gate is barred from the inside.");
    expect(character(state, ID.elowynne).seated).toBe(false);
    expect(character(state, ID.naibroch).seated).toBe(false);
    expect(present(state, ID.trish).table.gmNotes).toContain("barred");
    expect(present(state, ID.corbin).table.gmNotes).toBe("");
  });

  it("refuses the screen to someone who isn't eligible", () => {
    const guest = { id: "10000000-0000-4000-8000-000000000009", displayName: "Guest", email: "guest@table.local" };
    let state = run(createDemoState(), { type: "join", member: guest }, ID.corbin);
    expect(() => run(state, { type: "claimGm" }, guest.id)).toThrow(/eligible/i);
    expect(() =>
      run(state, { type: "setEligible", memberIds: [ID.corbin, ID.trish, ID.justin, guest.id, ID.corbin] }, guest.id),
    ).toThrow(/GM/);
    state = run(
      state,
      { type: "setEligible", memberIds: [ID.corbin, ID.trish, ID.justin, guest.id] },
      ID.corbin,
    );
    expect(state.table.gmEligibleIds).toHaveLength(4);
    expect(() =>
      run(state, { type: "setEligible", memberIds: [ID.corbin, ID.trish, ID.justin, guest.id, "10000000-0000-4000-8000-000000000008"] }, ID.corbin),
    ).toThrow(/isn't at this table|limit/i);
  });

  it("resets hero points only for heroes in the seats", () => {
    let state = createDemoState();
    state = {
      ...state,
      characters: state.characters.map((item) => {
        if (item.id === ID.elowynne) return { ...item, heroPoints: 8 };
        if (item.id === ID.naibroch) return { ...item, heroPoints: 6 };
        return item;
      }),
    };
    state = run(state, { type: "claimGm" }, ID.corbin, "gm");
    state = run(state, { type: "startSession" }, ID.corbin, "session");
    expect(state.table.sessionActive).toBe(true);
    expect(character(state, ID.elowynne).heroPoints).toBe(HERO_START);
    expect(character(state, ID.naibroch).heroPoints).toBe(6);
    expect(character(state, ID.naibroch).seated).toBe(false);
  });

  it("rests only the seated, and a long rest fills hit points", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    state = applyAction(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.elowynne },
        amount: 9,
        direction: "harm",
        onlySeated: true,
        summary: "Elowynne takes 9.",
      },
      ctx(ID.corbin, ["harm"]),
    );
    state = applyAction(
      state,
      { type: "spendMana", characterId: ID.elowynne, amount: 8 },
      ctx(ID.trish, ["mana"]),
    );
    state = applyAction(
      state,
      { type: "patchCharacter", characterId: ID.naibroch, patch: { hp: 20, mana: 4, tempAc: 2 } },
      ctx(ID.corbin, ["patch"]),
    );
    state = run(state, { type: "shortRest" }, ID.corbin, "short");
    expect(character(state, ID.elowynne).hp).toBe(20);
    expect(character(state, ID.elowynne).mana).toBe(20);
    expect(character(state, ID.naibroch).hp).toBe(20);
    expect(character(state, ID.naibroch).mana).toBe(4);
    expect(character(state, ID.naibroch).tempAc).toBe(2);

    state = applyAction(
      state,
      { type: "spendMana", characterId: ID.reginald, amount: 0 },
      ctx(ID.corbin, ["noop"]),
    );
    state = run(state, { type: "longRest" }, ID.corbin, "long");
    expect(character(state, ID.elowynne).hp).toBe(29);
    expect(character(state, ID.elowynne).mana).toBe(20);
    expect(character(state, ID.reginald).mana).toBe(20);
    expect(character(state, ID.reginald).hp).toBe(23);
    expect(character(state, ID.naibroch).mana).toBe(4);
  });

  it("refuses a trouble strike against someone sitting out", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    expect(() =>
      run(state, {
        type: "applyHarm",
        target: { kind: "character", id: ID.naibroch },
        amount: 5,
        direction: "harm",
        onlySeated: true,
        summary: "no",
      }, ID.corbin),
    ).toThrow(/seated/i);
  });

  it("caps the seats at 12 and the company at 48", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.justin, "gm");
    const seated = state.characters.filter((item) => item.seated).map((item) => item.id);
    expect(seated).toHaveLength(9);
    expect(() => run(state, { type: "setSeated", characterIds: seated }, ID.justin)).not.toThrow();
    const tooMany = [...seated, "a", "b", "c", "d"].slice(0, 13);
    expect(() => run(state, { type: "setSeated", characterIds: tooMany }, ID.justin)).toThrow(/Twelve/);

    state = createDemoState();
    const filler = (n: number): Character => ({
      ...state.characters[2],
      id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      name: `Extra ${n}`,
      playerName: "",
      ownerId: null,
      seated: false,
    });
    for (let n = 0; n < 38; n++) {
      state = run(state, { type: "addCharacter", character: filler(n) }, ID.corbin, `add-${n}`);
    }
    expect(state.characters).toHaveLength(48);
    expect(() => run(state, { type: "addCharacter", character: filler(99) }, ID.corbin)).toThrow(/48/);
  });

  it("lets players reorder themselves and keeps a claimed sheet private to its player", () => {
    let state = createDemoState();
    const before = state.table.turnOrder.indexOf(ID.elowynne);
    state = run(state, { type: "moveTurn", characterId: ID.elowynne, direction: -1 }, ID.trish);
    expect(state.table.turnOrder.indexOf(ID.elowynne)).toBe(before - 1);
    state = run(state, { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    expect(() =>
      run(state, { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 1 } }, ID.corbin),
    ).toThrow(/someone else/i);
    state = run(state, { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 12 } }, ID.trish);
    expect(character(state, ID.elowynne).hp).toBe(12);
  });

  it("caps hero points at 8 and spends one for a beat", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    for (let n = 0; n < 5; n++) state = run(state, { type: "awardHero", characterId: ID.willow }, ID.corbin, `award-${n}`);
    expect(character(state, ID.willow).heroPoints).toBe(8);
    expect(() => run(state, { type: "awardHero", characterId: ID.willow }, ID.corbin)).toThrow(/cap/i);
    state = run(state, { type: "spendHero", characterId: ID.willow, reason: "narrative" }, ID.corbin, "spend");
    expect(character(state, ID.willow).heroPoints).toBe(7);
    expect(state.log.some((entry) => entry.kind === "hero" && entry.summary.includes("narrative"))).toBe(true);
  });

  it("round-trips a table through JSON, notes included only for the GM", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    state = run(state, { type: "setGmNotes", notes: "Private." }, ID.corbin, "notes");
    const full = parseCodexFile(exportTable(state, true, "2026-10-23T00:00:00.000Z"));
    expect(full.includeGmNotes).toBe(true);
    expect(full.state.table.gmNotes).toBe("Private.");
    expect(full.state.characters).toHaveLength(10);
    const hidden = parseCodexFile(exportTable(present(state, ID.trish), false));
    expect(hidden.state.table.gmNotes).toBe("");
    expect(hidden.includeGmNotes).toBe(false);
  });

  it("puts the suit on and off without treating it as a rest bonus", () => {
    const state = run(createDemoState(), {
      type: "patchCharacter",
      characterId: ID.rob,
      patch: { suit: { on: false, onCha: 12, offCha: 9, onAc: 17, offAc: 14 } },
    }, ID.justin);
    expect(character(state, ID.rob).charisma).toBe(9);
    expect(character(state, ID.rob).ac).toBe(14);
  });

  it("lets a healer mend a seated ally and raise their AC", () => {
    let state = run(createDemoState(), { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    state = run(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.naibroch },
        amount: 10,
        direction: "harm",
        summary: "Naibroch takes 10.",
      },
      ID.trish,
      "harm",
    );
    state = run(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.naibroch },
        amount: 6,
        direction: "heal",
        summary: "Elowynne mends Naibroch for 6.",
      },
      ID.trish,
      "heal",
    );
    expect(character(state, ID.naibroch).hp).toBe(32);
    state = run(state, { type: "grantCover", characterIds: [ID.naibroch, ID.elowynne], tempAc: 2 }, ID.trish, "cover");
    expect(character(state, ID.naibroch).tempAc).toBe(2);
    expect(character(state, ID.elowynne).tempAc).toBe(2);
  });

  it("records rolls, harm, spells, and advances on the session log", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    state = run(state, { type: "startSession" }, ID.corbin, "session");
    state = run(state, { type: "log", kind: "roll", summary: "Elowynne rolls 8 + Combat 8 = 16 vs AC 13. Full damage 9." }, ID.trish, "roll");
    state = run(state, { type: "log", kind: "spell", summary: "Thorn Lash fizzles. 1 mana spent." }, ID.corbin, "spell");
    state = run(state, { type: "advance", characterId: ID.elowynne, text: "She remembers a hallway of blue glass." }, ID.trish, "advance");
    const kinds = state.log.map((entry) => entry.kind);
    expect(kinds).toEqual(expect.arrayContaining(["session", "roll", "spell", "advance"]));
  });
});
