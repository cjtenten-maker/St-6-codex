import type { Action, Character, CharacterPatch, LogEntry, LogKind, Member, TableState, Trouble, TroubleFolder } from "../model";
import { COMPANY_CAP, FOLDER_CAP, GM_CAP, SEAT_CAP, TROUBLE_CAP } from "../model";
import { RuleError } from "../rules/errors";
import { manaMaximum, spendMana } from "../rules/cast";
import { HERO_CAP, HERO_START, awardHeroPoint, longRest, shortRest, spendHeroPoint } from "../rules/rest";
import { enterLine, foeFromTrouble, instanceNames, libraryOf } from "./library";
import { isClaimed, isOwnCharacter } from "./present";

export type ActionContext = {
  actorId: string;
  now?: string;
  id?: () => string;
};

export function applyAction(state: TableState, action: Action, ctx: ActionContext): TableState {
  if (action.type === "join") return join(state, action.member);
  const actor = requireMember(state, ctx.actorId);
  switch (action.type) {
    case "claim":
      return claim(state, actor, action.characterId, ctx);
    case "release":
      return release(state, actor, action.characterId, ctx);
    case "patchCharacter":
      return patchCharacter(state, actor, action.characterId, action.patch);
    case "setPortrait":
      return setPortrait(state, actor, action.characterId, action.portraitPath);
    case "setEligible":
      return setEligible(state, actor, action.memberIds);
    case "claimGm":
      return claimGm(state, actor, ctx);
    case "releaseGm":
      return releaseGm(state, actor, ctx);
    case "setSeated":
      return setSeated(state, actor, action.characterIds, ctx);
    case "startSession":
      return startSession(state, actor, ctx);
    case "endSession":
      return endSession(state, actor, ctx);
    case "shortRest":
      return rest(state, actor, "short", ctx);
    case "longRest":
      return rest(state, actor, "long", ctx);
    case "addCharacter":
      return addCharacter(state, actor, action.character);
    case "removeCharacter":
      return removeCharacter(state, actor, action.characterId, ctx);
    case "addFoe":
      return addFoe(state, actor, action.foe, ctx);
    case "patchFoe":
      return patchFoe(state, actor, action.foeId, action.patch);
    case "removeFoe":
      return removeFoe(state, actor, action.foeId, ctx);
    case "saveFolder":
      return saveFolder(state, actor, action.folder);
    case "removeFolder":
      return removeFolder(state, actor, action.folderId);
    case "saveTrouble":
      return saveTrouble(state, actor, action.trouble);
    case "removeTrouble":
      return removeTrouble(state, actor, action.troubleId);
    case "setTroubleArt":
      return setTroubleArt(state, actor, action.troubleId, action.portraitPath);
    case "spawnTrouble":
      return spawnTrouble(state, actor, action.troubleId, action.count, ctx);
    case "setScene":
      return setScene(state, actor, action.scene);
    case "setGmNotes":
      return setGmNotes(state, actor, action.notes);
    case "setSide":
      return setSide(state, actor, action.side, ctx);
    case "moveTurn":
      return moveTurn(state, actor, action.characterId, action.direction);
    case "applyHarm":
      return applyHarm(state, actor, action, ctx);
    case "spendMana":
      return spendManaAction(state, actor, action.characterId, action.amount);
    case "grantCover":
      return grantCover(state, actor, action.characterIds, action.tempAc, ctx);
    case "spendHero":
      return spendHero(state, actor, action.characterId, action.reason, ctx);
    case "awardHero":
      return awardHero(state, actor, action.characterId, ctx);
    case "advance":
      return advance(state, actor, action.characterId, action.text, ctx);
    case "log":
      return withLog(state, ctx, action.kind, action.summary);
    default:
      return state;
  }
}

function join(state: TableState, member: Member): TableState {
  if (state.members.some((m) => m.id === member.id)) return state;
  return { ...state, members: [...state.members, member] };
}

