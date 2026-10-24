import { describe, expect, it } from "vitest";
import { DEMO_PLAYERS, ID } from "../ids";
import { createLocalApi } from "./local";
import { createMemoryStore } from "./memory";

describe("local table, two phones on one machine", () => {
  it("hides the other sheet, shares the portrait, and hands the GM screen across", () => {
    const store = createMemoryStore();
    const corbin = createLocalApi(store);
    const trish = createLocalApi(store);
    const justin = createLocalApi(store);
    corbin.setViewer({ ...DEMO_PLAYERS[0] });
    trish.setViewer({ ...DEMO_PLAYERS[1] });
    justin.setViewer({ ...DEMO_PLAYERS[2] });
    corbin.ensureDemo();

    trish.dispatch("SEAL6", { type: "claim", characterId: ID.elowynne });
    trish.dispatch("SEAL6", { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 25, notes: "secret glass" } });
    trish.dispatch("SEAL6", { type: "setPortrait", characterId: ID.elowynne, portraitPath: "data:image/jpeg;base64,abc" });

    const seen: boolean[] = [];
    corbin.subscribe(() => {
      const card = corbin.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne);
      if (card) seen.push(Boolean(card.down));
    });

    trish.dispatch("SEAL6", { type: "patchCharacter", characterId: ID.elowynne, patch: { hp: 0 } });

    const hidden = corbin.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne);
    expect(hidden?.concealed).toBe(true);
    expect(hidden?.name).toBe("Elowynne");
    expect(hidden?.down).toBe(true);
    expect(hidden?.claimed).toBe(true);
    expect(hidden?.portraitPath).toBe("data:image/jpeg;base64,abc");
    expect(hidden?.notes).toBe("");
    expect(hidden?.hpMax).toBe(0);
    expect(hidden?.ownerId).toBeNull();
    expect(seen.at(-1)).toBe(true);
    expect(justin.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.portraitPath).toContain("data:image");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.notes).toContain("secret glass");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.hp).toBe(0);
    expect(corbin.exportJson("SEAL6")).not.toContain("secret glass");
    expect(trish.exportJson("SEAL6")).toContain("secret glass");
    expect(() => corbin.dispatch("SEAL6", { type: "patchCharacter", characterId: ID.elowynne, patch: { notes: "peek" } })).toThrow(
      /someone else|private/,
    );
    expect(() => trish.dispatch("SEAL6", { type: "setPortrait", characterId: ID.willow, portraitPath: "data:image/jpeg;base64,no" })).toThrow(
      /claim/i,
    );

    corbin.dispatch("SEAL6", { type: "claimGm" });
    expect(corbin.load("SEAL6")?.table.currentGmId).toBe(ID.corbin);
    expect(corbin.load("SEAL6")?.table.gmNotes).toContain("Elowynne's name");
    expect(corbin.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.notes).toContain("secret glass");
    expect(corbin.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.seated).toBe(false);
    expect(trish.load("SEAL6")?.table.gmNotes).toBe("");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.concealed).toBe(true);

    corbin.dispatch("SEAL6", { type: "claim", characterId: ID.naibroch });
    trish.dispatch("SEAL6", { type: "claimGm" });
    expect(trish.load("SEAL6")?.table.currentGmId).toBe(ID.trish);
    expect(trish.load("SEAL6")?.table.gmNotes).toContain("Elowynne's name");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.seated).toBe(false);
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.notes.length).toBeGreaterThan(0);
    expect(corbin.load("SEAL6")?.table.gmNotes).toBe("");
    expect(corbin.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.concealed).toBe(true);
    expect(corbin.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.concealed).toBe(false);
    expect(corbin.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.ownerId).toBe(ID.corbin);
  });
});
