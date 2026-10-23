import { describe, expect, it } from "vitest";
import { DEMO_PLAYERS, ID } from "../ids";
import { createLocalApi } from "./local";
import { createMemoryStore } from "./memory";

describe("local table, two phones on one machine", () => {
  it("shows a hit to the other player and hands the GM notes across", () => {
    const store = createMemoryStore();
    const corbin = createLocalApi(store);
    const trish = createLocalApi(store);
    corbin.setViewer({ ...DEMO_PLAYERS[0] });
    trish.setViewer({ ...DEMO_PLAYERS[1] });
    corbin.ensureDemo();

    const seen: number[] = [];
    trish.subscribe(() => {
      const hp = trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.hp;
      if (hp != null) seen.push(hp);
    });

    corbin.dispatch("SEAL6", {
      type: "applyHarm",
      target: { kind: "character", id: ID.elowynne },
      amount: 4,
      direction: "harm",
      summary: "Elowynne takes 4.",
    });

    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.hp).toBe(25);
    expect(seen.at(-1)).toBe(25);
    expect(corbin.load("SEAL6")?.table.gmNotes).toBe("");

    corbin.dispatch("SEAL6", { type: "claimGm" });
    expect(corbin.load("SEAL6")?.table.currentGmId).toBe(ID.corbin);
    expect(corbin.load("SEAL6")?.table.gmNotes).toContain("Elowynne's name");
    expect(trish.load("SEAL6")?.table.gmNotes).toBe("");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.naibroch)?.seated).toBe(false);

    trish.dispatch("SEAL6", { type: "claimGm" });
    expect(trish.load("SEAL6")?.table.currentGmId).toBe(ID.trish);
    expect(trish.load("SEAL6")?.table.gmNotes).toContain("Elowynne's name");
    expect(corbin.load("SEAL6")?.table.gmNotes).toBe("");
    expect(trish.load("SEAL6")?.characters.find((character) => character.id === ID.elowynne)?.seated).toBe(false);
  });
});
