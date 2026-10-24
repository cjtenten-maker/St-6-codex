"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { TableState } from "@/lib/model";
import { pathForTable, rememberTable, tableHost } from "@/lib/table/identity";
import { useCodex } from "./CodexProvider";
import { cx } from "./ui";

export function TableBanner({
  state,
  live,
  prominent = false,
}: {
  state: Pick<TableState, "table" | "members">;
  live?: boolean;
  prominent?: boolean;
}) {
  const codex = useCodex();
  const router = useRouter();
  const pathname = usePathname();
  const host = tableHost(state);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const code = state.table.code.toUpperCase();

  useEffect(() => {
    rememberTable(code);
    void codex.refreshTables();
  }, [code, codex.refreshTables]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (nextCode: string) => {
    const next = nextCode.toUpperCase();
    rememberTable(next);
    const sheet = sessionStorage.getItem(`st6-sheet-${next}`);
    const href = pathForTable(pathname, next, sheet);
    setOpen(false);
    if (href !== pathname) router.push(href);
  };

  const tables = [...codex.tables].sort((a, b) => {
    if (a.code.toUpperCase() === code) return -1;
    if (b.code.toUpperCase() === code) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        className="block max-w-full text-left"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${state.table.name}, code ${code}. Switch table`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={cx("block font-display font-medium leading-none", prominent ? "text-4xl" : "text-lg")}>
          {state.table.name}
          <span className="ml-2 text-base text-mute" aria-hidden>
            ▾
          </span>
        </span>
        <span className="mt-1 block text-sm">
          <span className="font-medium tracking-[0.14em] text-brass">{code}</span>
          <span className="text-mute">
            {" "}
            · {host.role} {host.name}
          </span>
          {live ? <span className="text-good"> · Live</span> : null}
        </span>
      </button>
      {open ? (
        <div className="absolute left-0 z-40 mt-2 max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-line bg-panel p-2 shadow-card">
          <ul role="listbox" aria-label="Your tables" className="grid gap-1">
            {tables.map((table) => {
              const current = table.code.toUpperCase() === code;
              return (
                <li key={table.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={current}
                    className={cx(
                      "w-full rounded-xl px-3 py-2 text-left",
                      current ? "bg-brass/15" : "hover:bg-white/5",
                    )}
                    onClick={() => choose(table.code)}
                  >
                    <span className="block font-medium">{table.name}</span>
                    <span className="text-sm text-mute">
                      {table.code} · {table.creatorName}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 grid gap-1 border-t border-line pt-2">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-left text-brass"
              onClick={() => {
                setOpen(false);
                router.push("/?join=1");
              }}
            >
              Join with a code
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-left text-mute"
              onClick={() => {
                setOpen(false);
                router.push("/?create=1");
              }}
            >
              Create a table
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
