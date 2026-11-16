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
  /**
   * Melee hits can spend a kinetic tank, 1 point for 1 damage.
   * False hides that control. Missing still offers it when the sheet has a tank.
   */
  melee?: boolean;
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
  /**
   * How this spell uses a kinetic tank, when the caster has one.
   * Omitted spells ignore the tank. The sheet stores this; the rules do not match on names.
   */
  tank?: SpellTank;
};

/**
 * brace: reaction. The next damage taken banks 3 per point instead of 2.
 * spend: ask how many points to spend and deduct them when the spell is cast.
 * overload: ask, deduct, and remember the spend. The next melee hit adds twice
 * that many damage, then the tank drops to 0.
 */
export type SpellTank = {
  use: "brace" | "spend" | "overload";
  /**
   * Tank points that equal 1 damage. Kinetic Throw is 2.
   * Omit when the table splits the points and nothing is converted here.
   */
  pointsPerDamage?: number;
};

export type Suit = {
  on: boolean;
  /** Shown on the toggle. Missing reads as "Suit", which is the jester suit. */
  name?: string;
  onCha: number;
  offCha: number;
  onAc: number;
  offAc: number;
  /**
   * Max hit points while worn, and while off.
   * Both are set, or neither. The difference is the bonus added to current HP
   * when the suit is put on and removed when it is taken off.
   */
  onHpMax?: number;
  offHpMax?: number;
};

/**
 * Opt-in kinetic tank. Missing means the sheet has no tank.
 * The cap is 3 × Combat and is not stored.
 */
export type KineticTank = {
  points: number;
  /** Armed by Brace. The next damage taken banks 3 per point, then this clears. */
  brace?: boolean;
  /**
   * Armed by Overload. These points were already deducted.
   * The next melee hit adds twice this many damage, then the tank drops to 0.
   */
  overload?: number;
};

/** contain shows the whole photo in the sheet frame. cover crops that frame. */
export type PortraitFit = "contain" | "cover";

/** A point on the photo, measured from the top-left. Each axis is 0 to 1. */
export type PortraitFocus = {
  x: number;
  y: number;
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
  /**
   * Universal Credits. Missing on an old sheet is 0.
   * Not read out of the inventory text.
   */
  credits?: number;
  /** Opt-in. Other sheets leave this off. */
  kineticTank?: KineticTank;
  tags: Tag[];
  weapons: Weapon[];
  spells: Spell[];
  energyShield: boolean;
  seated: boolean;
  suit?: Suit;
  /** +1 to cast while the focus is in hand. Naibroch's staff. */
  focusCastBonus?: number;
  focusOn?: boolean;
  /**
   * Storage path, or a data URL in the local demo.
   * Everyone at the table can see it. Empty until someone claims the sheet and uploads one.
   */
  portraitPath?: string | null;
  /**
   * How the sheet's large portrait sits in its frame.
   * Missing means show the whole picture. Stored on the sheet jsonb.
   */
  portraitFit?: PortraitFit;
  /**
   * Where small pictures, and Fill frame, keep the face.
   * Missing means the top center. Stored on the sheet jsonb.
   */
  portraitFocus?: PortraitFocus;
  /** True on a public card. The numbers on that object are empty, not the real sheet. */
  concealed?: boolean;
  /** Set on a public card. Does not say who claimed it. */
  claimed?: boolean;
  /** Set on a public card when hit points are 0. The hit point number stays hidden. */
  down?: boolean;
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
  /** Copied from a library template. The file itself stays on the GM-only bucket. */
  portraitPath?: string | null;
};

/** A folder in the table's Trouble library. Beasts, Bandits, Traps, Bosses. */
export type TroubleFolder = {
  id: string;
  name: string;
  sort: number;
};

/**
 * A saved foe or hazard. Adding it to the scene copies these numbers onto a live foe.
 * The template stays as it was. Trouble has no hero stat line: the GM sets the d12 bonus.
 */
export type Trouble = {
  id: string;
  folderId: string | null;
  name: string;
  /** Starting and maximum hit points for every copy added to the scene. */
  hp: number;
  ac: number;
  attackBonus: number;
  damage: string;
  abilities: string;
  notes: string;
  energyShield: boolean;
  ignoreAc?: number;
  portraitPath?: string | null;
  sort: number;
};

export type Member = {
  id: string;
  displayName: string;
  email: string;
};

/** A table this person belongs to. The creator's name tells same-named tables apart. */
export type TableSummary = {
  code: string;
  name: string;
  creatorName: string;
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

export type LogKind = "roll" | "damage" | "spell" | "advance" | "rest" | "session" | "hero" | "gm" | "note" | "credits";

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
  /** Saved trouble for this table. Only the current GM is shown this list. */
  trouble: Trouble[];
  troubleFolders: TroubleFolder[];
  /**
   * False when the live database has not applied migration 003 yet.
   * The rest of the table still loads. The local demo omits it.
   */
  troubleReady?: boolean;
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
    | "portraitFit"
    | "portraitFocus"
    | "credits"
  >
> & {
  /** Null turns the kinetic tank off. Omit the key to leave it alone. */
  kineticTank?: KineticTank | null;
};

export type Action =
  | { type: "join"; member: Member }
  | { type: "claim"; characterId: string }
  | { type: "release"; characterId: string }
  | { type: "patchCharacter"; characterId: string; patch: CharacterPatch }
  | { type: "setPortrait"; characterId: string; portraitPath: string | null }
  | { type: "setEligible"; memberIds: string[] }
  | { type: "claimGm" }
  | { type: "releaseGm" }
  | { type: "setSeated"; characterIds: string[] }
  | { type: "startSession" }
  | { type: "endSession" }
  | { type: "shortRest" }
  | { type: "longRest" }
  | { type: "addCharacter"; character: Character }
  | { type: "removeCharacter"; characterId: string }
  | { type: "addFoe"; foe: Foe }
  | { type: "patchFoe"; foeId: string; patch: Partial<Omit<Foe, "id">> }
  | { type: "removeFoe"; foeId: string }
  | { type: "saveFolder"; folder: TroubleFolder }
  | { type: "removeFolder"; folderId: string }
  | { type: "saveTrouble"; trouble: Trouble }
  | { type: "removeTrouble"; troubleId: string }
  | { type: "setTroubleArt"; troubleId: string; portraitPath: string | null }
  | { type: "spawnTrouble"; troubleId: string; count: number }
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
  | {
      /**
       * The GM sets hit points outright.
       * countsAsDamage banks a kinetic tank from the hit points actually lost.
       * Left off, the change is a correction and the tank stays put.
       */
      type: "setHitPoints";
      characterId: string;
      hp: number;
      countsAsDamage?: boolean;
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
export const FOLDER_CAP = 24;
export const TROUBLE_CAP = 80;
/** How many copies one tap can put in the scene. */
export const SPAWN_CAP = 12;

export function statValue(character: Character, stat: StatName | "none"): number {
  if (stat === "none") return 0;
  return character[stat];
}

export function effectiveAc(character: Pick<Character, "ac" | "tempAc" | "defenseTagActive">): number {
  return character.ac + character.tempAc + (character.defenseTagActive ? 1 : 0);
}
