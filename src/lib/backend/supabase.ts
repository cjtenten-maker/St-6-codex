import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { friendlySendError, prepareBrowserLocation, type AuthCallbackClient } from "../auth/callback";
import { createEmailLinkClient, verifyEmailCode } from "../auth/email-link";
import { companyForTable } from "../data/company";
import { sampleLibraryFresh } from "../data/trouble";
import type { Action, Character, Foe, LogEntry, Member, TableState, Trouble, TroubleFolder } from "../model";
import { RuleError } from "../rules/errors";
import { exportTable, parseCodexFile } from "../table/export";
import { LIBRARY_WAITING, libraryOf } from "../table/library";
import { characterArtObjectNames, downscalePortrait, portraitObjectName, type ArtBucket } from "../portrait";
import { characterFromCard, present } from "../table/present";
import { applyAction } from "../table/reducer";
import type { Viewer } from "./local";

type TableRow = {
  id: string;
  code: string;
  name: string;
  created_by: string;
  current_gm_id: string | null;
  gm_eligible_ids: string[] | null;
  scene_note: string | null;
  side_first: "heroes" | "trouble" | null;
  turn_order: string[] | null;
  session_active: boolean;
  session_id: string | null;
};

type CharacterRow = {
  id: string;
  table_id: string;
  owner_id: string | null;
  seated: boolean;
  portrait_path: string | null;
  sheet: Omit<Character, "id" | "ownerId" | "seated" | "portraitPath" | "concealed" | "claimed" | "down">;
};

type CardRow = {
  id: string;
  name: string;
  seated: boolean;
  down: boolean;
  claimed: boolean;
  portrait_path: string | null;
};

type FoeRow = { id: string; table_id: string; foe: Omit<Foe, "id"> };
type FolderRow = { id: string; name: string; sort: number };
type TroubleRow = {
  id: string;
  folder_id: string | null;
  name: string;
  hp: number;
  ac: number;
  attack_bonus: number;
  damage: string;
  abilities: string;
  notes: string;
  energy_shield: boolean;
  ignore_ac: number | null;
  portrait_path: string | null;
  sort: number;
};
type LogRow = { id: string; table_id: string; session_id: string | null; entry: LogEntry };
type MemberRow = { profile_id: string; profiles: { display_name: string; email: string | null } | { display_name: string; email: string | null }[] | null };

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) throw new RuleError("Supabase isn't configured.");
  if (!client) {
    if (typeof window !== "undefined") {
      prepareBrowserLocation(window.location.href, (next) => {
        window.history.replaceState(window.history.state, "", next);
      });
    }
    client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  }
  return client;
}

export function authCallbackClient(): AuthCallbackClient {
  const auth = getSupabase().auth;
  return {
    async setSession(tokens) {
      const { error } = await auth.setSession(tokens);
      return { error: error ? { message: error.message, code: error.code } : null };
    },
    async exchangeCodeForSession(code, flowId) {
      const { error } = await auth.exchangeCodeForSession(code, flowId ? { flowId } : undefined);
      return { error: error ? { message: error.message, code: error.code } : null };
    },
    async verifyOtp(args) {
      const { error } = await auth.verifyOtp({ token_hash: args.token_hash, type: args.type as EmailOtpType });
      return { error: error ? { message: error.message, code: error.code } : null };
    },
  };
}

function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

function fail(error: { message: string } | null): void {
  if (error) throw new RuleError(error.message);
}

/** PostgREST reports a table the migration has not created yet. */
export function isMissingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /schema cache|could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

export function isMissingClaimRpc(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST202") return true;
  return /could not find the function/i.test(error.message ?? "") && /claim_character/i.test(error.message ?? "");
}

/** The character-art trigger deletes storage.objects, which Supabase rejects. */
export function isStorageTriggerBlock(error: { message?: string } | null): boolean {
  return /protect_delete|storage\.objects|delete_character_art/i.test(error?.message ?? "");
}

