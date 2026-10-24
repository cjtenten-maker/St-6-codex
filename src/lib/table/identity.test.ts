import { describe, expect, it } from "vitest";
import { ID } from "../ids";
import { createDemoState } from "./demo";
import { hasJoinedTable, tableHost } from "./identity";
import { applyAction } from "./reducer";

describe("which table this is", () => {
  it("names the person who opened it, then the GM once someone takes the screen", () => {
    const state = createDemoState();
    expect(tableHost(state)).toEqual({ role: "Opened by", name: "Corbin" });
    const gm = applyAction(state, { type: "claimGm" }, { actorId: ID.trish, now: "2026-10-24T00:00:00.000Z", id: () => "gm" });
    expect(tableHost(gm)).toEqual({ role: "GM", name: "Trish" });
  });

  it("does not treat the practice table as a table they have joined", () => {
    expect(hasJoinedTable([])).toBe(false);
    expect(hasJoinedTable([{ code: "SEAL6" }])).toBe(false);
    expect(hasJoinedTable([{ code: "seal6" }, { code: "UU33KL" }])).toBe(true);
  });
});
