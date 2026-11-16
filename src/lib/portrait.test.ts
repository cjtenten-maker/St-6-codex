import { describe, expect, it } from "vitest";
import { ID } from "./ids";
import {
  PORTRAIT_MAX_BYTES,
  assertPortraitFile,
  characterArtObjectNames,
  focusFromClientPoint,
  portraitFrame,
  portraitLayout,
  portraitObjectName,
  portraitObjectPosition,
} from "./portrait";

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

  it("collects only this character's portrait files", () => {
    const current = portraitObjectName(ID.table, ID.naibroch, 1_700_000_000_000);
    const names = characterArtObjectNames(ID.table, ID.naibroch, current, ["1700000000001.jpg", "../other.jpg", "notes.txt"]);
    expect(names).toEqual([
      `${ID.table}/${ID.naibroch}/1700000000000.jpg`,
      `${ID.table}/${ID.naibroch}/1700000000001.jpg`,
    ]);
    expect(characterArtObjectNames(ID.table, ID.naibroch, "data:image/jpeg;base64,abc", [])).toEqual([]);
  });

  it("shows an old portrait whole on the sheet and crops small pictures from the top", () => {
    expect(portraitFrame(undefined)).toEqual({ fit: "contain", focus: { x: 0.5, y: 0 } });
    expect(portraitFrame({})).toEqual({ fit: "contain", focus: { x: 0.5, y: 0 } });
    expect(portraitLayout("sheet", undefined)).toEqual({ objectFit: "contain", objectPosition: "50% 50%", blurFill: true });
    expect(portraitLayout("thumb", undefined)).toEqual({ objectFit: "cover", objectPosition: "50% 0%", blurFill: false });
  });

  it("keeps a saved face mark and ignores a point that is not on the photo", () => {
    const saved = { portraitFit: "cover", portraitFocus: { x: 0.25, y: 0.4 } };
    expect(portraitFrame(saved)).toEqual({ fit: "cover", focus: { x: 0.25, y: 0.4 } });
    expect(portraitLayout("sheet", saved)).toEqual({ objectFit: "cover", objectPosition: "25% 40%", blurFill: false });
    expect(portraitLayout("thumb", saved).objectPosition).toBe("25% 40%");
    expect(portraitFrame({ portraitFit: "stretch", portraitFocus: { x: 2, y: -0.2 } })).toEqual({
      fit: "contain",
      focus: { x: 0.5, y: 0 },
    });
    expect(portraitFrame({ portraitFocus: { x: "0.2", y: 0.2 } }).focus).toEqual({ x: 0.5, y: 0 });
    expect(portraitObjectPosition({ x: 0.333, y: 1 })).toBe("33.3% 100%");
  });

  it("maps a tap on the photo to a face mark and clamps a tap past the edge", () => {
    expect(focusFromClientPoint(60, 120, { left: 10, top: 20, width: 100, height: 200 })).toEqual({ x: 0.5, y: 0.5 });
    expect(focusFromClientPoint(0, 400, { left: 10, top: 20, width: 100, height: 200 })).toEqual({ x: 0, y: 1 });
    expect(focusFromClientPoint(10, 20, { left: 0, top: 0, width: 0, height: 10 })).toBeNull();
  });

  it("collects a trouble's art files under the same layout", () => {
    const current = portraitObjectName(ID.table, ID.wolf, 1_700_000_000_000);
    expect(characterArtObjectNames(ID.table, ID.wolf, current, ["1700000000001.jpg", "notes.txt"])).toEqual([
      `${ID.table}/${ID.wolf}/1700000000000.jpg`,
      `${ID.table}/${ID.wolf}/1700000000001.jpg`,
    ]);
  });
});
