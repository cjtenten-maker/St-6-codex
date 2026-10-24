import { describe, expect, it } from "vitest";
import { isMissingRelation } from "../backend/supabase";
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
});