function claim(state: TableState, actor: Member, characterId: string, ctx: ActionContext): TableState {
  const character = requireCharacter(state, characterId);
  if (isClaimed(character) && character.ownerId !== actor.id) {
    throw new RuleError(`${character.name} is already claimed.`);
  }
  if (character.ownerId === actor.id) return state;
  return withLog(
    mapCharacter(state, characterId, (c) => ({ ...c, ownerId: actor.id })),
    ctx,
    "note",
    `${actor.displayName} claims ${character.name}.`,
  );
}

function release(state: TableState, actor: Member, characterId: string, ctx: ActionContext): TableState {
  const character = requireCharacter(state, characterId);
  if (character.ownerId !== actor.id && !isGm(state, actor)) {
    throw new RuleError(`Only ${character.name}'s player can hand them back.`);
  }
  if (!character.ownerId) return state;
  return withLog(
    mapCharacter(state, characterId, (c) => ({ ...c, ownerId: null })),
    ctx,
    "note",
    `${character.name} belongs to the table again.`,
  );
}

function setPortrait(state: TableState, actor: Member, characterId: string, portraitPath: string | null): TableState {
  const character = requireCharacter(state, characterId);
  if (character.concealed) throw new RuleError("That sheet is private.");
  if (!character.ownerId) throw new RuleError("Claim the character before adding a portrait.");
  if (!isGm(state, actor) && character.ownerId !== actor.id) {
    throw new RuleError("Only the player or the GM can change the portrait.");
  }
  return mapCharacter(state, characterId, (current) => ({ ...current, portraitPath }));
}

function patchCharacter(state: TableState, actor: Member, characterId: string, patch: CharacterPatch): TableState {
  const character = requireCharacter(state, characterId);
  assertCanEdit(state, actor, character);
  const next = normalizeCharacter({ ...character, ...patch, id: character.id });
  assertUniqueName(state, next);
  return mapCharacter(state, characterId, () => next);
}

function setEligible(state: TableState, actor: Member, memberIds: string[]): TableState {
  if (!isGm(state, actor) && state.table.createdBy !== actor.id) {
    throw new RuleError("The GM or the person who opened the table marks who can take the screen.");
  }
  const unique = [...new Set(memberIds)];
  if (unique.length > GM_CAP) throw new RuleError("Three or four people can be GM-eligible. Four is the limit.");
  for (const id of unique) {
    if (!state.members.some((m) => m.id === id)) throw new RuleError("That person isn't at this table.");
  }
  if (state.table.currentGmId && !unique.includes(state.table.currentGmId)) {
    throw new RuleError("The GM tonight stays eligible.");
  }
  return { ...state, table: { ...state.table, gmEligibleIds: unique } };
}

function claimGm(state: TableState, actor: Member, ctx: ActionContext): TableState {
  if (!state.table.gmEligibleIds.includes(actor.id)) {
    throw new RuleError("You aren't marked GM-eligible.");
  }
  if (state.table.currentGmId === actor.id) return state;
  const characters = state.characters.map((character) =>
    isOwnCharacter(actor, character) ? { ...character, seated: false } : character,
  );
  const next: TableState = {
    ...state,
    characters,
    table: { ...state.table, currentGmId: actor.id },
  };
  return withLog(syncOrder(next), ctx, "gm", `${actor.displayName} takes the GM screen. Their own characters sit out.`);
}

function releaseGm(state: TableState, actor: Member, ctx: ActionContext): TableState {
  if (!isGm(state, actor)) throw new RuleError("You don't have the GM screen.");
  return withLog(
    { ...state, table: { ...state.table, currentGmId: null } },
    ctx,
    "gm",
    `${actor.displayName} sets the GM screen down. The notes stay for the next GM.`,
  );
}

function setSeated(state: TableState, actor: Member, characterIds: string[], ctx: ActionContext): TableState {
  assertGm(state, actor);
  const unique = [...new Set(characterIds)];
  if (unique.length > SEAT_CAP) throw new RuleError("Twelve heroes can sit. That's the table.");
  for (const id of unique) {
    const character = requireCharacter(state, id);
    if (isOwnCharacter(actor, character)) {
      throw new RuleError(`${character.name} sits out while you have the screen.`);
    }
  }
  const wanted = new Set(unique);
  const characters = state.characters.map((character) => ({ ...character, seated: wanted.has(character.id) }));
  return withLog(
    syncOrder({ ...state, characters }),
    ctx,
    "note",
    `Seating is ${unique.length} of ${SEAT_CAP}.`,
  );
}

