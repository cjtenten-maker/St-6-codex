import type { BonusMode } from "../rules/attack";
import type { StatName } from "../model";

export type CatalogWeapon = {
  id: string;
  name: string;
  damage: string;
  hitStat: StatName | "none";
  altHitStat?: StatName;
  bonusStat?: StatName | "none";
  bonusMode: BonusMode;
  ignoreAc?: number;
  overheatsOnNat1?: boolean;
  notes: string;
};

/**
 * The sheet's two weapon tables, merged.
 * Damage dice are the sheet's. The stat bonus is half, applied when you strike,
 * except where a character's own weapon says full.
 */
export const WEAPONS: CatalogWeapon[] = [
  {
    id: "unarmed",
    name: "Unarmed Strike",
    damage: "1d4",
    hitStat: "strength",
    bonusMode: "half",
    notes: "Always available.",
  },
  {
    id: "dagger",
    name: "Dagger / Vibro-Knife",
    damage: "1d6",
    hitStat: "combat",
    altHitStat: "strength",
    bonusMode: "half",
    notes: "Throwable and concealable. Strength or Combat to hit.",
  },
  {
    id: "energy-sword",
    name: "Energy Sword",
    damage: "2d6",
    hitStat: "combat",
    bonusMode: "half",
    ignoreAc: 2,
    overheatsOnNat1: true,
    notes: "Ignores 2 AC from non-energy armor. Cuts most materials. Overheats on a natural 1.",
  },
  {
    id: "plasma-axe",
    name: "Plasma Axe",
    damage: "1d10",
    hitStat: "strength",
    bonusMode: "half",
    notes: "Two-handed option.",
  },
  {
    id: "blaster",
    name: "Blaster Rifle",
    damage: "2d6",
    hitStat: "combat",
    bonusMode: "half",
    notes: "Burst mode at close range.",
  },
  {
    id: "flamethrower",
    name: "Plasma Flamethrower",
    damage: "2d8",
    hitStat: "combat",
    bonusMode: "half",
    notes: "Close-range cone. Hits everyone in a small area. Sets flammable things on fire.",
  },
  {
    id: "grenade-frag",
    name: "Grenade (Frag)",
    damage: "3d6",
    hitStat: "none",
    bonusMode: "none",
    notes: "Thrown, about 10 feet. Strength check or full damage; half on a success. No hit stat.",
  },
  {
    id: "grenade-plasma",
    name: "Grenade (Plasma)",
    damage: "2d10",
    hitStat: "none",
    bonusMode: "none",
    ignoreAc: 3,
    notes: "Thrown. Ignores 3 AC. Smaller area, higher damage.",
  },
  {
    id: "pistol",
    name: "Spell-Infused Pistol",
    damage: "1d10+1d4",
    hitStat: "arcana",
    bonusMode: "half",
    notes: "Ranged. On a hit, pick fire, ice, or lightning for a minor rider.",
  },
  {
    id: "psi-blade",
    name: "Psi-Blade",
    damage: "1d8+1d4",
    hitStat: "arcana",
    bonusMode: "half",
    notes: "Ignores physical armor — the GM sets what's left of AC. On full potential the target may be stunned.",
  },
  {
    id: "shotgun",
    name: "Arcane Shotgun",
    damage: "2d6",
    hitStat: "arcana",
    bonusMode: "half",
    notes: "Close-range burst. Magical buckshot can ignore shields, if the GM agrees.",
  },
  {
    id: "neutron",
    name: "Neutron Whip",
    damage: "1d10",
    hitStat: "combat",
    bonusMode: "half",
    notes: "Reach. On a hit, a Strength check or the target drops whatever they're holding.",
  },
];

export type CatalogArmor = {
  id: string;
  name: string;
  ac: number;
  notes: string;
  strengthBonus?: number;
};

export const ARMORS: CatalogArmor[] = [
  { id: "clothes", name: "No Armor / Light Clothes", ac: 10, notes: "Everyday wear." },
  { id: "reinforced", name: "Reinforced Clothing", ac: 12, notes: "Travel gear." },
  { id: "light", name: "Light Armor", ac: 14, notes: "Leather or a flak vest." },
  { id: "medium", name: "Medium Armor", ac: 15, notes: "Tactical vest." },
  { id: "heavy-leather", name: "Heavy Leather / Combat Vest", ac: 16, notes: "Studded or reinforced." },
  { id: "plate", name: "Plate / Carapace", ac: 17, notes: "Full plate or a rigid suit." },
  {
    id: "powered-light",
    name: "Powered Armor (Light)",
    ac: 18,
    notes: "Exosuit. A minor penalty to stealth.",
    strengthBonus: 1,
  },
  {
    id: "powered-heavy",
    name: "Heavy Powered Armor",
    ac: 19,
    notes: "+1 Strength. Bulky.",
    strengthBonus: 1,
  },
  { id: "maximum", name: "Maximum Protection", ac: 20, notes: "Full shielding. Very restrictive." },
];

export type CatalogShield = {
  id: string;
  name: string;
  bonus: number;
  notes: string;
  energyShield?: boolean;
};

