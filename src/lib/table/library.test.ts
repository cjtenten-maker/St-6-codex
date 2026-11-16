import { describe, expect, it } from "vitest";
import { isMissingColumn, isMissingRelation } from "../backend/supabase";
import { instanceNames } from "./library";

describe("trouble names", () => {
  it("numbers a group and keeps a single copy's name when the scene is empty", () => {
    expect(instanceNames("Goblin", 1, [])).toEqual(["Goblin"]);
    expect(instanceNames("Goblin", 3, [])).toEqual(["Goblin 1", "Goblin 2", "Goblin 3"]);
    expect(instanceNames("Goblin", 2, ["Goblin 2"])).toEqual(["Goblin 1", "Goblin 3"]);
    expect(instanceNames("Goblin", 1, ["Goblin", "Goblin 1"])).toEqual(["Goblin 2"]);
  });
});

describe("library migration detection", () => {
  it("treats a missing table as not ready and leaves other errors alone", () => {
    expect(isMissingRelation(null)).toBe(false);
    expect(isMissingRelation({ code: "PGRST205", message: "Could not find the table 'public.trouble' in the schema cache" })).toBe(true);
    expect(isMissingRelation({ code: "42P01", message: 'relation "public.trouble_folders" does not exist' })).toBe(true);
    expect(isMissingRelation({ message: "Could not find the table 'public.trouble' in the schema cache" })).toBe(true);
    expect(isMissingRelation({ code: "42501", message: "permission denied for table trouble" })).toBe(false);
  });

  it("treats a missing framing column as optional and does not confuse it with a missing table", () => {
    expect(isMissingColumn(null)).toBe(false);
    expect(isMissingColumn({ code: "42703", message: "column character_cards.portrait_fit does not exist" })).toBe(true);
    expect(
      isMissingColumn({
        code: "PGRST204",
        message: "Could not find the 'portrait_fit' column of 'character_cards' in the schema cache",
      }),
    ).toBe(true);
    expect(isMissingColumn({ code: "PGRST205", message: "Could not find the table 'public.character_cards' in the schema cache" })).toBe(false);
    expect(isMissingRelation({ code: "PGRST204", message: "Could not find the 'portrait_fit' column of 'character_cards' in the schema cache" })).toBe(
      true,
    );
    expect(isMissingColumn({ code: "42501", message: "permission denied for table character_cards" })).toBe(false);
  });
});