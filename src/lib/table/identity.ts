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