function startSession(state: TableState, actor: Member, ctx: ActionContext): TableState {
  assertGm(state, actor);
  const sessionId = takeId(ctx);
  const characters = state.characters.map((character) =>
    character.seated ? { ...character, heroPoints: HERO_START } : character,
  );
  return withLog(
    {
      ...state,
      characters,
      table: { ...state.table, sessionActive: true, sessionId },
    },
    { ...ctx, sessionId },
    "session",
    "Session starts. Seated heroes are back to 3 hero points.",
  );
}

function endSession(state: TableState, actor: Member, ctx: ActionContext): TableState {
  assertGm(state, actor);
  if (!state.table.sessionActive) return state;
  return withLog(
    { ...state, table: { ...state.table, sessionActive: false } },
    ctx,
    "session",
    "Session ends. The log stays.",
  );
}

function rest(state: TableState, actor: Member, kind: "short" | "long", ctx: ActionContext): TableState {
  assertGm(state, actor);
  const characters = state.characters.map((character) => {
    if (!character.seated) return character;
    const manaMax = manaMaximum(character.arcana);
    const result =
      kind === "short"
        ? shortRest(character, manaMax)
        : longRest(character, manaMax);
    return {
      ...character,
      hp: clamp(result.hp, 0, character.hpMax),
      mana: result.mana,
      tempAc: result.tempAc,
      defenseTagActive: result.defenseTagActive,
      weapons: character.weapons.map((weapon) => ({ ...weapon, overheated: false })),
    };
  });
  const summary =
    kind === "short"
      ? "Short rest. Seated heroes regain mana equal to Arcana. No hit points."
      : "Long rest. Seated heroes are whole: hit points and mana full.";
  return withLog({ ...state, characters }, ctx, "rest", summary);
}

function addCharacter(state: TableState, actor: Member, character: Character): TableState {
  if (state.characters.length >= COMPANY_CAP) {
    throw new RuleError("The company holds 48. Retire a story before you add another.");
  }
  if (character.ownerId && character.ownerId !== actor.id) {
    throw new RuleError("A new hero is yours, or belongs to the table.");
  }
  const next = normalizeCharacter({ ...character, seated: false, ownerId: character.ownerId });
  if (state.characters.some((c) => c.id === next.id)) throw new RuleError("That hero is already here.");
  assertUniqueName(state, next);
  return { ...state, characters: [...state.characters, next] };
}

function removeCharacter(state: TableState, actor: Member, characterId: string, ctx: ActionContext): TableState {
  const character = requireCharacter(state, characterId);
  if (character.concealed) throw new RuleError(`${character.name}'s sheet is private.`);
  if (!isGm(state, actor) && character.ownerId !== actor.id) {
    throw new RuleError(`Only ${character.name}'s player or the GM can retire them.`);
  }
  const characters = state.characters.filter((item) => item.id !== character.id);
  return withLog(
    syncOrder({ ...state, characters }),
    ctx,
    "note",
    `${character.name} leaves the company.`,
  );
}

function assertUniqueName(state: TableState, character: Character): void {
  const name = character.name.trim().toLowerCase();
  if (!name) return;
  const clash = state.characters.some(
    (other) => other.id !== character.id && other.name.trim().toLowerCase() === name,
  );
  if (clash) {
    throw new RuleError(`${character.name.trim()} is already at this table. Claim that sheet instead of adding another.`);
  }
}

function addFoe(state: TableState, actor: Member, foe: TableState["foes"][number], ctx: ActionContext): TableState {
  assertGm(state, actor);
  return withLog({ ...state, foes: [...state.foes, foe] }, ctx, "note", `${foe.name} enters the scene.`);
}

