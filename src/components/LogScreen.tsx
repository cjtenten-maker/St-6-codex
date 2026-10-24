"use client";

import Link from "next/link";
import { useCodex, useTable } from "./CodexProvider";
import { Frame } from "./Nav";
import { TableBanner } from "./TableBanner";
import { Kicker } from "./ui";

const LABEL: Record<string, string> = {
  roll: "Roll",
  damage: "Harm",
  spell: "Spell",
  advance: "Advance",
  rest: "Rest",
  session: "Session",
  hero: "Hero",
  gm: "GM",
  note: "Table",
};

export function LogScreen({ code }: { code: string }) {
  const codex = useCodex();
  const { state, viewer } = useTable(code);
  if (!codex.ready || !viewer) return <Frame><p className="text-mute">Taking your seat…</p></Frame>;
  if (!state) return <Frame><p className="text-mute">Opening the log…</p></Frame>;
  const entries = [...state.log].reverse();
  return (
    <Frame code={state.table.code}>
      <TableBanner state={state} />
      <Kicker>Session log</Kicker>
      <h1 className="font-display text-4xl">What happened</h1>
      <p className="mt-1 text-sm text-mute">Rolls, harm, spells, and advances. {state.table.sessionActive ? "This session is open." : "Between sessions."}</p>
      {entries.length === 0 ? (
        <p className="mt-6 text-mute">Nothing written yet. The first roll will land here.</p>
      ) : (
        <ol className="mt-4 grid gap-2">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-2xl border border-line bg-panel px-3 py-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-brass">
                {LABEL[entry.kind] ?? entry.kind}
                <span className="text-mute"> · {entry.actorName}</span>
              </p>
              <p className="mt-1 leading-snug">{entry.summary}</p>
              <p className="mt-1 text-xs text-mute">{new Date(entry.at).toLocaleString()}</p>
            </li>
          ))}
        </ol>
      )}
      <Link href={`/t/${state.table.code}`} className="mt-6 inline-block text-sm text-brass">Back to the table</Link>
    </Frame>
  );
}
