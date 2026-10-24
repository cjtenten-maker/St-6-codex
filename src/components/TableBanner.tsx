import type { TableState } from "@/lib/model";
import { tableHost } from "@/lib/table/identity";

export function TableBanner({ state, live }: { state: Pick<TableState, "table" | "members">; live?: boolean }) {
  const host = tableHost(state);
  return (
    <p className="text-sm">
      <span className="font-medium tracking-[0.14em] text-brass">{state.table.code}</span>
      <span className="text-mute">
        {" "}
        · {host.role} {host.name}
      </span>
      {live ? <span className="text-good"> · Live</span> : null}
    </p>
  );
}