function patchFoe(state: TableState, actor: Member, foeId: string, patch: Partial<Omit<TableState["foes"][number], "id">>): TableState {
  assertGm(state, actor);
  if (!state.foes.some((foe) => foe.id === foeId)) throw new RuleError("That foe isn't in the scene.");
  return {
    ...state,
    foes: state.foes.map((foe) => (foe.id === foeId ? { ...foe, ...patch, id: foe.id } : foe)),
  };
}

function removeFoe(state: TableState, actor: Member, foeId: string, ctx: ActionContext): TableState {
  assertGm(state, actor);
  const foe = state.foes.find((item) => item.id === foeId);
  if (!foe) return state;
  return withLog(
    { ...state, foes: state.foes.filter((item) => item.id !== foeId) },
    ctx,
    "note",
    `${foe.name} leaves the scene.`,
  );
}

function saveFolder(state: TableState, actor: Member, folder: TroubleFolder): TableState {
  assertGm(state, actor);
  const { troubleFolders } = libraryOf(state);
  const name = folder.name.trim();
  if (!name) throw new RuleError("Name the folder.");
  if (name.length > 40) throw new RuleError("That folder name is too long.");
  const clash = troubleFolders.some((item) => item.id !== folder.id && item.name.toLowerCase() === name.toLowerCase());
  if (clash) throw new RuleError("That folder is already in the library.");
  const existing = troubleFolders.find((item) => item.id === folder.id);
  if (!existing && troubleFolders.length >= FOLDER_CAP) throw new RuleError("The library has enough folders.");
  const next: TroubleFolder = { id: folder.id, name, sort: existing?.sort ?? troubleFolders.length };
  const folders = existing
    ? troubleFolders.map((item) => (item.id === folder.id ? next : item))
    : [...troubleFolders, next];
  return { ...state, troubleFolders: folders, trouble: libraryOf(state).trouble };
}

function removeFolder(state: TableState, actor: Member, folderId: string): TableState {
  assertGm(state, actor);
  const { trouble, troubleFolders } = libraryOf(state);
  if (!troubleFolders.some((folder) => folder.id === folderId)) return state;
  return {
    ...state,
    troubleFolders: troubleFolders.filter((folder) => folder.id !== folderId),
    trouble: trouble.map((item) => (item.folderId === folderId ? { ...item, folderId: null } : item)),
  };
}

function saveTrouble(state: TableState, actor: Member, trouble: Trouble): TableState {
  assertGm(state, actor);
  const { trouble: saved, troubleFolders } = libraryOf(state);
  const next = cleanTrouble(trouble, troubleFolders);
  const existing = saved.find((item) => item.id === next.id);
  if (!existing && saved.length >= TROUBLE_CAP) throw new RuleError("The library is full.");
  if (!existing) next.sort = saved.length;
  else next.sort = existing.sort;
  next.portraitPath = existing?.portraitPath ?? next.portraitPath ?? null;
  const list = existing ? saved.map((item) => (item.id === next.id ? next : item)) : [...saved, next];
  return { ...state, trouble: list, troubleFolders };
}

function removeTrouble(state: TableState, actor: Member, troubleId: string): TableState {
  assertGm(state, actor);
  const { trouble, troubleFolders } = libraryOf(state);
  return {
    ...state,
    troubleFolders,
    trouble: trouble.filter((item) => item.id !== troubleId),
  };
}

function setTroubleArt(state: TableState, actor: Member, troubleId: string, portraitPath: string | null): TableState {
  assertGm(state, actor);
  const { trouble, troubleFolders } = libraryOf(state);
  const item = trouble.find((entry) => entry.id === troubleId);
  if (!item) throw new RuleError("Save the trouble before adding a picture.");
  return {
    ...state,
    troubleFolders,
    trouble: trouble.map((entry) => (entry.id === troubleId ? { ...entry, portraitPath } : entry)),
  };
}

