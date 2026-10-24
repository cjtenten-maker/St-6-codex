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
      ctx(ID.corbin, ["mana"]),
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
    expect(full.state.trouble.some((item) => item.name === "Wolf")).toBe(true);
    const hidden = parseCodexFile(exportTable(present(state, ID.trish), false));
    expect(hidden.state.table.gmNotes).toBe("");
    expect(hidden.includeGmNotes).toBe(false);
    expect(hidden.state.characters).toHaveLength(0);
    expect(hidden.state.trouble).toEqual([]);
    expect(JSON.stringify(hidden)).not.toContain("Judge's Edge");
    expect(JSON.stringify(hidden)).not.toContain("Cult speaker");
  });

  it("puts the suit on and off without treating it as a rest bonus", () => {
    let state = run(createDemoState(), { type: "claim", characterId: ID.rob }, ID.justin, "claim");
    state = run(state, {
      type: "patchCharacter",
      characterId: ID.rob,
      patch: { suit: { on: false, onCha: 12, offCha: 9, onAc: 17, offAc: 14 } },
    }, ID.justin);
    expect(character(state, ID.rob).charisma).toBe(9);
    expect(character(state, ID.rob).ac).toBe(14);
  });

  it("lets the GM mend a seated hero, and keeps another player's sheet closed", () => {
    let state = run(createDemoState(), { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    expect(() =>
      run(
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
      ),
    ).toThrow(/someone else/);
    expect(() => run(state, { type: "grantCover", characterIds: [ID.naibroch, ID.elowynne], tempAc: 2 }, ID.trish, "cover")).toThrow(
      /someone else/,
    );
    state = run(state, { type: "claimGm" }, ID.justin, "gm");
    state = run(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.naibroch },
        amount: 10,
        direction: "harm",
        summary: "Naibroch takes 10.",
      },
      ID.justin,
      "harm-gm",
    );
    state = run(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.naibroch },
        amount: 6,
        direction: "heal",
        summary: "The GM mends Naibroch for 6.",
      },
      ID.justin,
      "heal",
    );
    expect(character(state, ID.naibroch).hp).toBe(32);
    state = run(state, { type: "grantCover", characterIds: [ID.naibroch, ID.elowynne], tempAc: 2 }, ID.justin, "cover");
    expect(character(state, ID.naibroch).tempAc).toBe(2);
    expect(character(state, ID.elowynne).tempAc).toBe(2);
    state = run(
      state,
      {
        type: "applyHarm",
        target: { kind: "character", id: ID.elowynne },
        amount: 1,
        direction: "heal",
        summary: "Elowynne mends herself.",
      },
      ID.trish,
      "self",
    );
    expect(character(state, ID.elowynne).hp).toBe(29);
  });

  it("records rolls, harm, spells, and advances on the session log", () => {
    let state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    state = run(state, { type: "startSession" }, ID.corbin, "session");
    state = run(state, { type: "log", kind: "roll", summary: "Elowynne rolls 8 + Combat 8 = 16 vs AC 13. Full damage 9." }, ID.trish, "roll");
    state = run(state, { type: "log", kind: "spell", summary: "Thorn Lash fizzles. 1 mana spent." }, ID.corbin, "spell");
    state = run(state, { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    state = run(state, { type: "advance", characterId: ID.elowynne, text: "She remembers a hallway of blue glass." }, ID.trish, "advance");
    const kinds = state.log.map((entry) => entry.kind);
    expect(kinds).toEqual(expect.arrayContaining(["session", "roll", "spell", "advance"]));
  });
});

describe("character privacy", () => {
  it("shows other players only the public card, and follows the GM screen", () => {
    let state = createDemoState();
    state = run(state, { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    state = run(state, { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 10, notes: "secret name" } }, ID.trish, "notes");
    state = run(state, { type: "setPortrait", characterId: ID.elowynne, portraitPath: "data:image/jpeg;base64,abc" }, ID.trish, "art");

    const corbin = present(state, ID.corbin);
    const card = character(corbin, ID.elowynne);
    expect(card.concealed).toBe(true);
    expect(card.name).toBe("Elowynne");
    expect(card.seated).toBe(true);
    expect(card.down).toBe(false);
    expect(card.claimed).toBe(true);
    expect(card.portraitPath).toBe("data:image/jpeg;base64,abc");
    expect(card.notes).toBe("");
    expect(card.abilities).toBe("");
    expect(card.inventory).toBe("");
    expect(card.playerName).toBe("");
    expect(card.ownerId).toBeNull();
    expect(card.weapons).toEqual([]);
    expect(card.tags).toEqual([]);
    expect(card.hp).toBe(0);
    expect(card.hpMax).toBe(0);
    expect(card.mana).toBe(0);
    expect(card.ac).toBe(0);
    expect(card.heroPoints).toBe(0);
    expect(card.charisma).toBe(0);

    const trish = present(state, ID.trish);
    expect(character(trish, ID.elowynne).concealed).toBe(false);
    expect(character(trish, ID.elowynne).notes).toContain("secret name");
    expect(character(trish, ID.elowynne).hp).toBe(10);
    expect(character(trish, ID.naibroch).concealed).toBe(true);
    expect(character(trish, ID.naibroch).down).toBe(false);
    expect(character(trish, ID.naibroch).claimed).toBe(false);

    const hidden = present(state, ID.justin);
    expect(() => run(hidden, { type: "claim", characterId: ID.elowynne }, ID.justin)).toThrow(/claimed/);
    expect(() => run(hidden, { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 1 } }, ID.justin)).toThrow(/private/);
    expect(() => run(state, { type: "setPortrait", characterId: ID.willow, portraitPath: "data:image/jpeg;base64,no" }, ID.corbin)).toThrow(/claim/i);

    state = run(state, { type: "claimGm" }, ID.corbin, "gm");
    const asGm = present(state, ID.corbin);
    expect(character(asGm, ID.elowynne).notes).toContain("secret name");
    expect(character(asGm, ID.elowynne).hp).toBe(10);
    expect(asGm.table.gmNotes.length).toBeGreaterThan(0);
    state = run(state, { type: "setPortrait", characterId: ID.elowynne, portraitPath: "data:image/jpeg;base64,gm" }, ID.corbin, "gm-art");
    expect(character(present(state, ID.justin), ID.elowynne).portraitPath).toBe("data:image/jpeg;base64,gm");

    state = run(state, { type: "claim", characterId: ID.naibroch }, ID.corbin, "own");
    state = run(state, { type: "claimGm" }, ID.trish, "handoff");
    const oldGm = present(state, ID.corbin);
    expect(oldGm.table.gmNotes).toBe("");
    expect(oldGm.trouble).toEqual([]);
    expect(character(oldGm, ID.elowynne).concealed).toBe(true);
    expect(character(oldGm, ID.elowynne).notes).toBe("");
    expect(character(oldGm, ID.naibroch).concealed).toBe(false);
    expect(character(oldGm, ID.naibroch).ownerId).toBe(ID.corbin);
    const newGm = present(state, ID.trish);
    expect(newGm.table.gmNotes.length).toBeGreaterThan(0);
    expect(newGm.trouble.some((item) => item.name === "Wolf")).toBe(true);
    expect(character(newGm, ID.naibroch).concealed).toBe(false);
    expect(character(newGm, ID.elowynne).notes).toContain("secret name");
  });

  it("marks a public card down without revealing the hit points", () => {
    let state = run(createDemoState(), { type: "claim", characterId: ID.elowynne }, ID.trish, "claim");
    state = run(state, { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 0 } }, ID.trish, "down");
    const card = character(present(state, ID.corbin), ID.elowynne);
    expect(card.down).toBe(true);
    expect(card.hpMax).toBe(0);
    expect(card.concealed).toBe(true);
  });
});

