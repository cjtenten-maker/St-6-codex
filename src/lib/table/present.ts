import type { Member, TableState } from "../model";

/** The written name and the person holding the phone. "Justin" matches "Justin Ratsprit". */
export function namesMatch(playerName: string, displayName: string): boolean {
  const sheet = playerName.trim().toLowerCase();
  const person = displayName.trim().toLowerCase();
  if (!sheet || !person) return false;
  return sheet === person || sheet.startsWith(`${person} `) || person.startsWith(`${sheet} `);
}

/**
 * A claimed character belongs to that account.
 * An unclaimed character still sits out when the person named on the sheet is GM.
 */
export function isOwnCharacter(member: Pick<Member, "id" | "displayName">, character: { ownerId: string | null; playerName: string }): boolean {
  if (character.ownerId) return character.ownerId === member.id;
  return namesMatch(character.playerName, member.displayName);
}

/** GM notes stay on the table, but only the current GM is shown them. */
export function present(state: TableState, viewerId: string | null): TableState {
  if (viewerId && state.table.currentGmId === viewerId) return state;
  if (!state.table.gmNotes) return state;
  return { ...state, table: { ...state.table, gmNotes: "" } };
}