function spawnTrouble(state: TableState, actor: Member, troubleId: string, count: number, ctx: ActionContext): TableState {
  assertGm(state, actor);
  const { trouble, troubleFolders } = libraryOf(state);
  const template = trouble.find((item) => item.id === troubleId);
  if (!template) throw new RuleError("That trouble isn't in the library.");
  const names = instanceNames(template.name, count, state.foes.map((foe) => foe.name));
  const foes = [
    ...state.foes,
    ...names.map((name) => foeFromTrouble(template, takeId(ctx), name)),
  ];
  return withLog({ ...state, foes, trouble, troubleFolders }, ctx, "note", enterLine(names));
}

function cleanTrouble(trouble: Trouble, folders: TroubleFolder[]): Trouble {
  const name = trouble.name.trim();
  if (!name) throw new RuleError("Give the trouble a name.");
  if (name.length > 80) throw new RuleError("That name is too long.");
  const hp = Math.floor(Number(trouble.hp));
  if (!Number.isFinite(hp) || hp < 1 || hp > 9999) throw new RuleError("Hit points need to be at least 1.");
  const ac = Math.floor(Number(trouble.ac));
  if (!Number.isFinite(ac) || ac < 0 || ac > 99) throw new RuleError("Armor class needs to be from 0 to 99.");
  const attackBonus = Math.floor(Number(trouble.attackBonus));
  if (!Number.isFinite(attackBonus) || attackBonus < -30 || attackBonus > 40) {
    throw new RuleError("The attack bonus is what you add to the d12.");
  }
  const damage = (trouble.damage || "").trim() || "1d6";
  if (damage.length > 40) throw new RuleError("Keep the damage line short, like 2d6+3.");
  const abilities = (trouble.abilities || "").trim();
  const notes = (trouble.notes || "").trim();
  if (abilities.length > 2000 || notes.length > 2000) throw new RuleError("That note is too long.");
  if (trouble.folderId && !folders.some((folder) => folder.id === trouble.folderId)) {
    throw new RuleError("That folder isn't in the library.");
  }
  let ignoreAc: number | undefined;
  if (trouble.ignoreAc != null && `${trouble.ignoreAc}` !== "") {
    ignoreAc = Math.floor(Number(trouble.ignoreAc));
    if (!Number.isFinite(ignoreAc) || ignoreAc < 0 || ignoreAc > 30) throw new RuleError("Ignore AC needs to be from 0 to 30.");
  }
  return {
    id: trouble.id,
    folderId: trouble.folderId,
    name,
    hp,
    ac,
    attackBonus,
    damage,
    abilities,
    notes,
    energyShield: Boolean(trouble.energyShield),
    ignoreAc,
    portraitPath: trouble.portraitPath ?? null,
    sort: Number.isFinite(trouble.sort) ? trouble.sort : 0,
  };
}

function setScene(state: TableState, actor: Member, scene: string): TableState {
  assertGm(state, actor);
  return { ...state, table: { ...state.table, sceneNote: scene } };
}

function setGmNotes(state: TableState, actor: Member, notes: string): TableState {
  assertGm(state, actor);
  return { ...state, table: { ...state.table, gmNotes: notes } };
}

function setSide(state: TableState, actor: Member, side: "heroes" | "trouble", ctx: ActionContext): TableState {
  assertGm(state, actor);
  return withLog(
    { ...state, table: { ...state.table, sideFirst: side } },
    ctx,
    "note",
    side === "heroes" ? "The heroes go first." : "Trouble goes first.",
  );
}

