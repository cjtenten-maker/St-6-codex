import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/007_impulse_tank_and_mask.sql"), "utf8");

describe("Impulse tank and mask migration", () => {
  it("seeds his tank, tags spells by id, and stores the mask as a suit", () => {
    expect(sql).toMatch(/74fa5f2e-1721-436a-b5f2-3ccc3cd8a845/);
    expect(sql).toMatch(/"points": 13/);
    expect(sql).toMatch(/'brace'/);
    expect(sql).toMatch(/'kinetic-throw'/);
    expect(sql).toMatch(/pointsPerDamage/);
    expect(sql).toMatch(/'shockwave'/);
    expect(sql).toMatch(/'overload'/);
    expect(sql).toMatch(/Bronze Lion Mask/);
    expect(sql).toMatch(/onHpMax/);
    expect(sql).toMatch(/offHpMax/);
    expect(sql).not.toMatch(/kinetic-sprint/);
  });

  it("turns the owner guard off for the seed and back on afterward", () => {
    expect(sql).toMatch(/disable trigger characters_owner_guard/);
    expect(sql).toMatch(/enable trigger characters_owner_guard/);
    expect(sql.indexOf("disable trigger")).toBeLessThan(sql.indexOf("74fa5f2e"));
    expect(sql.lastIndexOf("enable trigger")).toBeGreaterThan(sql.indexOf("update public.characters"));
  });

  it("does not publish the tank and does not delete storage", () => {
    expect(sql).not.toMatch(/character_cards/i);
    expect(sql).not.toMatch(/delete\s+from\s+storage\.objects/i);
    expect(sql).not.toMatch(/credits/i);
  });
});