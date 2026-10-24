import { COMPANY_CAP, SEAT_CAP, type Character, type TableState } from "../model";
import { RuleError } from "../rules/errors";
import { libraryOf } from "./library";

export type CodexFile = {
  format: "st6-codex";
  version: 1;
  exportedAt: string;
  includeGmNotes: boolean;
  state: TableState;
};

function sheetForExport(character: Character): Character {
  const { concealed, claimed, down, ...sheet } = character;
  void concealed;
  void claimed;
  void down;
  return sheet;
}

export function exportTable(state: TableState, includeGmNotes: boolean, now = new Date().toISOString()): string {
  const library = libraryOf(state);
  const visible: TableState = {
    ...state,
    table: { ...state.table, gmNotes: includeGmNotes ? state.table.gmNotes : "" },
    characters: state.characters.filter((character) => !character.concealed).map(sheetForExport),
    trouble: includeGmNotes ? library.trouble : [],
    troubleFolders: includeGmNotes ? library.troubleFolders : [],
    troubleReady: undefined,
  };
  const file: CodexFile = {
    format: "st6-codex",
    version: 1,
    exportedAt: now,
    includeGmNotes,
    state: visible,
  };
  return JSON.stringify(file, null, 2);
}

export function parseCodexFile(raw: string): CodexFile {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new RuleError("That file isn't JSON.");
  }
  if (!data || typeof data !== "object") throw new RuleError("That file isn't an ST-6 Codex table.");
  const file = data as Partial<CodexFile>;
  if (file.format !== "st6-codex" || file.version !== 1 || !file.state) {
    throw new RuleError("That file isn't an ST-6 Codex table.");
  }
  const state = file.state;
  if (!state.table?.code || !Array.isArray(state.characters) || !Array.isArray(state.members)) {
    throw new RuleError("The file is missing the table.");
  }
  if (state.characters.length > COMPANY_CAP) throw new RuleError("A company holds at most 48 characters.");
  const seated = state.characters.filter((character) => character.seated).length;
  if (seated > SEAT_CAP) throw new RuleError("A table seats at most 12.");
  const library = libraryOf(state);
  state.trouble = library.trouble;
  state.troubleFolders = library.troubleFolders;
  return {
    format: "st6-codex",
    version: 1,
    exportedAt: file.exportedAt ?? new Date().toISOString(),
    includeGmNotes: Boolean(file.includeGmNotes),
    state,
  };
}
