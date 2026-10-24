import type { Foe, Trouble, TroubleFolder } from "../model";
import { SPAWN_CAP } from "../model";
import { RuleError } from "../rules/errors";

export const LIBRARY_MIGRATION = "supabase/migrations/003_trouble_library.sql";

export const LIBRARY_WAITING =
  "The Trouble library isn't on this database yet. Apply supabase/migrations/003_trouble_library.sql. The rest of the table still works.";

export function libraryOf(state: { trouble?: Trouble[]; troubleFolders?: TroubleFolder[] }): {
  trouble: Trouble[];
  troubleFolders: TroubleFolder[];
} {
  return {
    trouble: Array.isArray(state.trouble) ? state.trouble : [],
    troubleFolders: Array.isArray(state.troubleFolders) ? state.troubleFolders : [],
  };
}

/** Names for copies dropped into the scene. One copy keeps the template name when it is free. */
export function instanceNames(base: string, count: number, takenNames: string[]): string[] {
  const clean = Math.floor(count);
  if (!Number.isFinite(clean) || clean < 1 || clean > SPAWN_CAP) {
    throw new RuleError(`Add between 1 and ${SPAWN_CAP}.`);
  }
  const taken = new Set(takenNames.map((name) => name.trim().toLowerCase()));
  const names: string[] = [];
  const claim = (name: string) => {
    const key = name.toLowerCase();
    if (taken.has(key)) return false;
    taken.add(key);
    names.push(name);
    return true;
  };
  if (clean === 1) claim(base);
  let n = 1;
  while (names.length < clean) {
    if (n > 500) throw new RuleError("Too many of those are already in the scene.");
    claim(`${base} ${n}`);
    n += 1;
  }
  return names;
}

export function foeFromTrouble(trouble: Trouble, id: string, name: string): Foe {
  const notes = [trouble.abilities.trim(), trouble.notes.trim()].filter(Boolean).join("\n");
  return {
    id,
    name,
    hp: trouble.hp,
    hpMax: trouble.hp,
    ac: trouble.ac,
    attackBonus: trouble.attackBonus,
    damage: trouble.damage,
    notes,
    energyShield: trouble.energyShield,
    ignoreAc: trouble.ignoreAc,
    portraitPath: trouble.portraitPath ?? null,
  };
}

export function enterLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} enters the scene.`;
  if (names.length === 2) return `${names[0]} and ${names[1]} enter the scene.`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)} enter the scene.`;
}