function moveTurn(state: TableState, actor: Member, characterId: string, direction: -1 | 1): TableState {
  const character = requireCharacter(state, characterId);
  if (!character.seated) throw new RuleError(`${character.name} isn't seated.`);
  const canMove = isGm(state, actor) || character.ownerId === actor.id || !isClaimed(character);
  if (!canMove) throw new RuleError("Players reorder themselves. The GM can reorder anyone.");
  const order = syncOrder(state).table.turnOrder;
  const index = order.indexOf(characterId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return syncOrder(state);
  const swapped = [...order];
  const [moved] = swapped.splice(index, 1);
  swapped.splice(nextIndex, 0, moved);
  return { ...state, table: { ...state.table, turnOrder: swapped } };
}

function applyHarm(
  state: TableState,
  actor: Member,
  action: Extract<Action, { type: "applyHarm" }>,
  ctx: ActionContext,
): TableState {
  const amount = Math.max(0, Math.floor(action.amount));
  if (action.target.kind === "foe") {
    const foe = state.foes.find((item) => item.id === action.target.id);
    if (!foe) throw new RuleError("That foe isn't in the scene.");
    const hp =
      action.direction === "heal"
        ? Math.min(foe.hpMax, foe.hp + amount)
        : Math.max(0, foe.hp - amount);
    const foes = state.foes.map((item) =>
      item.id === foe.id
        ? { ...item, hp, energyShield: action.breakShield ? false : item.energyShield }
        : item,
    );
    return withLog({ ...state, foes }, ctx, "damage", action.summary);
  }
  const character = requireCharacter(state, action.target.id);
  if (action.onlySeated && !character.seated) {
    throw new RuleError("Trouble only reaches heroes who are seated.");
  }
  assertCanEdit(state, actor, character);
  const hp =
    action.direction === "heal"
      ? Math.min(character.hpMax, character.hp + amount)
      : Math.max(0, character.hp - amount);
  return withLog(
    mapCharacter(state, character.id, (current) => ({
      ...current,
      hp,
      energyShield: action.breakShield ? false : current.energyShield,
    })),
    ctx,
    "damage",
    action.summary,
  );
}

function grantCover(state: TableState, actor: Member, characterIds: string[], tempAc: number, ctx: ActionContext): TableState {
  const amount = Math.max(0, Math.floor(tempAc));
  const wanted = new Set(characterIds);
  const covered: string[] = [];
  for (const character of state.characters) {
    if (!wanted.has(character.id) || !character.seated) continue;
    assertCanEdit(state, actor, character);
  }
  const characters = state.characters.map((character) => {
    if (!wanted.has(character.id) || !character.seated) return character;
    covered.push(character.name);
    return { ...character, tempAc: Math.max(character.tempAc, amount) };
  });
  if (covered.length === 0) throw new RuleError("That cover only lands on someone seated.");
  return withLog(
    { ...state, characters },
    ctx,
    "spell",
    `+${amount} AC for ${covered.join(", ")}. A rest clears it.`,
  );
}

function spendManaAction(state: TableState, actor: Member, characterId: string, amount: number): TableState {
  const character = requireCharacter(state, characterId);
  assertCanEdit(state, actor, character);
  const spent = spendMana(character.mana, amount);
  if (!spent.ok) throw new RuleError(`${character.name} doesn't have ${amount} mana.`);
  return mapCharacter(state, characterId, (current) => ({ ...current, mana: spent.mana }));
}

function spendHero(
  state: TableState,
  actor: Member,
  characterId: string,
  reason: "reroll" | "plus4" | "narrative",
  ctx: ActionContext,
): TableState {
  const character = requireCharacter(state, characterId);
  if (character.concealed || (character.ownerId && character.ownerId !== actor.id)) {
    throw new RuleError("Hero points are the player's to spend.");
  }
  let nextPoints: number;
  try {
    nextPoints = spendHeroPoint(character.heroPoints);
  } catch {
    throw new RuleError(`${character.name} has no hero points.`);
  }
  const verb =
    reason === "reroll" ? "reroll a d12" : reason === "plus4" ? "add +4 after the d12" : "a narrative beat";
  return withLog(
    mapCharacter(state, characterId, (current) => ({ ...current, heroPoints: nextPoints })),
    ctx,
    "hero",
    `${character.name} spends a hero point: ${verb}. ${nextPoints} left.`,
  );
}

function awardHero(state: TableState, actor: Member, characterId: string, ctx: ActionContext): TableState {
  assertGm(state, actor);
  const character = requireCharacter(state, characterId);
  if (character.heroPoints >= HERO_CAP) throw new RuleError("Hero points cap at 8.");
  const heroPoints = awardHeroPoint(character.heroPoints);
  return withLog(
    mapCharacter(state, characterId, (current) => ({ ...current, heroPoints })),
    ctx,
    "hero",
    `${character.name} is awarded a hero point. ${heroPoints} now.`,
  );
}

function advance(state: TableState, actor: Member, characterId: string, text: string, ctx: ActionContext): TableState {
  const character = requireCharacter(state, characterId);
  assertCanEdit(state, actor, character);
  const clean = text.trim();
  if (!clean) throw new RuleError("Write what changed.");
  return withLog(state, ctx, "advance", `${character.name}: ${clean}`);
}

function normalizeCharacter(character: Character): Character {
  const hpMax = Math.max(1, Math.floor(character.hpMax));
  const arcana = Math.floor(character.arcana);
  const manaMax = manaMaximum(arcana);
  let charisma = Math.floor(character.charisma);
  let ac = Math.floor(character.ac);
  let suit = character.suit;
  if (suit) {
    charisma = suit.on ? suit.onCha : suit.offCha;
    ac = suit.on ? suit.onAc : suit.offAc;
    suit = {
      on: suit.on,
      onCha: Math.floor(suit.onCha),
      offCha: Math.floor(suit.offCha),
      onAc: Math.floor(suit.onAc),
      offAc: Math.floor(suit.offAc),
    };
  }
  return {
    ...character,
    charisma,
    strength: Math.floor(character.strength),
    combat: Math.floor(character.combat),
    arcana,
    hpMax,
    hp: clamp(Math.floor(character.hp), 0, hpMax),
    mana: clamp(Math.floor(character.mana), 0, manaMax),
    ac,
    tempAc: Math.max(0, Math.floor(character.tempAc)),
    heroPoints: clamp(Math.floor(character.heroPoints), 0, HERO_CAP),
    suit,
    tags: character.tags.slice(0, 5),
  };
}

function syncOrder(state: TableState): TableState {
  const seated = state.characters.filter((character) => character.seated).map((character) => character.id);
  const seatedSet = new Set(seated);
  const kept = state.table.turnOrder.filter((id) => seatedSet.has(id));
  for (const id of seated) {
    if (!kept.includes(id)) kept.push(id);
  }
  return { ...state, table: { ...state.table, turnOrder: kept } };
}

function mapCharacter(state: TableState, characterId: string, update: (character: Character) => Character): TableState {
  return {
    ...state,
    characters: state.characters.map((character) => (character.id === characterId ? update(character) : character)),
  };
}

function withLog(state: TableState, ctx: ActionContext & { sessionId?: string }, kind: LogKind, summary: string): TableState {
  const entry: LogEntry = {
    id: takeId(ctx),
    sessionId: ctx.sessionId ?? state.table.sessionId,
    at: ctx.now ?? new Date().toISOString(),
    actorId: ctx.actorId,
    actorName: state.members.find((member) => member.id === ctx.actorId)?.displayName ?? "Table",
    kind,
    summary,
  };
  return { ...state, log: [...state.log, entry] };
}

function requireMember(state: TableState, actorId: string): Member {
  const member = state.members.find((item) => item.id === actorId);
  if (!member) throw new RuleError("Join the table first.");
  return member;
}

function requireCharacter(state: TableState, characterId: string): Character {
  const character = state.characters.find((item) => item.id === characterId);
  if (!character) throw new RuleError("That character isn't at this table.");
  return character;
}

function assertCanEdit(state: TableState, actor: Member, character: Character): void {
  if (character.concealed) throw new RuleError(`${character.name}'s sheet is private.`);
  if (isGm(state, actor)) return;
  if (character.ownerId === actor.id) return;
  throw new RuleError(`${character.name} is played by someone else.`);
}

function assertGm(state: TableState, actor: Member): void {
  if (!isGm(state, actor)) throw new RuleError("That belongs to the GM tonight.");
}

function isGm(state: TableState, actor: Member): boolean {
  return state.table.currentGmId === actor.id;
}

function takeId(ctx: ActionContext): string {
  return ctx.id ? ctx.id() : crypto.randomUUID();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
