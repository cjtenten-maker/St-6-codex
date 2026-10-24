import { ID } from "../ids";
import type { Trouble, TroubleFolder } from "../model";

/**
 * A few foes and hazards so a new table has something to throw.
 * The numbers follow the live foe: hit points, AC, a d12 bonus, and a damage line.
 */
export function sampleLibrary(): { troubleFolders: TroubleFolder[]; trouble: Trouble[] } {
  const troubleFolders: TroubleFolder[] = [
    { id: ID.folderBeasts, name: "Beasts", sort: 0 },
    { id: ID.folderBandits, name: "Bandits", sort: 1 },
    { id: ID.folderTraps, name: "Traps", sort: 2 },
    { id: ID.folderBosses, name: "Bosses", sort: 3 },
  ];
  const trouble: Trouble[] = [
    {
      id: ID.wolf,
      folderId: ID.folderBeasts,
      name: "Wolf",
      hp: 10,
      ac: 12,
      attackBonus: 5,
      damage: "1d6+2",
      abilities: "Pack. +2 to the d12 when another wolf is in the scene.",
      notes: "Flees at half hit points unless cornered.",
      energyShield: false,
      portraitPath: null,
      sort: 0,
    },
    {
      id: ID.bear,
      folderId: ID.folderBeasts,
      name: "Cave bear",
      hp: 32,
      ac: 14,
      attackBonus: 8,
      damage: "1d10+4",
      abilities: "A natural 12 knocks the target down.",
      notes: "",
      energyShield: false,
      portraitPath: null,
      sort: 1,
    },
    {
      id: ID.bandit,
      folderId: ID.folderBandits,
      name: "Bandit",
      hp: 11,
      ac: 13,
      attackBonus: 5,
      damage: "1d8+1",
      abilities: "Short sword or short bow. Same damage line either way.",
      notes: "Wants the coin more than the kill.",
      energyShield: false,
      portraitPath: null,
      sort: 0,
    },
    {
      id: ID.captain,
      folderId: ID.folderBandits,
      name: "Bandit captain",
      hp: 22,
      ac: 16,
      attackBonus: 7,
      damage: "1d8+3",
      abilities: "Once a round, one bandit strikes again.",
      notes: "The one giving orders.",
      energyShield: false,
      portraitPath: null,
      sort: 1,
    },
    {
      id: ID.pit,
      folderId: ID.folderTraps,
      name: "Pit",
      hp: 1,
      ac: 10,
      attackBonus: 0,
      damage: "2d6",
      abilities: "A hazard, not a creature. A hero who doesn't look falls in. Call a Strength save: half damage on a success. Remove it once the pit is known.",
      notes: "Hit points are only so it can leave the scene.",
      energyShield: false,
      portraitPath: null,
      sort: 0,
    },
    {
      id: ID.speaker,
      folderId: ID.folderBosses,
      name: "Cult speaker",
      hp: 40,
      ac: 15,
      attackBonus: 8,
      damage: "1d8+2",
      abilities: "Once a scene, names a seated hero. That hero takes −2 until the scene ends. The energy shield swallows one full-potential hit.",
      notes: "Keep this in the library until the door opens.",
      energyShield: true,
      portraitPath: null,
      sort: 0,
    },
  ];
  return { troubleFolders, trouble };
}

/** New ids, for a Supabase table. The demo keeps the stable ones. */
export function sampleLibraryFresh(): { troubleFolders: TroubleFolder[]; trouble: Trouble[] } {
  const source = sampleLibrary();
  const folderIds = new Map(source.troubleFolders.map((folder) => [folder.id, crypto.randomUUID()]));
  return {
    troubleFolders: source.troubleFolders.map((folder) => ({ ...folder, id: folderIds.get(folder.id) ?? folder.id })),
    trouble: source.trouble.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      folderId: item.folderId ? (folderIds.get(item.folderId) ?? null) : null,
    })),
  };
}
