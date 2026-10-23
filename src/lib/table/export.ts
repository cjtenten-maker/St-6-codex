import { COMPANY_CAP, SEAT_CAP, type TableState } from "../model";
import { RuleError } from "../rules/errors";

export type CodexFile = {
  format: "st6-codex";
  version: 1;
  exportedAt: string;
  includeGmNotes: boolean;
  state: TableState;
};

export function exportTable(state: TableState, includeGmNotes: boolean, now = new Date().toISOString()): string {
  const file: CodexFile = {
    format: "st6-codex",
    version: 1,
    exportedAt: now,
    includeGmNotes,
    state: includeGmNotes ? state : { ...state, table: { ...state.table, gmNotes: "" } },
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
  return {
    format: "st6-codex",
    version: 1,
    exportedAt: file.exportedAt ?? new Date().toISOString(),
    includeGmNotes: Boolean(file.includeGmNotes),
    state,
  };
}
