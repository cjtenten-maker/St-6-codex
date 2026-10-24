import { companyForTable } from "../data/company";
import { sampleLibrary, sampleLibraryFresh } from "../data/trouble";
import { DEMO_CODE } from "../ids";
import type { Action, Member, TableState } from "../model";
import { RuleError } from "../rules/errors";
import { createDemoState } from "../table/demo";
import { exportTable, parseCodexFile } from "../table/export";
import { libraryOf } from "../table/library";
import { present } from "../table/present";
import { applyAction } from "../table/reducer";
import type { Store } from "./memory";

export type Viewer = Member;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createLocalApi(store: Store) {
  let viewer: Viewer | null = null;
  const viewerListeners = new Set<() => void>();

  function tellViewers() {
    viewerListeners.forEach((listener) => listener());
  }

  function requireViewer(): Viewer {
    if (!viewer) throw new RuleError("Pick who is holding this phone.");
    return viewer;
  }

  function writeTable(code: string, next: TableState) {
    const db = store.read();
    store.write({ tables: { ...db.tables, [code]: next } });
  }

  function hydrate(state: TableState): TableState {
    const hasLibrary = Array.isArray(state.trouble) && Array.isArray(state.troubleFolders);
    if (hasLibrary) return state;
    if (state.table.code === DEMO_CODE) {
      const library = sampleLibrary();
      return { ...state, trouble: library.trouble, troubleFolders: library.troubleFolders };
    }
    return { ...state, ...libraryOf(state) };
  }

  function readFull(code: string): TableState {
    const table = store.read().tables[code.toUpperCase()];
    if (!table) throw new RuleError("No table uses that code.");
    return hydrate(table);
  }

  return {
    mode: "local" as const,
    getViewer: () => viewer,
    setViewer(next: Viewer) {
      viewer = next;
      tellViewers();
    },
    clearViewer() {
      viewer = null;
      tellViewers();
    },
    onViewer(listener: () => void) {
      viewerListeners.add(listener);
      return () => viewerListeners.delete(listener);
    },
    subscribe: store.subscribe.bind(store),
    listTables() {
      const who = viewer?.id;
      return Object.values(store.read().tables)
        .filter((table) => Boolean(who) && table.members.some((member) => member.id === who))
        .map((table) => ({
          code: table.table.code,
          name: table.table.name,
          creatorName: table.members.find((member) => member.id === table.table.createdBy)?.displayName ?? "someone who left",
        }));
    },
    ensureDemo() {
      if (!store.read().tables[DEMO_CODE]) writeTable(DEMO_CODE, createDemoState());
      return DEMO_CODE;
    },
    createTable(name: string, seed: boolean) {
      const who = requireViewer();
      const clean = name.trim();
      if (!clean) throw new RuleError("Give the table a name.");
      const taken = new Set(Object.keys(store.read().tables));
      let code = "";
      do {
        code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => ALPHABET[byte % ALPHABET.length]).join("");
      } while (taken.has(code));
      const characters = seed ? companyForTable() : [];
      const library = seed ? sampleLibraryFresh() : { trouble: [], troubleFolders: [] };
      const state: TableState = {
        table: {
          id: crypto.randomUUID(),
          code,
          name: clean,
          createdBy: who.id,
          currentGmId: null,
          gmEligibleIds: [who.id],
          sceneNote: seed
            ? "The company is seated. Mark who can take the GM screen, then someone taps I'm GM tonight."
            : "",
          sideFirst: null,
          turnOrder: characters.filter((character) => character.seated).map((character) => character.id),
          sessionActive: false,
          sessionId: null,
          gmNotes: seed
            ? "Notes you write here stay with the screen. The next GM inherits them."
            : "",
        },
        members: [who],
        characters,
        foes: [],
        trouble: library.trouble,
        troubleFolders: library.troubleFolders,
        log: [],
      };
      writeTable(code, state);
      return code;
    },
    load(code: string): TableState | null {
      const table = store.read().tables[code.toUpperCase()];
      if (!table) return null;
      return present(hydrate(table), viewer?.id ?? null);
    },
    dispatch(code: string, action: Action): TableState {
      const who = requireViewer();
      const key = code.toUpperCase();
      let full = readFull(key);
      if (!full.members.some((member) => member.id === who.id)) {
        full = applyAction(full, { type: "join", member: who }, { actorId: who.id });
      }
      const next =
        action.type === "join"
          ? full
          : applyAction(full, action, { actorId: who.id, now: new Date().toISOString() });
      writeTable(key, next);
      return present(next, who.id);
    },
    exportJson(code: string): string {
      const full = readFull(code);
      const include = Boolean(viewer && full.table.currentGmId === viewer.id);
      return exportTable(present(full, viewer?.id ?? null), include);
    },
    importJson(raw: string): string {
      const who = requireViewer();
      const file = parseCodexFile(raw);
      const key = file.state.table.code.toUpperCase();
      let state = file.state;
      const existing = store.read().tables[key];
      if (!file.includeGmNotes && existing) {
        const kept = hydrate(existing);
        state = {
          ...state,
          table: { ...state.table, gmNotes: kept.table.gmNotes },
          trouble: kept.trouble,
          troubleFolders: kept.troubleFolders,
        };
      }
      state = hydrate(state);
      if (!state.members.some((member) => member.id === who.id)) {
        state = { ...state, members: [...state.members, who] };
      }
      state = { ...state, table: { ...state.table, code: key } };
      writeTable(key, state);
      return key;
    },
  };
}

export type LocalApi = ReturnType<typeof createLocalApi>;