const CLAIM_MIGRATION = "Claiming needs supabase/migrations/004_claim_and_character_art.sql.";
const DELETE_MIGRATION = "Deleting a character needs supabase/migrations/004_claim_and_character_art.sql. The character is still at the table.";
const DUPLICATE_NAME = "That name is already at this table. Claim that sheet instead of adding another.";

function characterFromRow(row: CharacterRow): Character {
  const sheet = { ...(row.sheet as Character) };
  delete sheet.concealed;
  delete sheet.claimed;
  delete sheet.down;
  delete sheet.portraitPath;
  return {
    ...sheet,
    id: row.id,
    ownerId: row.owner_id,
    seated: row.seated,
    portraitPath: row.portrait_path ?? null,
    concealed: false,
  };
}

function characterToRow(tableId: string, character: Character): CharacterRow {
  const { id, ownerId, seated, portraitPath, concealed, claimed, down, ...sheet } = character;
  void concealed;
  void claimed;
  void down;
  return { id, table_id: tableId, owner_id: ownerId, seated, portrait_path: portraitPath ?? null, sheet };
}

function troubleFromRow(row: TroubleRow): Trouble {
  return {
    id: row.id,
    folderId: row.folder_id,
    name: row.name,
    hp: row.hp,
    ac: row.ac,
    attackBonus: row.attack_bonus,
    damage: row.damage,
    abilities: row.abilities ?? "",
    notes: row.notes ?? "",
    energyShield: row.energy_shield,
    ignoreAc: row.ignore_ac ?? undefined,
    portraitPath: row.portrait_path,
    sort: row.sort ?? 0,
  };
}

function troubleToRow(tableId: string, trouble: Trouble) {
  return {
    id: trouble.id,
    table_id: tableId,
    folder_id: trouble.folderId,
    name: trouble.name,
    hp: trouble.hp,
    ac: trouble.ac,
    attack_bonus: trouble.attackBonus,
    damage: trouble.damage,
    abilities: trouble.abilities,
    notes: trouble.notes,
    energy_shield: trouble.energyShield,
    ignore_ac: trouble.ignoreAc ?? null,
    portrait_path: trouble.portraitPath && !trouble.portraitPath.startsWith("data:") ? trouble.portraitPath : null,
    sort: trouble.sort,
  };
}

function folderToRow(tableId: string, folder: TroubleFolder) {
  return { id: folder.id, table_id: tableId, name: folder.name, sort: folder.sort };
}

async function loadFull(code: string): Promise<TableState | null> {
  const supabase = getSupabase();
  const { data: table, error } = await supabase.from("tables").select("*").eq("code", code.toUpperCase()).maybeSingle();
  fail(error);
  if (!table) return null;
  const row = table as TableRow;
  const [members, characters, cards, foes, logs, notes, folders, trouble] = await Promise.all([
    supabase.from("table_members").select("profile_id, profiles(display_name, email)").eq("table_id", row.id),
    supabase.from("characters").select("*").eq("table_id", row.id),
    supabase.from("character_cards").select("id, name, seated, down, claimed, portrait_path").eq("table_id", row.id),
    supabase.from("foes").select("*").eq("table_id", row.id),
    supabase.from("log_entries").select("*").eq("table_id", row.id).order("created_at", { ascending: true }),
    supabase.from("gm_notes").select("body").eq("table_id", row.id).maybeSingle(),
    supabase.from("trouble_folders").select("id, name, sort").eq("table_id", row.id).order("sort"),
    supabase.from("trouble").select("*").eq("table_id", row.id).order("sort"),
  ]);
  fail(members.error);
  fail(characters.error);
  if (cards.error) {
    if (cards.error.code === "PGRST205" || /character_cards/i.test(cards.error.message)) {
      throw new RuleError("Character privacy isn't on this database yet. Apply supabase/migrations/002_character_privacy.sql.");
    }
    fail(cards.error);
  }
  fail(foes.error);
  fail(logs.error);
  if (notes.error && notes.error.code !== "PGRST116") fail(notes.error);
  const libraryMissing = isMissingRelation(folders.error) || isMissingRelation(trouble.error);
  if (!libraryMissing) {
    fail(folders.error);
    fail(trouble.error);
  }

  return {
    table: {
      id: row.id,
      code: row.code,
      name: row.name,
      createdBy: row.created_by,
      currentGmId: row.current_gm_id,
      gmEligibleIds: row.gm_eligible_ids ?? [],
      sceneNote: row.scene_note ?? "",
      sideFirst: row.side_first,
      turnOrder: row.turn_order ?? [],
      sessionActive: row.session_active,
      sessionId: row.session_id,
      gmNotes: (notes.data as { body?: string } | null)?.body ?? "",
    },
    members: ((members.data ?? []) as MemberRow[]).map((member) => {
      const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
      return {
        id: member.profile_id,
        displayName: profile?.display_name ?? "Player",
        email: profile?.email ?? "",
      };
    }),
    characters: mergeCharacters((characters.data ?? []) as CharacterRow[], (cards.data ?? []) as CardRow[]),
    foes: ((foes.data ?? []) as FoeRow[]).map((foe) => ({ ...foe.foe, id: foe.id })),
    trouble: libraryMissing ? [] : ((trouble.data ?? []) as TroubleRow[]).map(troubleFromRow),
    troubleFolders: libraryMissing
      ? []
      : ((folders.data ?? []) as FolderRow[]).map((folder) => ({ id: folder.id, name: folder.name, sort: folder.sort })),
    troubleReady: !libraryMissing,
    log: ((logs.data ?? []) as LogRow[]).map((entry) => entry.entry),
  };
}

