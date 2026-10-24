import { createBrowserClient } from "@supabase/ssr";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { friendlySendError, prepareBrowserLocation, type AuthCallbackClient } from "../auth/callback";
import { createEmailLinkClient, verifyEmailCode } from "../auth/email-link";
import { companyForTable } from "../data/company";
import type { Action, Character, Foe, LogEntry, Member, TableState } from "../model";
import { RuleError } from "../rules/errors";
import { exportTable, parseCodexFile } from "../table/export";
import { present } from "../table/present";
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
  sheet: Omit<Character, "id" | "ownerId" | "seated">;
};

type FoeRow = { id: string; table_id: string; foe: Omit<Foe, "id"> };
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

function characterFromRow(row: CharacterRow): Character {
  return { ...row.sheet, id: row.id, ownerId: row.owner_id, seated: row.seated };
}

function characterToRow(tableId: string, character: Character): CharacterRow {
  const { id, ownerId, seated, ...sheet } = character;
  return { id, table_id: tableId, owner_id: ownerId, seated, sheet };
}

async function loadFull(code: string): Promise<TableState | null> {
  const supabase = getSupabase();
  const { data: table, error } = await supabase.from("tables").select("*").eq("code", code.toUpperCase()).maybeSingle();
  fail(error);
  if (!table) return null;
  const row = table as TableRow;
  const [members, characters, foes, logs, notes] = await Promise.all([
    supabase.from("table_members").select("profile_id, profiles(display_name, email)").eq("table_id", row.id),
    supabase.from("characters").select("*").eq("table_id", row.id),
    supabase.from("foes").select("*").eq("table_id", row.id),
    supabase.from("log_entries").select("*").eq("table_id", row.id).order("created_at", { ascending: true }),
    supabase.from("gm_notes").select("body").eq("table_id", row.id).maybeSingle(),
  ]);
  fail(members.error);
  fail(characters.error);
  fail(foes.error);
  fail(logs.error);
  if (notes.error && notes.error.code !== "PGRST116") fail(notes.error);

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
    characters: ((characters.data ?? []) as CharacterRow[]).map(characterFromRow),
    foes: ((foes.data ?? []) as FoeRow[]).map((foe) => ({ ...foe.foe, id: foe.id })),
    log: ((logs.data ?? []) as LogRow[]).map((entry) => entry.entry),
  };
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
  await diffLog(prev, next);
}

async function diffCharacters(prev: TableState, next: TableState): Promise<void> {
  const supabase = getSupabase();
  const before = new Map(prev.characters.map((character) => [character.id, character]));
  for (const character of next.characters) {
    const old = before.get(character.id);
    const row = characterToRow(next.table.id, character);
    if (!old) {
      const { error } = await supabase.from("characters").insert({ ...row, updated_at: new Date().toISOString() });
      fail(error);
    } else if (JSON.stringify(old) !== JSON.stringify(character)) {
      const { error } = await supabase
        .from("characters")
        .update({ owner_id: row.owner_id, seated: row.seated, sheet: row.sheet, updated_at: new Date().toISOString() })
        .eq("id", character.id);
      fail(error);
    }
    before.delete(character.id);
  }
  for (const leftover of before.values()) {
    const { error } = await supabase.from("characters").delete().eq("id", leftover.id);
    fail(error);
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
      const { data, error } = await getSupabase().from("tables").select("code, name").order("created_at", { ascending: false });
      fail(error);
      return (data ?? []) as { code: string; name: string }[];
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
        const { error: orderError } = await getSupabase().rpc("save_table_meta", {
          p_table_id: tableId,
          p_scene: scene,
          p_side: null,
          p_turn: characters.map((character) => character.id),
          p_session_active: false,
          p_session_id: null,
          p_current_gm: null,
          p_eligible: [viewer.id],
        });
        fail(orderError);
      }
      return code;
    },
    async join(code: string) {
      const { error } = await getSupabase().rpc("join_table", { p_code: code.toUpperCase() });
      fail(error);
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
        .on("postgres_changes", { event: "*", schema: "public", table: "foes", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "log_entries", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "gm_notes", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "table_members", filter: `table_id=eq.${tableId}` }, listener)
        .on("postgres_changes", { event: "*", schema: "public", table: "tables", filter: `id=eq.${tableId}` }, listener)
        .subscribe();
      return () => {
        void getSupabase().removeChannel(channel);
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
      const fresh = await loadFull(code);
      return present(fresh ?? next, viewer.id);
    },
    async exportJson(code: string, viewerId: string | null) {
      const full = await loadFull(code);
      if (!full) throw new RuleError("No table uses that code.");
      const include = Boolean(viewerId && full.table.currentGmId === viewerId);
      return exportTable(include ? full : present(full, null), include);
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