export const SHIELDS: CatalogShield[] = [
  { id: "none", name: "No shield", bonus: 0, notes: "" },
  { id: "buckler", name: "Buckler / Small Shield", bonus: 1, notes: "Adds to armor, and the stack stops at 20." },
  { id: "full", name: "Full Shield", bonus: 2, notes: "Adds to armor, and the stack stops at 20." },
  {
    id: "energy",
    name: "Energy Shield",
    bonus: 2,
    energyShield: true,
    notes: "Adds 2 AC. Swallows one full-potential hit, then drops.",
  },
  { id: "force", name: "Personal Force Field", bonus: 3, notes: "Limited duration. The stack stops at 20." },
];

export type CatalogSpell = {
  id: string;
  name: string;
  cost: number;
  tier: "Basic" | "Standard" | "Powerful";
  effect: string;
  range: string;
  damage?: string;
  heal?: string;
  tempAc?: number;
  aoeAc?: boolean;
  saveForHalf?: boolean;
  notes?: string;
};

/** The reference list. Character sheets reskin these and keep their own names. */
export const SPELLS: CatalogSpell[] = [
  { id: "bolt", name: "Bolt", cost: 1, tier: "Basic", effect: "1d8 + half Arcana to one target.", range: "Medium", damage: "1d8", notes: "Fire, ice, lightning, shadow, or a plasma dart." },
  { id: "ignite", name: "Ignite", cost: 1, tier: "Basic", effect: "Sets a target or object on fire: 1d6 each round until it's out.", range: "Short", damage: "1d6", notes: "Also a campfire or a torch." },
  { id: "lift", name: "Lift / Telekinesis", cost: 1, tier: "Basic", effect: "Move or lightly lift up to 50 lb, or one person.", range: "Short to medium" },
  { id: "shield-pulse", name: "Shield Pulse", cost: 1, tier: "Basic", effect: "+2 AC for 1 round. Usable as a reaction.", range: "Self or one ally", tempAc: 2 },
  { id: "mend", name: "Mend", cost: 1, tier: "Basic", effect: "Heal 1d8 + half Arcana.", range: "Touch", heal: "1d8", notes: "Or repair a small object." },
  { id: "gust", name: "Gust / Push", cost: 1, tier: "Basic", effect: "Push a target 10 feet, or knock over something small.", range: "Short" },
  { id: "detect", name: "Detect Magic", cost: 1, tier: "Basic", effect: "Sense nearby magic for one scene.", range: "Self" },
  { id: "glimmer", name: "Glimmer", cost: 1, tier: "Basic", effect: "Torch-bright light on an object or in your hand.", range: "Touch", notes: "About 10 minutes, or until dismissed." },
  { id: "blast", name: "Arcane Blast", cost: 2, tier: "Standard", effect: "2d8 + half Arcana to one target.", range: "Medium to long", damage: "2d8" },
  { id: "chain", name: "Chain Bolt", cost: 3, tier: "Standard", effect: "1d10 + half Arcana, then it jumps to one nearby target.", range: "Medium", damage: "1d10" },
  { id: "barrier", name: "Barrier", cost: 3, tier: "Standard", effect: "A wall of force. Blocks movement and attacks for 2 rounds.", range: "Short to medium" },
  { id: "enfeeble", name: "Enfeeble", cost: 2, tier: "Standard", effect: "Strength check or −2 Strength and Combat for 2 rounds.", range: "Short to medium" },
  { id: "haste", name: "Haste", cost: 2, tier: "Standard", effect: "+1 Combat and one extra action this turn.", range: "Self" },
  { id: "step", name: "Shadow Step", cost: 2, tier: "Standard", effect: "Teleport up to 30 feet to a place you can see.", range: "Self" },
  { id: "infusion", name: "Elemental Infusion", cost: 2, tier: "Standard", effect: "Your next attack: fire +1d6, ice slows (−1 Combat), or lightning +2 to hit.", range: "Self" },
  { id: "heal-wave", name: "Heal Wave", cost: 3, tier: "Standard", effect: "Heal 2d6 + half Arcana.", range: "Touch or short", heal: "2d6" },
  { id: "dominate", name: "Dominate", cost: 4, tier: "Powerful", effect: "Charisma check or controlled for 1 round. Simple commands.", range: "Short to medium" },
  { id: "flight", name: "Flight", cost: 4, tier: "Powerful", effect: "Fly for one scene, or about 5 minutes.", range: "Self" },
  { id: "nova", name: "Nova Blast", cost: 5, tier: "Powerful", effect: "4d6 + half Arcana in a small area. Strength check for half.", range: "Medium", damage: "4d6", saveForHalf: true },
  { id: "mass", name: "Mass Barrier", cost: 5, tier: "Powerful", effect: "+2 AC to allies within 30 feet for 2 rounds.", range: "Self", tempAc: 2, aoeAc: true },
  { id: "summon", name: "Summon Construct", cost: 5, tier: "Powerful", effect: "A temporary ally with 15 HP. Lasts 3 rounds.", range: "Short" },
  { id: "disintegrate", name: "Disintegrate", cost: 6, tier: "Powerful", effect: "3d10 + half Arcana. On maximum dice the GM may rule the target ruined.", range: "Medium to long", damage: "3d10" },
];

export const QUICK_DCS = [10, 12, 15] as const;