function mergeCharacters(rows: CharacterRow[], cards: CardRow[]): Character[] {
  const full = new Map(rows.map((row) => [row.id, characterFromRow(row)]));
  const seen = new Set<string>();
  const characters: Character[] = [];
  for (const card of cards) {
    seen.add(card.id);
    const secret = full.get(card.id);
    characters.push(
      secret
        ? { ...secret, portraitPath: secret.portraitPath ?? card.portrait_path }
        : characterFromCard({
            id: card.id,
            name: card.name,
            seated: card.seated,
            down: card.down,
            claimed: card.claimed,
            portraitPath: card.portrait_path,
          }),
    );
  }
  for (const secret of full.values()) {
    if (!seen.has(secret.id)) characters.push(secret);
  }
  return characters;
}

async function persistDiff(prev: TableState, next: TableState): Promise<void> {
  const supabase = getSupabase();
  const metaChanged =
    prev.table.sceneNote !== next.table.sceneNote ||
    prev.table.sideFirst !== next.table.sideFirst ||
    prev.table.sessionActive !== next.table.sessionActive ||
    prev.table.sessionId !== next.table.sessionId ||
    prev.table.currentGmId !== next.table.currentGmId ||
    JSON.stringify(prev.table.gmEligibleIds) !== JSON.stringify(next.table.gmEligibleIds) ||
    JSON.stringify(prev.table.turnOrder) !== JSON.stringify(next.table.turnOrder);

  if (metaChanged) {
    const { error } = await supabase.rpc("save_table_meta", {
      p_table_id: next.table.id,
      p_scene: next.table.sceneNote,
      p_side: next.table.sideFirst,
      p_turn: next.table.turnOrder,
      p_session_active: next.table.sessionActive,
      p_session_id: next.table.sessionId,
      p_current_gm: next.table.currentGmId,
      p_eligible: next.table.gmEligibleIds,
    });
    fail(error);
  }

  if (prev.table.gmNotes !== next.table.gmNotes) {
    const { error } = await supabase
      .from("gm_notes")
      .update({ body: next.table.gmNotes, updated_at: new Date().toISOString() })
      .eq("table_id", next.table.id);
    fail(error);
  }

  await diffCharacters(prev, next);
  await diffFoes(prev, next);
  await diffLibrary(prev, next);
  await diffLog(prev, next);
}

