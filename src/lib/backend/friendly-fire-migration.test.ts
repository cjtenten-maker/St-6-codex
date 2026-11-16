import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/008_friendly_fire.sql"), "utf8");

describe("friendly fire migration", () => {
  it("publishes strike armor class and keeps the sheet private", () => {
    expect(sql).toMatch(/add column if not exists strike_ac integer/i);
    expect(sql).toMatch(/add column if not exists energy_shield boolean/i);
    expect(sql).toMatch(/defenseTagActive/);
    expect(sql).toMatch(/tempAc/);
    expect(sql).toMatch(/strike_ac = excluded\.strike_ac/);
    expect(sql).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it("lets a member land a blow without opening the rest of the sheet", () => {
    expect(sql).toMatch(/function public\.apply_character_harm/i);
    expect(sql).toMatch(/function public\.sheet_harm_only/i);
    expect(sql).toMatch(/energyShield/);
    expect(sql).toMatch(/kineticTank/);
    expect(sql).toMatch(/greatest\(0, combat\) \* 3/);
    expect(sql).toMatch(/guard_character_owner/);
    expect(sql).toMatch(/sheet_harm_only\(old\.sheet, new\.sheet\)/);
    expect(sql).toMatch(/grant execute on function public\.apply_character_harm/i);
  });
});