import { DEMO_CODE } from "../ids";
import type { TableState } from "../model";

export type TableHost = {
  role: "GM" | "Opened by";
  name: string;
};

/** The person on the screen tonight, or the person who opened the table. */
export function tableHost(state: Pick<TableState, "table" | "members">): TableHost {
  const gm = state.members.find((member) => member.id === state.table.currentGmId);
  if (gm) return { role: "GM", name: gm.displayName };
  const founder = state.members.find((member) => member.id === state.table.createdBy);
  return { role: "Opened by", name: founder?.displayName ?? "someone who left" };
}

/** The built-in practice table does not count. A new player is not in a table yet. */
export function hasJoinedTable(tables: { code: string }[]): boolean {
  return tables.some((table) => table.code.toUpperCase() !== DEMO_CODE);
}

export const LAST_TABLE_KEY = "st6-last-table";

export function rememberTable(code: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(LAST_TABLE_KEY, code.toUpperCase());
}

export function lastTable(): string | null {
  if (typeof localStorage === "undefined") return null;
  const code = localStorage.getItem(LAST_TABLE_KEY)?.toUpperCase() ?? "";
  return /^[A-Z0-9]{4,8}$/.test(code) ? code : null;
}

/** Keep the current tab when the table changes. A sheet only follows if that table has one saved. */
export function pathForTable(pathname: string, toCode: string, sheetId?: string | null): string {
  const to = toCode.toUpperCase();
  const path = pathname.split("?")[0].replace(/\/$/, "") || "/";
  if (path.endsWith("/gm")) return `/t/${to}/gm`;
  if (path.endsWith("/log")) return `/t/${to}/log`;
  if (/\/c\/[^/]+$/.test(path)) return sheetId ? `/t/${to}/c/${sheetId}` : `/t/${to}`;
  return `/t/${to}`;
}