async function diffLibrary(prev: TableState, next: TableState): Promise<void> {
  if (prev.troubleReady === false || next.troubleReady === false) {
    if (JSON.stringify(libraryOf(prev)) !== JSON.stringify(libraryOf(next))) throw new RuleError(LIBRARY_WAITING);
    return;
  }
  const before = libraryOf(prev);
  const after = libraryOf(next);
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  const supabase = getSupabase();
  const tableId = next.table.id;

  const seenFolders = new Map(before.troubleFolders.map((folder) => [folder.id, folder]));
  for (const folder of after.troubleFolders) {
    const old = seenFolders.get(folder.id);
    if (!old) {
      const { error } = await supabase.from("trouble_folders").insert(folderToRow(tableId, folder));
      if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
      fail(error);
    } else if (old.name !== folder.name || old.sort !== folder.sort) {
      const { error } = await supabase.from("trouble_folders").update({ name: folder.name, sort: folder.sort }).eq("id", folder.id);
      if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
      fail(error);
    }
    seenFolders.delete(folder.id);
  }

  const seenTrouble = new Map(before.trouble.map((item) => [item.id, item]));
  for (const item of after.trouble) {
    const old = seenTrouble.get(item.id);
    const row = troubleToRow(tableId, item);
    if (!old) {
      const { error } = await supabase.from("trouble").insert(row);
      if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
      fail(error);
    } else if (JSON.stringify(troubleToRow(tableId, old)) !== JSON.stringify(row)) {
      const { id, table_id, ...patch } = row;
      void table_id;
      const { error } = await supabase.from("trouble").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
      fail(error);
    }
    seenTrouble.delete(item.id);
  }
  for (const leftover of seenTrouble.values()) {
    const { error } = await supabase.from("trouble").delete().eq("id", leftover.id);
    if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
    fail(error);
  }
  for (const leftover of seenFolders.values()) {
    const { error } = await supabase.from("trouble_folders").delete().eq("id", leftover.id);
    if (isMissingRelation(error)) throw new RuleError(LIBRARY_WAITING);
    fail(error);
  }
}

async function claimExistingCharacter(characterId: string): Promise<void> {
  const { error } = await getSupabase().rpc("claim_character", { p_character_id: characterId });
  if (isMissingClaimRpc(error)) throw new RuleError(CLAIM_MIGRATION);
  fail(error);
}

async function listCharacterArt(tableId: string, character: Character): Promise<string[]> {
  const folder = `${tableId}/${character.id}`;
  const listed = await getSupabase().storage.from("character-art").list(folder, { limit: 100 });
  const files = listed.error ? [] : (listed.data ?? []).map((file) => file.name);
  return characterArtObjectNames(tableId, character.id, character.portraitPath, files);
}

async function deleteCharacterRow(tableId: string, character: Character): Promise<void> {
  const art = await listCharacterArt(tableId, character);
  const { data, error } = await getSupabase().from("characters").delete().eq("id", character.id).select("id");
  if (isStorageTriggerBlock(error)) throw new RuleError(DELETE_MIGRATION);
  fail(error);
  if (!data?.length) throw new RuleError("That character didn't leave the table.");
  if (art.length === 0) return;
  const { error: storageError } = await getSupabase().storage.from("character-art").remove(art);
  fail(storageError);
}

async function diffCharacters(prev: TableState, next: TableState): Promise<void> {
  const supabase = getSupabase();
  const before = new Map(prev.characters.map((character) => [character.id, character]));
  for (const character of next.characters) {
    const old = before.get(character.id);
    const row = characterToRow(next.table.id, character);
    if (character.concealed) {
      // The stub has an empty sheet. Never insert a second row, and never write that sheet.
      if (!old) throw new RuleError("That character isn't at this table.");
      if (character.ownerId && character.ownerId !== old.ownerId) {
        await claimExistingCharacter(character.id);
      }
      before.delete(character.id);
      continue;
    }
    if (!old) {
      const { error } = await supabase.from("characters").insert({ ...row, updated_at: new Date().toISOString() });
      if (error?.code === "23505" || /characters_one_name_per_table/i.test(error?.message ?? "")) {
        throw new RuleError(DUPLICATE_NAME);
      }
      fail(error);
    } else if (old.concealed) {
      if (row.owner_id && row.owner_id !== old.ownerId) await claimExistingCharacter(character.id);
    } else if (JSON.stringify(characterToRow(next.table.id, old)) !== JSON.stringify(row)) {
      const { data, error } = await supabase
        .from("characters")
        .update({
          owner_id: row.owner_id,
          seated: row.seated,
          portrait_path: row.portrait_path,
          sheet: row.sheet,
          updated_at: new Date().toISOString(),
        })
        .eq("id", character.id)
        .select("id");
      fail(error);
      if (!data?.length) throw new RuleError("That sheet didn't save.");
    }
    before.delete(character.id);
  }
  for (const leftover of before.values()) {
    if (leftover.concealed) continue;
    await deleteCharacterRow(next.table.id, leftover);
  }
}

