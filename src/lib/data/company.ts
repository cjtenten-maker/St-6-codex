import { ID } from "../ids";
import type { Character, Spell, Tag, Weapon } from "../model";
import { HERO_START } from "../rules/rest";

function tag(label: string): Tag {
  return { id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-"), label, defensive: false };
}

function weapon(partial: Weapon): Weapon {
  return partial;
}

function spell(partial: Spell): Spell {
  return partial;
}

const seated = true;

/**
 * The ten sheets from the brief, with the numbers as written.
 * They belong to the table until someone claims them.
 * Unexplained +2s stay in the notes. Conditional bonuses are not baked in.
 * Full-stat damage is only Judge's Edge and Grino's shota.
 */
export function companyCharacters(): Character[] {
  const base = {
    ownerId: null,
    tempAc: 0,
    defenseTagActive: false,
    heroPoints: HERO_START,
    energyShield: false,
    seated,
  } satisfies Partial<Character>;

  const naibroch: Character = {
    ...base,
    id: ID.naibroch,
    name: "Naibroch Britheam",
    playerName: "Corbin",
    role: "Just judge and wandering mage",
    concept:
      "Cursed black dragon. Just judge of an ancient draconic race, a wandering mage of darkness and thorns in human form.",
    look: "Red cloak, black shirt, black boots. His darkness against Elowynne's light.",
    notes:
      "Judge's Edge changes form as a free action. The greatsword's paper also allows Combat to hit; damage stays full Strength.",
    abilities:
      "Judge's Edge changes form as a free action. Each form adds the full governing stat to damage.",
    inventory: "",
    charisma: 10,
    strength: 9,
    combat: 11,
    arcana: 12,
    hp: 36,
    hpMax: 36,
    mana: 24,
    ac: 17,
    acNote: "Leather bracers + magical shielding",
    tags: ["Black Dragon", "Mage", "Righteous Judge", "General"].map(tag),
    focusCastBonus: 1,
    focusOn: true,
    weapons: [
      weapon({
        id: "judges-staff",
        name: "Judge's Edge — Staff",
        damage: "1d6",
        hitStat: "arcana",
        bonusStat: "arcana",
        bonusMode: "full",
        notes: "Sentient focus. +1 to casting while it is in staff form.",
      }),
      weapon({
        id: "judges-greatsword",
        name: "Judge's Edge — Greatsword",
        damage: "2d6",
        hitStat: "strength",
        altHitStat: "combat",
        bonusStat: "strength",
        bonusMode: "full",
        notes: "Paper also allows Combat to hit. Damage is still full Strength.",
      }),
      weapon({
        id: "judges-bow",
        name: "Judge's Edge — Bow",
        damage: "1d10",
        hitStat: "combat",
        bonusStat: "combat",
        bonusMode: "full",
        notes: "Ranged.",
      }),
    ],
    spells: [
      spell({ id: "thorn-lash", name: "Thorn Lash", cost: 1, effect: "1d8 + half Arcana.", damage: "1d8" }),
      spell({ id: "black-flame-spark", name: "Black Flame Spark", cost: 1, effect: "1d6 each round until it's out.", damage: "1d6", notes: "Roll again each round it keeps burning." }),
      spell({ id: "shadow-lift", name: "Shadow Lift", cost: 1, effect: "Lift 50 lb, or one person." }),
      spell({ id: "judges-ward", name: "Judge's Ward", cost: 1, effect: "+2 AC for 1 round. A reaction.", tempAc: 2 }),
      spell({ id: "mend-the-broken", name: "Mend the Broken", cost: 1, effect: "Heal 1d8 + half Arcana.", heal: "1d8" }),
      spell({ id: "gloom-gust", name: "Gloom Gust", cost: 1, effect: "Push 10 feet." }),
      spell({ id: "sense-corruption", name: "Sense Corruption", cost: 1, effect: "Sense corruption for the scene." }),
      spell({ id: "draconic-glimmer", name: "Draconic Glimmer", cost: 1, effect: "Dim light for about 10 minutes." }),
      spell({ id: "black-flame-bolt", name: "Black Flame Bolt", cost: 2, effect: "2d8 + half Arcana.", damage: "2d8" }),
      spell({ id: "enfeebling-judgment", name: "Enfeebling Judgment", cost: 2, effect: "Strength check or −2 Strength and Combat for 2 rounds." }),
      spell({ id: "draconic-haste", name: "Draconic Haste", cost: 2, effect: "+1 Combat and an extra action." }),
      spell({ id: "shadow-step", name: "Shadow Step", cost: 2, effect: "Teleport 30 feet." }),
      spell({ id: "flame-thorn", name: "Flame and Thorn Infusion", cost: 2, effect: "Next attack: fire +1d6, ice, or lightning." }),
      spell({ id: "thorn-barrage", name: "Thorn Barrage", cost: 3, effect: "1d10 + half Arcana, then it jumps.", damage: "1d10" }),
      spell({ id: "wall-of-thorns", name: "Wall of Thorns", cost: 3, effect: "A wall for 2 rounds." }),
      spell({ id: "healing-thorns", name: "Healing Thorns", cost: 3, effect: "Heal 2d6 + half Arcana.", heal: "2d6" }),
      spell({ id: "thorn-binding", name: "Thorn Binding", cost: 4, effect: "Charisma check or held for 1 round." }),
      spell({ id: "wings", name: "Wings of the Black Dragon", cost: 4, effect: "Fly for the scene, or about 5 minutes." }),
      spell({ id: "nova", name: "Nova of Black Flame", cost: 5, effect: "4d6 + half Arcana in an area. Strength check for half.", damage: "4d6", saveForHalf: true }),
      spell({ id: "mass-judgment", name: "Mass Judgment", cost: 5, effect: "+2 AC to allies within 30 feet for 2 rounds.", tempAc: 2, aoeAc: true }),
      spell({ id: "thorn-wraith", name: "Summon Thorn Wraith", cost: 5, effect: "An ally with 15 HP for 3 rounds." }),
      spell({ id: "gaze", name: "Disintegrating Gaze", cost: 6, effect: "3d10 + half Arcana. On maximum dice the GM may rule the target ruined.", damage: "3d10" }),
    ],
  };

  const elowynne: Character = {
    ...base,
    id: ID.elowynne,
    name: "Elowynne",
    playerName: "Trish",
    role: "Faerie princess and healer",
    concept:
      "Heir to her realm's throne, and she remembers none of it. Naibroch pulled her from an evil cult three months ago. He didn't know her name. She joined Seal Team-6 hoping the memories come back.",
    look: "Long golden wavy hair, in a bun or a braid on missions. Bright green eyes. Swirl tattoos glow blue when she casts. Graceful, compassionate, haunted.",
    notes: "The notes sometimes say AC 15. The sheet used here is 14, light leather. Attack spells add half Arcana.",
    abilities: "Attack spells add half Arcana.",
    inventory: "",
    charisma: 9,
    strength: 8,
    combat: 8,
    arcana: 10,
    hp: 29,
    hpMax: 29,
    mana: 20,
    ac: 14,
    acNote: "Light leather. The notes sometimes say 15.",
    tags: ["Faerie princess", "Healer", "Amnesiac"].map(tag),
    weapons: [
      weapon({
        id: "wooden-staff",
        name: "Wooden Staff",
        damage: "1d6",
        hitStat: "combat",
        bonusStat: "arcana",
        bonusMode: "half",
        notes: "Combat to hit. Damage is half Arcana.",
      }),
      weapon({
        id: "dagger",
        name: "Dagger",
        damage: "1d6",
        hitStat: "combat",
        bonusStat: "combat",
        bonusMode: "half",
      }),
    ],
    spells: [
      spell({ id: "soothing-bloom", name: "Soothing Bloom", cost: 2, effect: "A regen aura and a lift to morale." }),
      spell({ id: "purifying-glow", name: "Purifying Glow", cost: 3, effect: "Cleanse poison, disease, or a minor curse. Reveals magic." }),
      spell({ id: "faerie-veil", name: "Faerie Veil", cost: 3, effect: "+2 AC, and a glamour.", tempAc: 2 }),
      spell({ id: "blinding-flash", name: "Blinding Flash", cost: 4, effect: "A wide flash." }),
      spell({ id: "radiant-bolt", name: "Radiant Bolt", cost: 5, effect: "1d10 + half Arcana.", damage: "1d10" }),
      spell({ id: "healing-radiance", name: "Healing Radiance", cost: 5, effect: "Heal 2d8 + half Arcana.", heal: "2d8" }),
      spell({ id: "ethereal-revelation", name: "Ethereal Revelation", cost: 6, effect: "Dispel a stronger illusion, or glimpse a lost memory." }),
      spell({ id: "celestial-lance", name: "Celestial Lance", cost: 8, effect: "3d10 + half Arcana.", damage: "3d10" }),
    ],
  };

  const willow: Character = {
    ...base,
    id: ID.willow,
    name: "Willow",
    playerName: "",
    role: "Small notebook only",
    concept: "",
    look: "",
    notes: "Small notebook only. Arcana 13 and AC 7 stand as written, outside the usual ranges. No tags were recorded.",
    abilities: "",
    inventory: "",
    charisma: 9,
    strength: 10,
    combat: 7,
    arcana: 13,
    hp: 27,
    hpMax: 27,
    mana: 26,
    ac: 7,
    acNote: "Written 7. Kept.",
    tags: [],
    weapons: [
      weapon({
        id: "unarmed",
        name: "Unarmed",
        damage: "1d4",
        hitStat: "strength",
        bonusMode: "half",
      }),
    ],
    spells: [],
  };

  const mystie: Character = {
    ...base,
    id: ID.mystie,
    name: "Mystie",
    playerName: "",
    role: "Shapeshifter and tinkerer",
    concept: "An introvert. Loves animals, nature, and pretzels.",
    look: "Long wavy brown braid, Victorian clothes, green cloak, freckles, leather boots, elfin features, green eyes with gold flecks. Petite, 5'3\".",
    notes:
      "Margin says base AC 5; the sheet is 6. Shifted is +1 Combat and +1 Strength. Tinkering is +1 Arcana. Neither is baked in.",
    abilities: "Shapeshift and tinker. The bonuses are conditional and stay off the numbers until the table says otherwise.",
    inventory: "Seal Team watch, Loki's Stick (ash, iron, a bit of gold), 880 credits, 10 hardening seeds.",
    charisma: 7,
    strength: 8,
    combat: 8,
    arcana: 10,
    hp: 31,
    hpMax: 31,
    mana: 20,
    ac: 6,
    acNote: "Written 6. Margin says base 5.",
    tags: ["Shapeshifter", "Tinkerer"].map(tag),
    weapons: [
      weapon({
        id: "lokis-melee",
        name: "Loki's Stick",
        damage: "1d12",
        hitStat: "none",
        bonusStat: "none",
        bonusMode: "none",
        notes: "Melee. Any non-magical weapon she wishes. No stat added.",
      }),
      weapon({
        id: "lokis-ranged",
        name: "Loki's Stick — ranged",
        damage: "3d4",
        hitStat: "none",
        bonusStat: "none",
        bonusMode: "none",
        notes: "Ranged. No stat added.",
      }),
    ],
    spells: [],
  };

  const emma: Character = {
    ...base,
    id: ID.emma,
    name: "Emma",
    playerName: "",
    role: "Torn scrap",
    concept: "",
    look: "",
    notes:
      "Torn scrap. Charisma was written 12+2; the +2 is not added. A loose column — 11, 12, 9, 7, 6, 10 — and the sum 26 are not applied. No tags were recorded.",
    abilities: "",
    inventory: "",
    charisma: 12,
    strength: 11,
    combat: 10,
    arcana: 10,
    hp: 34,
    hpMax: 34,
    mana: 20,
    ac: 6,
    acNote: "Written 6.",
    tags: [],
    weapons: [
      weapon({ id: "unarmed", name: "Unarmed", damage: "1d4", hitStat: "strength", bonusMode: "half" }),
    ],
    spells: [],
  };

  const nixy: Character = {
    ...base,
    id: ID.nixy,
    name: "Nixy",
    playerName: "",
    role: "Speaker with birds",
    concept: "Age 20. The white bird Shadowfax travels with her and is not a separate character.",
    look: "Blue glowing necklace, red hood and coat with a gold bird emblem, yellow sleeves, black leggings, brown boots, black hair.",
    notes: "Arcana was written 12+2. The +2 is not added. \"Charites\" is read as one trait.",
    abilities: "Talks to any bird. Touch an animal and take one trait of her choice.",
    inventory: "",
    charisma: 12,
    strength: 8,
    combat: 10,
    arcana: 12,
    hp: 33,
    hpMax: 33,
    mana: 24,
    ac: 8,
    acNote: "Written 8.",
    tags: ["Speaks with birds"].map(tag),
    weapons: [
      weapon({ id: "unarmed", name: "Unarmed", damage: "1d4", hitStat: "strength", bonusMode: "half" }),
    ],
    spells: [],
  };

  const rob: Character = {
    ...base,
    id: ID.rob,
    name: "Rob Goodfellow",
    playerName: "Justin Ratsprit",
    role: "Jester, King of Fools, ringmaster",
    concept:
      "Out to claim king of the faeries. Crowned by the Winter Court. The name line also reads Justin Ratsprit.",
    look: "The jester suit, when he has it on.",
    notes:
      "Suit on is the usual state: Charisma 12 (9+3) and AC 17 (14+3). Suit off: Charisma 9, AC 14. The scimitar's 10% chance to double harm is called at the table, not rolled by the codex.",
    abilities:
      "Immune to insanity. Ventriloquism at will. Catch anything thrown and hurl it back within 10 feet. Permanently hasted. Speaks 30 languages. Climbs. Picks pockets. Casts like a mage, including illusions.",
    inventory:
      "Jester suit, paddle balls, wand of wonder, scimitar of sharpness, Roller Hopper skates (move 30 on any surface), 2 test tubes each of blue, white, red, black, purple, yellow, green, and brown powder, about 18,000 credits.",
    charisma: 12,
    strength: 6,
    combat: 7,
    arcana: 11,
    hp: 37,
    hpMax: 37,
    mana: 22,
    ac: 17,
    acNote: "14+3 with the suit on.",
    suit: { on: true, onCha: 12, offCha: 9, onAc: 17, offAc: 14 },
    tags: ["King of Fools", "Ringmaster", "Jester suit"].map(tag),
    weapons: [
      weapon({
        id: "paddle-balls",
        name: "Paddle balls",
        damage: "4d4",
        hitStat: "none",
        bonusStat: "none",
        bonusMode: "none",
        attacksPerRound: 4,
        notes: "Area. Four attacks a round. 14 balls. Soft range. No stat added.",
      }),
      weapon({
        id: "scimitar",
        name: "Scimitar of sharpness",
        damage: "1d6+1",
        hitStat: "combat",
        bonusStat: "none",
        bonusMode: "none",
        notes: "The +1 is already in the dice. A 10% chance to double harm is not automated.",
      }),
      weapon({
        id: "wand",
        name: "Wand of wonder",
        damage: "1d6",
        hitStat: "arcana",
        bonusStat: "arcana",
        bonusMode: "half",
        notes: "No damage was written. Placeholder: 1d6 + half Arcana.",
      }),
    ],
    spells: [],
  };

  const apple: Character = {
    ...base,
    id: ID.apple,
    name: "Apple Pot",
    playerName: "",
    role: "Mail carrier",
    concept: "Likes apple pie and cheese.",
    look: "",
    notes:
      "The paper shows +2 AC for 2 rounds. It is not applied. Tally marks beside HP and mana were not counted; both are entered full.",
    abilities: "",
    inventory: "Human glasses, mail bag.",
    charisma: 10,
    strength: 11,
    combat: 10,
    arcana: 10,
    hp: 28,
    hpMax: 28,
    mana: 20,
    ac: 10,
    acNote: "Written 10. A conditional +2 AC for 2 rounds is not applied.",
    tags: ["Mail carrier"].map(tag),
    weapons: [
      weapon({
        id: "tail-whip",
        name: "Tail whip",
        damage: "1d6",
        hitStat: "strength",
        bonusStat: "strength",
        bonusMode: "half",
        notes: "Bludgeoning.",
      }),
    ],
    spells: [
      spell({
        id: "hyper-beam",
        name: "Hyper Beam",
        cost: 10,
        effect: "5d6 + half Arcana in a line, about 60 feet.",
        damage: "5d6",
      }),
      spell({
        id: "thunder-punch",
        name: "Thunder Punch",
        cost: 3,
        effect: "1d6+1d4 lightning. The sheet adds no stat.",
        damage: "1d6+1d4",
        bonusMode: "none",
      }),
    ],
  };

  const grino: Character = {
    ...base,
    id: ID.grino,
    name: "Grino",
    playerName: "",
    role: "Force-sensitive clone",
    concept: "In his 50s, and not the brightest. He tried to grab Kevin instead of using the lightsaber.",
    look: "",
    notes:
      "Arcana is read as 8, not 9. The paper shows +2 AC for 1 round; it is not applied. Tally marks beside HP were not counted.",
    abilities: "",
    inventory: "",
    charisma: 6,
    strength: 8,
    combat: 8,
    arcana: 8,
    hp: 32,
    hpMax: 32,
    mana: 16,
    ac: 17,
    acNote: "Written 17. A conditional +2 AC for 1 round is not applied.",
    tags: ["Force-sensitive"].map(tag),
    weapons: [
      weapon({
        id: "blaster",
        name: "Blaster",
        damage: "2d6",
        hitStat: "combat",
        bonusStat: "combat",
        bonusMode: "half",
      }),
      weapon({
        id: "shota",
        name: "Shota",
        damage: "2d6",
        hitStat: "combat",
        bonusStat: "combat",
        bonusMode: "full",
        ignoreAc: 2,
        notes: "Lightsaber dagger. Full Combat to damage. Ignores 2 AC.",
      }),
    ],
    spells: [],
  };

  const reginald: Character = {
    ...base,
    id: ID.reginald,
    name: "Reginald Crowe",
    playerName: "",
    role: "Former MI6, apprenticed to Naibroch",
    concept:
      "Cold War MI6, about 1980. The power came after a failed mission in France. He stops to take tea so the shadow doesn't consume him. Blades only — firearms show weakness.",
    look: "",
    notes:
      "Mana is 14 of 20. The paper shows +2 AC for 2 rounds; it is not applied. Corner numbers 73, 58, 10, and 7 are ignored.",
    abilities: "Blades first. He stops for tea so the shadow doesn't consume him.",
    inventory: "Two hydrodaggers, a can of SpaghettiOs, four hot pockets, a can of Cheez Whiz, payphone change.",
    charisma: 7,
    strength: 7,
    combat: 10,
    arcana: 10,
    hp: 23,
    hpMax: 23,
    mana: 14,
    ac: 14,
    acNote: "Light armor. A conditional +2 AC for 2 rounds is not applied.",
    tags: ["Shadow-touched", "Stops for tea", "Blades first"].map(tag),
    weapons: [
      weapon({
        id: "shadow-scythe",
        name: "Shadow scythe",
        damage: "1d10",
        hitStat: "arcana",
        bonusStat: "arcana",
        bonusMode: "half",
      }),
      weapon({
        id: "obsidian-knives",
        name: "Obsidian knives",
        damage: "1d6",
        hitStat: "combat",
        bonusStat: "combat",
        bonusMode: "half",
        notes: "A reserved pair.",
      }),
    ],
    spells: [
      spell({ id: "void-lash", name: "Void Lash", cost: 1, effect: "1d8 + half Arcana.", damage: "1d8" }),
      spell({ id: "shadow-lift", name: "Shadow Lift", cost: 1, effect: "Lift 50 lb, or one person." }),
      spell({ id: "shadow-step", name: "Shadow Step", cost: 2, effect: "Teleport 30 feet." }),
      spell({
        id: "void-consumption",
        name: "Void Consumption",
        cost: 5,
        effect: "A void ball. A failed opposed Arcana check sends the target to a pocket dimension.",
      }),
    ],
  };

  return [naibroch, elowynne, willow, mystie, emma, nixy, rob, apple, grino, reginald];
}

/** Same ten, new ids, for a table that isn't the local demo. */
export function companyForTable(): Character[] {
  return companyCharacters().map((character) => ({
    ...character,
    id: crypto.randomUUID(),
    seated: true,
    ownerId: null,
  }));
}
