import { describe, expect, it } from "vitest";
import { ID } from "../ids";
import { createDemoState } from "./demo";
import { hasJoinedTable, pathForTable, tableHost } from "./identity";
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

  it("keeps Table, Sheet, GM, and Log on the table they switch to", () => {
    expect(pathForTable("/t/AAAA", "bbbb")).toBe("/t/BBBB");
    expect(pathForTable("/t/AAAA/gm", "BBBB")).toBe("/t/BBBB/gm");
    expect(pathForTable("/t/AAAA/log/", "BBBB")).toBe("/t/BBBB/log");
    expect(pathForTable("/t/AAAA/c/hero", "BBBB", "other-hero")).toBe("/t/BBBB/c/other-hero");
    expect(pathForTable("/t/AAAA/c/hero", "BBBB", null)).toBe("/t/BBBB");
  });
});
