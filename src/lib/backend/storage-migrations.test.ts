import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase/migrations");

describe("storage delete migrations", () => {
  it("keeps direct storage.objects deletes in the historical files only", () => {
    const files = readdirSync(migrations).filter((name) => name.endsWith(".sql"));
    const stillDeleting = files.filter((name) => {
      if (name.startsWith("002_") || name.startsWith("003_")) return false;
      return /delete\s+from\s+storage\.objects/i.test(readFileSync(join(migrations, name), "utf8"));
    });
    expect(stillDeleting).toEqual([]);
  });

  it("drops the trouble-art trigger and leaves deletion to the current GM", () => {
    const sql = readFileSync(join(migrations, "005_trouble_art_storage.sql"), "utf8");
    expect(sql).toMatch(/drop trigger if exists trouble_delete_art on public\.trouble/i);
    expect(sql).toMatch(/drop function if exists public\.delete_trouble_art\(\)/i);
    expect(sql).toMatch(/can_delete_trouble_art/);
    expect(sql).toMatch(/is_current_gm\(tid\)/);
    expect(sql).toMatch(/bucket_id = 'trouble-art'/);
    expect(sql).not.toMatch(/delete\s+from\s+storage\.objects/i);
  });

  it("publishes portrait framing from the sheet and does not touch storage", () => {
    const sql = readFileSync(join(migrations, "006_portrait_framing.sql"), "utf8");
    expect(sql).toMatch(/add column if not exists portrait_fit text/i);
    expect(sql).toMatch(/add column if not exists portrait_focus jsonb/i);
    expect(sql).toMatch(/sheet ->> 'portraitFit'/);
    expect(sql).toMatch(/portraitFocus/);
    expect(sql).toMatch(/sync_character_card/);
    expect(sql).not.toMatch(/delete\s+from\s+storage\.objects/i);
    expect(sql).not.toMatch(/alter table public\.characters/i);
  });
});