async function diffFoes(prev: TableState, next: TableState): Promise<void> {
  const supabase = getSupabase();
  const before = new Map(prev.foes.map((foe) => [foe.id, foe]));
  for (const foe of next.foes) {
    const { id, ...body } = foe;
    const old = before.get(id);
    if (!old) {
      const { error } = await supabase.from("foes").insert({ id, table_id: next.table.id, foe: body });
      fail(error);
    } else if (JSON.stringify(old) !== JSON.stringify(foe)) {
      const { error } = await supabase.from("foes").update({ foe: body }).eq("id", id);
      fail(error);
    }
    before.delete(id);
  }
  for (const leftover of before.values()) {
    const { error } = await supabase.from("foes").delete().eq("id", leftover.id);
    fail(error);
  }
}

async function diffLog(prev: TableState, next: TableState): Promise<void> {
  const supabase = getSupabase();
  const seen = new Set(prev.log.map((entry) => entry.id));
  const fresh = next.log.filter((entry) => !seen.has(entry.id));
  if (fresh.length === 0) return;
  const { error } = await supabase.from("log_entries").insert(
    fresh.map((entry) => ({
      id: entry.id,
      table_id: next.table.id,
      session_id: entry.sessionId,
      entry,
    })),
  );
  fail(error);
}

async function writeLibrary(tableId: string, folders: TroubleFolder[], trouble: Trouble[]): Promise<void> {
  const supabase = getSupabase();
  if (folders.length) {
    const { error } = await supabase.from("trouble_folders").insert(folders.map((folder) => folderToRow(tableId, folder)));
    if (isMissingRelation(error)) return;
    fail(error);
  }
  if (!trouble.length) return;
  const { error } = await supabase.from("trouble").insert(trouble.map((item) => troubleToRow(tableId, { ...item, portraitPath: null })));
  if (isMissingRelation(error)) return;
  fail(error);
}

async function seedTroubleLibrary(tableId: string): Promise<void> {
  const library = sampleLibraryFresh();
  await writeLibrary(tableId, library.troubleFolders, library.trouble);
}

