import { describe, expect, it } from "vitest";
import { ID } from "./ids";
import { PORTRAIT_MAX_BYTES, assertPortraitFile, portraitObjectName } from "./portrait";

const ART_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9]{1,16}\.jpg$/i;

describe("character portraits", () => {
  it("accepts a photo under 5 MB, including an iPhone HEIC", () => {
    expect(() => assertPortraitFile({ size: 200_000, type: "image/jpeg", name: "naibroch.jpg" })).not.toThrow();
    expect(() => assertPortraitFile({ size: 200_000, type: "image/heic", name: "IMG_2204.HEIC" })).not.toThrow();
    expect(() => assertPortraitFile({ size: 200_000, type: "", name: "photo.PNG" })).not.toThrow();
  });

  it("refuses anything that is not a photo or is over 5 MB", () => {
    expect(() => assertPortraitFile({ size: PORTRAIT_MAX_BYTES + 1, type: "image/jpeg" })).toThrow(/5 MB/);
    expect(() => assertPortraitFile({ size: 0, type: "image/jpeg" })).toThrow(/empty/);
    expect(() => assertPortraitFile({ size: 40, type: "text/plain", name: "notes.txt" })).toThrow(/photo/);
    expect(() => assertPortraitFile({ size: 40, type: "image/svg+xml", name: "mark.svg" })).toThrow(/photo/);
  });

  it("builds a storage name the migration will accept", () => {
    const name = portraitObjectName(ID.table, ID.naibroch, 1_700_000_000_000);
    expect(name).toBe(`${ID.table}/${ID.naibroch}/1700000000000.jpg`);
    expect(name).toMatch(ART_NAME);
    expect(() => portraitObjectName("../secrets", ID.naibroch)).toThrow(/portrait/);
  });
});
