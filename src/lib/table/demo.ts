import { companyCharacters } from "../data/company";
import { DEMO_CODE, DEMO_PLAYERS, ID } from "../ids";
import type { TableState } from "../model";

export function createDemoState(): TableState {
  const characters = companyCharacters();
  return {
    table: {
      id: ID.table,
      code: DEMO_CODE,
      name: "Seal Team-6",
      createdBy: ID.corbin,
      currentGmId: null,
      gmEligibleIds: [ID.corbin, ID.trish, ID.justin],
      sceneNote:
        "Three months since the cult. Elowynne still doesn't have her name back. The company is in one place.",
      sideFirst: null,
      turnOrder: characters.map((character) => character.id),
      sessionActive: false,
      sessionId: null,
      gmNotes:
        "The cult still has Elowynne's name. Don't feed it to her. Ask Naibroch which form of Judge's Edge before the roll — it is a free action, and the damage is the full stat.",
    },
    members: DEMO_PLAYERS.map((player) => ({ ...player })),
    characters,
    foes: [],
    log: [],
  };
}