async function importTroubleLibrary(tableId: string, state: TableState): Promise<void> {
  const library = libraryOf(state);
  if (!library.trouble.length && !library.troubleFolders.length) return;
  const folderIds = new Map(library.troubleFolders.map((folder) => [folder.id, crypto.randomUUID()]));
  const folders = library.troubleFolders.map((folder) => ({ ...folder, id: folderIds.get(folder.id) ?? crypto.randomUUID() }));
  const trouble = library.trouble.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    folderId: item.folderId ? (folderIds.get(item.folderId) ?? null) : null,
    portraitPath: null,
  }));
  await writeLibrary(tableId, folders, trouble);
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function createSupabaseApi() {
  return {
    mode: "supabase" as const,
    async getViewer(): Promise<Viewer | null> {
      const supabase = getSupabase();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const fallback =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email?.split("@")[0] ||
        "Player";
      const { data: profile } = await supabase.from("profiles").select("display_name, email").eq("id", user.id).maybeSingle();
      if (!profile) {
        await supabase.from("profiles").upsert({ id: user.id, email: user.email, display_name: fallback });
      }
      return {
        id: user.id,
        email: user.email ?? "",
        displayName: (profile?.display_name as string | undefined) || fallback,
      };
    },
    onAuth(listener: (viewer: Viewer | null) => void) {
      const supabase = getSupabase();
      const { data } = supabase.auth.onAuthStateChange(() => {
        void this.getViewer().then(listener);
      });
      return () => data.subscription.unsubscribe();
    },
    async signInEmail(email: string) {
      const clean = email.trim();
      if (!clean.includes("@")) throw new RuleError("That doesn't look like an email.");
      try {
        sessionStorage.setItem("st6-auth-email", clean);
      } catch {
        // Private mode can refuse storage. The link still sends.
      }
      const link = createEmailLinkClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { error } = await link.auth.signInWithOtp({
        email: clean,
        options: { emailRedirectTo: `${siteUrl()}/auth/callback`, shouldCreateUser: true },
      });
      if (error) throw new RuleError(friendlySendError(error.message));
    },
    async signInWithCode(email: string, token: string) {
      const cleanEmail = email.trim();
      const cleanToken = token.replace(/\s+/g, "");
      if (!cleanEmail.includes("@")) throw new RuleError("That doesn't look like an email.");
      if (!/^\d{6,10}$/.test(cleanToken)) throw new RuleError("Enter the digits from the email.");
      const auth = getSupabase().auth;
      try {
        await verifyEmailCode(
          async (args) => {
            const { error } = await auth.verifyOtp(args);
            return { error: error ? { message: error.message, code: error.code } : null };
          },
          cleanEmail,
          cleanToken,
        );
      } catch (error) {
        throw new RuleError(error instanceof Error ? error.message : friendlySendError(""));
      }
    },
    async signInGoogle() {
      const { error } = await getSupabase().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${siteUrl()}/auth/callback` },
      });
      fail(error);
    },
    async signOut() {
      const { error } = await getSupabase().auth.signOut();
      fail(error);
    },
    async updateName(name: string) {
      const viewer = await this.getViewer();
      if (!viewer) throw new RuleError("Sign in first.");
      const clean = name.trim();
      if (!clean) throw new RuleError("The table needs a name for you.");
      const { error } = await getSupabase().from("profiles").update({ display_name: clean }).eq("id", viewer.id);
      fail(error);
    },
    async listTables() {
      const supabase = getSupabase();
      const { data, error } = await supabase.from("tables").select("code, name, created_by").order("created_at", { ascending: false });
      fail(error);
      const rows = (data ?? []) as { code: string; name: string; created_by: string }[];
      const ids = [...new Set(rows.map((row) => row.created_by).filter(Boolean))];
      const names = new Map<string, string>();
      if (ids.length) {
        const profiles = await supabase.from("profiles").select("id, display_name").in("id", ids);
        fail(profiles.error);
        for (const profile of (profiles.data ?? []) as { id: string; display_name: string }[]) {
          names.set(profile.id, profile.display_name);
        }
      }
      return rows.map((row) => ({
        code: row.code,
        name: row.name,
        creatorName: names.get(row.created_by) ?? "someone who left",
      }));
    },
    async createTable(name: string, seed: boolean) {
      const viewer = await this.getViewer();
      if (!viewer) throw new RuleError("Sign in first.");
      const clean = name.trim();
      if (!clean) throw new RuleError("Give the table a name.");
      const code = makeCode();
      const scene = seed ? "The company from the sheets is seated. Someone taps I'm GM tonight." : "";
      const notes = seed ? "Notes you write here stay with the screen. The next GM inherits them." : "";
      const { data, error } = await getSupabase().rpc("create_table", {
        p_name: clean,
        p_code: code,
        p_scene: scene,
        p_notes: notes,
      });
      fail(error);
      const tableId = data as string;
      if (seed) {
        const characters = companyForTable();
        const { error: insertError } = await getSupabase()
          .from("characters")
          .insert(characters.map((character) => characterToRow(tableId, character)));
        fail(insertError);
        const turn = characters.map((character) => character.id);
        const meta = (currentGm: string | null) =>
          getSupabase().rpc("save_table_meta", {
            p_table_id: tableId,
            p_scene: scene,
            p_side: null,
            p_turn: turn,
            p_session_active: false,
            p_session_id: null,
            p_current_gm: currentGm,
            p_eligible: [viewer.id],
          });
        const { error: holdError } = await meta(viewer.id);
        fail(holdError);
        let seedError: unknown = null;
        try {
          await seedTroubleLibrary(tableId);
        } catch (error) {
          seedError = error;
        }
        const { error: releaseError } = await meta(null);
        fail(releaseError);
        if (seedError) throw seedError;
      }
      return code;
    },
    async join(code: string) {
      const { error } = await getSupabase().rpc("join_table", { p_code: code.toUpperCase() });
      fail(error);
    },
    async portraitUrl(path: string, bucket: ArtBucket = "character-art") {
      if (path.startsWith("data:")) return path;
      const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, 60 * 60);
      fail(error);
      if (!data?.signedUrl) throw new RuleError("That picture didn't load.");
      return data.signedUrl;
    },
    async setTroubleArt(code: string, troubleId: string, file: File | null) {
      const viewer = await this.getViewer();
      if (!viewer) throw new RuleError("Sign in first.");
      const full = await loadFull(code);
      if (!full) throw new RuleError("No table uses that code.");
      if (full.troubleReady === false) throw new RuleError(LIBRARY_WAITING);
      if (full.table.currentGmId !== viewer.id) throw new RuleError("That belongs to the GM tonight.");
      const trouble = full.trouble.find((item) => item.id === troubleId);
      if (!trouble) throw new RuleError("Save the trouble before adding a picture.");
      const previous = trouble.portraitPath && !trouble.portraitPath.startsWith("data:") ? trouble.portraitPath : null;
      let portraitPath: string | null = null;
      if (file) {
        const blob = await downscalePortrait(file);
        portraitPath = portraitObjectName(full.table.id, trouble.id);
        const { error } = await getSupabase().storage.from("trouble-art").upload(portraitPath, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
        fail(error);
      }
      const next = await this.dispatch(code, { type: "setTroubleArt", troubleId, portraitPath }, viewer);
      if (previous && previous !== portraitPath) {
        await getSupabase().storage.from("trouble-art").remove([previous]);
      }
      return next;
    },
    async setPortrait(code: string, characterId: string, file: File | null) {
      const viewer = await this.getViewer();
      if (!viewer) throw new RuleError("Sign in first.");
      const full = await loadFull(code);
      if (!full) throw new RuleError("No table uses that code.");
      const character = full.characters.find((item) => item.id === characterId);
      if (!character || character.concealed) throw new RuleError("That sheet is private.");
      if (!character.ownerId) throw new RuleError("Claim the character before adding a portrait.");
      if (character.ownerId !== viewer.id && full.table.currentGmId !== viewer.id) {
        throw new RuleError("Only the player or the GM can change the portrait.");
      }
      const previous = character.portraitPath && !character.portraitPath.startsWith("data:") ? character.portraitPath : null;
      let portraitPath: string | null = null;
      if (file) {
        const blob = await downscalePortrait(file);
        portraitPath = portraitObjectName(full.table.id, character.id);
        const { error } = await getSupabase().storage.from("character-art").upload(portraitPath, blob, {
          contentType: "image/jpeg",
          cacheControl: "3600",
          upsert: false,
        });
        fail(error);
      }
      const next = await this.dispatch(code, { type: "setPortrait", characterId, portraitPath }, viewer);
      if (previous && previous !== portraitPath) {
        await getSupabase().storage.from("character-art").remove([previous]);
      }
      return next;
    },
    async load(code: string, viewerId: string | null) {
      const full = await loadFull(code);
      if (!full) return null;
      return present(full, viewerId);
    },
    subscribe(tableId: string, listener: () => void) {
      const channel = getSupabase()
        .channel(`table-${tableId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "characters", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "character_cards", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "foes", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "log_entries", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "gm_notes", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "table_members", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `id=eq.${tableId}` }, listener)
        .subscribe();
      // A separate channel so a database that has not applied migration 003
      // does not take the rest of the table's realtime with it.
      const library = getSupabase()
        .channel(`trouble-${tableId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "trouble", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "trouble_folders", filter: `table_id=eq.${tableId}` }, listener)
        .subscribe();
      return () => {
        void getSupabase().removeChannel(channel);
        void getSupabase().removeChannel(library);
      };
    },
    async dispatch(code: string, action: Action, viewer: Viewer) {
      let full = await loadFull(code);
      if (!full) throw new RuleError("No table uses that code.");
      if (!full.members.some((member) => member.id === viewer.id)) {
        await this.join(code);
        full = await loadFull(code);
        if (!full) throw new RuleError("No table uses that code.");
      }
      const base = full;
      const next =
        action.type === "join" ? base : applyAction(base, action, { actorId: viewer.id, now: new Date().toISOString() });
      await persistDiff(base, next);
      if (action.type === "claimGm") {
        const { error: sitOutError } = await getSupabase().rpc("sit_out_own_characters", { p_table_id: next.table.id });
        fail(sitOutError);
      }
      const fresh = await loadFull(code);
      return present(fresh ?? next, viewer.id);
    },
    async exportJson(code: string, viewerId: string | null) {
      const full = await loadFull(code);
      if (!full) throw new RuleError("No table uses that code.");
      const include = Boolean(viewerId && full.table.currentGmId === viewerId);
      return exportTable(include ? full : present(full, viewerId), include);
    },
    async importJson(raw: string, viewer: Viewer) {
      const file = parseCodexFile(raw);
      let code = file.state.table.code.toUpperCase();
      const scene = file.state.table.sceneNote;
      const notes = file.includeGmNotes ? file.state.table.gmNotes : "";
      let created = false;
      for (let attempt = 0; attempt < 4 && !created; attempt++) {
        const { error } = await getSupabase().rpc("create_table", {
          p_name: file.state.table.name,
          p_code: code,
          p_scene: scene,
          p_notes: notes,
        });
        if (!error) created = true;
        else if (/duplicate|already exists|unique/i.test(error.message)) code = makeCode();
        else fail(error);
      }
      if (!created) throw new RuleError("Couldn't open a table for that file.");
      const full = await loadFull(code);
      if (!full) throw new RuleError("The imported table didn't come back.");
      const characters = file.state.characters.map((character) => ({
        ...character,
        id: crypto.randomUUID(),
        ownerId: character.ownerId === viewer.id ? viewer.id : null,
      }));
      const idMap = new Map(file.state.characters.map((character, index) => [character.id, characters[index].id]));
      if (characters.length) {
        const { error } = await getSupabase()
          .from("characters")
          .insert(characters.map((character) => characterToRow(full.table.id, character)));
        fail(error);
      }
      const turn = file.state.table.turnOrder.map((id) => idMap.get(id)).filter((id): id is string => Boolean(id));
      const { error: metaError } = await getSupabase().rpc("save_table_meta", {
        p_table_id: full.table.id,
        p_scene: scene,
        p_side: null,
        p_turn: turn,
        p_session_active: false,
        p_session_id: null,
        p_current_gm: viewer.id,
        p_eligible: [viewer.id],
      });
      fail(metaError);
      if (file.state.foes.length) {
        const { error } = await getSupabase()
          .from("foes")
          .insert(file.state.foes.map((foe) => ({ id: crypto.randomUUID(), table_id: full.table.id, foe: { ...foe, id: undefined } })));
        fail(error);
      }
      if (file.includeGmNotes) await importTroubleLibrary(full.table.id, file.state);
      const { error: releaseError } = await getSupabase().rpc("save_table_meta", {
        p_table_id: full.table.id,
        p_scene: scene,
        p_side: file.state.table.sideFirst,
        p_turn: turn,
        p_session_active: false,
        p_session_id: null,
        p_current_gm: null,
        p_eligible: [viewer.id],
      });
      fail(releaseError);
      return code;
    },
  };
}

export type SupabaseApi = ReturnType<typeof createSupabaseApi>;