describe("trouble library", () => {
  it("keeps templates with the GM and copies numbered foes into the scene", () => {
    let state = createDemoState();
    expect(present(state, ID.trish).trouble).toEqual([]);
    expect(present(state, null).troubleFolders).toEqual([]);
    state = run(state, { type: "claimGm" }, ID.corbin, "gm");
    const template = state.trouble.find((item) => item.id === ID.bandit);
    if (!template) throw new Error("bandit");
    expect(() => applyAction(state, { type: "spawnTrouble", troubleId: ID.bandit, count: 3 }, ctx(ID.trish, ["x"]))).toThrow(/GM/);
    expect(() => run(state, { type: "removeTrouble", troubleId: ID.wolf }, ID.trish)).toThrow(/GM/);

    state = applyAction(state, { type: "spawnTrouble", troubleId: ID.bandit, count: 3 }, ctx(ID.corbin, ["a", "b", "c", "log"]));
    expect(state.foes.map((foe) => foe.name)).toEqual(["Bandit 1", "Bandit 2", "Bandit 3"]);
    expect(state.foes[0]?.hp).toBe(template.hp);
    expect(state.foes[0]?.hpMax).toBe(template.hp);
    expect(state.foes[0]?.ac).toBe(template.ac);
    expect(state.foes[0]?.attackBonus).toBe(template.attackBonus);
    expect(state.foes[0]?.damage).toBe(template.damage);
    expect(state.foes[0]?.notes).toContain("Short sword");
    expect(state.trouble.find((item) => item.id === ID.bandit)).toEqual(template);

    state = applyAction(state, { type: "spawnTrouble", troubleId: ID.bandit, count: 1 }, ctx(ID.corbin, ["d", "log2"]));
    expect(state.foes.at(-1)?.name).toBe("Bandit");
    state = applyAction(state, { type: "spawnTrouble", troubleId: ID.bandit, count: 1 }, ctx(ID.corbin, ["e", "log3"]));
    expect(state.foes.at(-1)?.name).toBe("Bandit 4");

    state = run(state, { type: "saveTrouble", trouble: { ...template, hp: 40, name: "Bandit" } }, ID.corbin, "edit");
    expect(state.trouble.find((item) => item.id === ID.bandit)?.hp).toBe(40);
    expect(state.foes[0]?.hp).toBe(template.hp);

    state = run(state, { type: "removeFolder", folderId: ID.folderBandits }, ID.corbin, "folder");
    expect(state.troubleFolders.some((folder) => folder.id === ID.folderBandits)).toBe(false);
    expect(state.trouble.find((item) => item.id === ID.bandit)?.folderId).toBeNull();
    expect(state.trouble.find((item) => item.id === ID.captain)?.folderId).toBeNull();

    state = run(state, { type: "claimGm" }, ID.trish, "handoff");
    expect(present(state, ID.corbin).trouble).toEqual([]);
    expect(present(state, ID.trish).trouble.find((item) => item.id === ID.wolf)?.name).toBe("Wolf");
    expect(present(state, ID.trish).foes).toHaveLength(5);
  });

  it("refuses a blank name and a pile bigger than the scene tap allows", () => {
    const state = run(createDemoState(), { type: "claimGm" }, ID.corbin, "gm");
    const wolf = state.trouble.find((item) => item.id === ID.wolf);
    if (!wolf) throw new Error("wolf");
    expect(() => run(state, { type: "saveTrouble", trouble: { ...wolf, name: "  " } }, ID.corbin)).toThrow(/name/i);
    expect(() => applyAction(state, { type: "spawnTrouble", troubleId: ID.wolf, count: 13 }, ctx(ID.corbin, ["x"]))).toThrow(/12/);
  });
});
