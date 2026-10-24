import type { Character, Member, TableState } from "../model";
import { libraryOf } from "./library";

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
 * The written name does not reveal the sheet. Claiming does.
 */
export function isOwnCharacter(member: Pick<Member, "id" | "displayName">, character: { ownerId: string | null; playerName: string }): boolean {
  if (character.ownerId) return character.ownerId === member.id;
  return namesMatch(character.playerName, member.displayName);
}

/** Someone owns this sheet. A public card says so without naming them. */
export function isClaimed(character: Pick<Character, "ownerId" | "claimed" | "concealed">): boolean {
  if (character.concealed) return Boolean(character.claimed);
  return character.ownerId != null;
}

/**
 * What every other player at the table can see.
 * id and table id exist so the app can tell cards apart. They are not secrets.
 * The sheet's numbers, notes, inventory, and the owner's name are not here.
 */
export const PUBLIC_CHARACTER_FIELDS = ["name", "seated", "down", "claimed", "portraitPath"] as const;

function hiddenSheet(partial: Pick<Character, "id" | "name" | "seated" | "portraitPath">): Character {
  return {
    id: partial.id,
    name: partial.name,
    playerName: "",
    ownerId: null,
    role: "",
    concept: "",
    look: "",
    notes: "",
    abilities: "",
    inventory: "",
    charisma: 0,
    strength: 0,
    combat: 0,
    arcana: 0,
    hp: 0,
    hpMax: 0,
    mana: 0,
    ac: 0,
    acNote: "",
    tempAc: 0,
    defenseTagActive: false,
    heroPoints: 0,
    tags: [],
    weapons: [],
    spells: [],
    energyShield: false,
    seated: partial.seated,
    portraitPath: partial.portraitPath ?? null,
    concealed: true,
  };
}

/** A row from public.character_cards. */
export function characterFromCard(card: {
  id: string;
  name: string;
  seated: boolean;
  down: boolean;
  claimed: boolean;
  portraitPath: string | null;
}): Character {
  return {
    ...hiddenSheet(card),
    claimed: card.claimed,
    down: card.down,
  };
}

function toPublicCard(character: Character): Character {
  return {
    ...hiddenSheet(character),
    claimed: character.ownerId != null,
    down: character.hp <= 0,
    portraitPath: character.portraitPath ?? null,
  };
}

/**
 * GM notes and other people's sheets stay on the table.
 * The current GM sees every sheet. A player sees their own.
 * Everyone else gets the public card: name, portrait, seated, down, claimed.
 */
export function present(state: TableState, viewerId: string | null): TableState {
  const gm = Boolean(viewerId && state.table.currentGmId === viewerId);
  const library = libraryOf(state);
  return {
    ...state,
    table: { ...state.table, gmNotes: gm ? state.table.gmNotes : "" },
    trouble: gm ? library.trouble : [],
    troubleFolders: gm ? library.troubleFolders : [],
    characters: state.characters.map((character) => {
      if (character.concealed) return character;
      if (gm || (viewerId != null && character.ownerId === viewerId)) {
        return { ...character, concealed: false };
      }
      return toPublicCard(character);
    }),
  };
}
