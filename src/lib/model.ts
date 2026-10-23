import type { BonusMode } from "./rules/attack";

export type StatName = "charisma" | "strength" | "combat" | "arcana";

export type Tag = {
  id: string;
  label: string;
  /** Defensive in nature: holding it is +1 AC, not +2 on a roll. */
  defensive: boolean;
};

export type Weapon = {
  id: string;
  name: string;
  damage: string;
  hitStat: StatName | "none";
  altHitStat?: StatName | "none";
  /** Stat added to damage. Defaults to the hit stat. */
  bonusStat?: StatName | "none";
  bonusMode: BonusMode;
  ignoreAc?: number;
  overheatsOnNat1?: boolean;
  overheated?: boolean;
  notes?: string;
  attacksPerRound?: number;
};

export type Spell = {
  id: string;
  name: string;
  cost: number;
  effect: string;
  damage?: string;
  heal?: string;
  tempAc?: number;
  /** Apply the AC bonus to every seated ally. */
  aoeAc?: boolean;
  bonusMode?: BonusMode;
  /** Strength (or another) save cuts the harm in half. The table calls it. */
  saveForHalf?: boolean;
  notes?: string;
};

export type Suit = {
  on: boolean;
  onCha: number;
  offCha: number;
  onAc: number;
  offAc: number;
};

export type Character = {
  id: string;
  name: string;
  /** The name written on the paper. Empty when the scrap didn't say. */
  playerName: string;
  ownerId: string | null;
  role: string;
  concept: string;
  look: string;
  notes: string;
  abilities: string;
  inventory: string;
  charisma: number;
  strength: number;
  combat: number;
  arcana: number;
  hp: number;
  hpMax: number;
  mana: number;
  ac: number;
  acNote: string;
  tempAc: number;
  defenseTagActive: boolean;
  heroPoints: number;
  tags: Tag[];
  weapons: Weapon[];
  spells: Spell[];
  energyShield: boolean;
  seated: boolean;
  suit?: Suit;
  /** +1 to cast while the focus is in hand. Naibroch's staff. */
  focusCastBonus?: number;
  focusOn?: boolean;
};

export type Foe = {
  id: string;
  name: string;
  hp: number;
  hpMax: number;
  ac: number;
  /** Added to the foe's d12. The GM sets it; foes have no stat line. */
  attackBonus: number;
  /** Whole damage line, bonus included, such as `1d8+2`. */
  damage: string;
  notes: string;
  energyShield: boolean;
  ignoreAc?: number;
};

export type Member = {
  id: string;
  displayName: string;
  email: string;
};

export type TableMeta = {
  id: string;
  code: string;
  name: string;
  createdBy: string;
  currentGmId: string | null;
  /** Up to four. */
  gmEligibleIds: string[];
  sceneNote: string;
  sideFirst: "heroes" | "trouble" | null;
  /** Seated character ids, in the order the players chose. */
  turnOrder: string[];
  sessionActive: boolean;
  sessionId: string | null;
  /** Kept on the table. The next GM inherits whatever was written. */
  gmNotes: string;
};

export type LogKind = "roll" | "damage" | "spell" | "advance" | "rest" | "session" | "hero" | "gm" | "note";

export type LogEntry = {
  id: string;
  sessionId: string | null;
  at: string;
  actorId: string | null;
  actorName: string;
  kind: LogKind;
  summary: string;
};

export type TableState = {
  table: TableMeta;
  members: Member[];
  characters: Character[];
  foes: Foe[];
  log: LogEntry[];
};

export type CharacterPatch = Partial<
  Pick<
    Character,
    | "name"
    | "role"
    | "concept"
    | "look"
    | "notes"
    | "abilities"
    | "inventory"
    | "charisma"
    | "strength"
    | "combat"
    | "arcana"
    | "hp"
    | "hpMax"
    | "mana"
    | "ac"
    | "acNote"
    | "tempAc"
    | "defenseTagActive"
    | "tags"
    | "weapons"
    | "spells"
    | "energyShield"
    | "focusOn"
    | "focusCastBonus"
    | "suit"
    | "playerName"
  >
>;

export type Action =
  | { type: "join"; member: Member }
  | { type: "claim"; characterId: string }
  | { type: "release"; characterId: string }
  | { type: "patchCharacter"; characterId: string; patch: CharacterPatch }
  | { type: "setEligible"; memberIds: string[] }
  | { type: "claimGm" }
  | { type: "releaseGm" }
  | { type: "setSeated"; characterIds: string[] }
  | { type: "startSession" }
  | { type: "endSession" }
  | { type: "shortRest" }
  | { type: "longRest" }
  | { type: "addCharacter"; character: Character }
  | { type: "addFoe"; foe: Foe }
  | { type: "patchFoe"; foeId: string; patch: Partial<Omit<Foe, "id">> }
  | { type: "removeFoe"; foeId: string }
  | { type: "setScene"; scene: string }
  | { type: "setGmNotes"; notes: string }
  | { type: "setSide"; side: "heroes" | "trouble" }
  | { type: "moveTurn"; characterId: string; direction: -1 | 1 }
  | {
      type: "applyHarm";
      target: { kind: "character" | "foe"; id: string };
      amount: number;
      direction: "harm" | "heal";
      breakShield?: boolean;
      onlySeated?: boolean;
      summary: string;
    }
  | { type: "spendMana"; characterId: string; amount: number }
  | { type: "grantCover"; characterIds: string[]; tempAc: number }
  | { type: "spendHero"; characterId: string; reason: "reroll" | "plus4" | "narrative" }
  | { type: "awardHero"; characterId: string }
  | { type: "advance"; characterId: string; text: string }
  | { type: "log"; kind: LogKind; summary: string };

export const SEAT_CAP = 12;
export const COMPANY_CAP = 48;
export const GM_CAP = 4;

export function statValue(character: Character, stat: StatName | "none"): number {
  if (stat === "none") return 0;
  return character[stat];
}

export function effectiveAc(character: Pick<Character, "ac" | "tempAc" | "defenseTagActive">): number {
  return character.ac + character.tempAc + (character.defenseTagActive ? 1 : 0);
}
