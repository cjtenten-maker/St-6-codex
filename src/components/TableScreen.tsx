"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCodex, useTable } from "./CodexProvider";
import { Creator } from "./Creator";
import { Frame } from "./Nav";
import type { Character, Member } from "@/lib/model";
import { effectiveAc } from "@/lib/model";
import { manaMaximum } from "@/lib/rules";
import { isClaimed } from "@/lib/table/present";
import { Portrait } from "./Portrait";
import { TableBanner } from "./TableBanner";
import { Banner, Button, Card, Kicker, Meter, Pips } from "./ui";

export function TableScreen({ code }: { code: string }) {
  const codex = useCodex();
  const table = useTable(code);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { state, viewer } = table;

  useEffect(() => {
    if (!state || !viewer) return;
    const key = `st6-sheet-${state.table.code}`;
    const saved = sessionStorage.getItem(key);
    const savedCharacter = saved ? state.characters.find((character) => character.id === saved) : undefined;
    if (saved && (!savedCharacter || savedCharacter.concealed)) {
      const own = state.characters.find((character) => character.ownerId === viewer.id);
      if (own) sessionStorage.setItem(key, own.id);
      else sessionStorage.removeItem(key);
      window.dispatchEvent(new Event("st6-sheet"));
    }
  }, [state, viewer]);

  if (!codex.ready || !viewer) return <Frame><p className="text-mute">Taking your seat…</p></Frame>;
  if (table.missing) {
    return (
      <Frame>
        <p>No table uses {code.toUpperCase()}.</p>
        <Link href="/" className="mt-4 inline-block text-brass">Back</Link>
      </Frame>
    );
  }
  if (!state) return <Frame><p className="text-mute">Opening the table…</p></Frame>;

  const gm = state.members.find((member) => member.id === state.table.currentGmId);
  const eligible = state.table.gmEligibleIds.includes(viewer.id);
  const isGm = state.table.currentGmId === viewer.id;
  const founder = state.table.createdBy === viewer.id;
  const seated = state.table.turnOrder
    .map((id) => state.characters.find((character) => character.id === id))
    .filter((character) => character && character.seated);

  const copy = async () => {
    const link = `${window.location.origin}/t/${state.table.code}`;
    await navigator.clipboard.writeText(`${link}\nCode ${state.table.code}`);
    setCopied(true);
  };

  const act = (work: () => Promise<unknown>) => {
    void work().catch(() => undefined);
  };

  return (
    <Frame code={state.table.code}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <TableBanner state={state} live={table.live} />
          <h1 className="font-display text-4xl font-medium leading-none">{state.table.name}</h1>
        </div>
        <Link href="/rules" className="pt-1 text-sm text-brass">
          Rules
        </Link>
      </header>

      <p className="mt-3 text-sm text-mute">
        {state.characters.filter((character) => character.seated).length} of 12 seated · {state.characters.length} of 48 saved
        {table.mode === "local" ? " · local demo" : " · synced"}
      </p>

      {state.table.sceneNote ? <p className="mt-3 text-lg leading-snug">{state.table.sceneNote}</p> : <p className="mt-3 text-mute">No scene yet.</p>}

      <div className="mt-4 grid gap-2">
        {isGm ? (
          <Banner>
            You have the GM screen. Your characters are sitting out.{" "}
            <Link href={`/t/${state.table.code}/gm`} className="underline">
              Open it
            </Link>
          </Banner>
        ) : gm ? (
          <Banner tone="miss">{gm.displayName} has the GM screen tonight.</Banner>
        ) : (
          <Banner tone="miss">Nobody has taken the GM screen.</Banner>
        )}
        {eligible && !isGm ? (
          <Button onClick={() => act(() => table.dispatch({ type: "claimGm" }))}>I'm GM tonight</Button>
        ) : null}
        <Button tone="ghost" onClick={() => void copy()}>
          {copied ? "Copied" : `Invite · ${state.table.code}`}
        </Button>
      </div>

      {table.error ? <p className="mt-3 text-sm text-hp">{table.error}</p> : null}

      <section className="mt-6">
        <Kicker>{state.table.sideFirst === "trouble" ? "Trouble goes first" : state.table.sideFirst === "heroes" ? "Heroes go first" : "Side not chosen"}</Kicker>
        <h2 className="mt-1 font-display text-2xl">Order</h2>
        <p className="text-sm text-mute">No initiative roll. Move yourself. The GM can move anyone.</p>
        <ol className="mt-3 grid gap-2">
          {seated.map((character, index) => {
            if (!character) return null;
            const canMove = isGm || character.ownerId === viewer.id || !isClaimed(character);
            const open = !character.concealed;
            const identity = (
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Portrait path={character.portraitPath} name={character.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{character.name}</span>
                  <span className="text-xs text-mute">
                    {open
                      ? `HP ${character.hp}/${character.hpMax} · Mana ${character.mana}/${manaMaximum(character.arcana)} · AC ${effectiveAc(character)}`
                      : publicLine(character)}
                  </span>
                </span>
              </span>
            );
            return (
              <li key={character.id} className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
                <span className="num w-6 text-mute">{index + 1}</span>
                {open ? (
                  <Link href={`/t/${state.table.code}/c/${character.id}`} className="min-w-0 flex-1">
                    {identity}
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{identity}</div>
                )}
                <button
                  className="min-h-11 min-w-11 text-mute disabled:opacity-30"
                  type="button"
                  disabled={!canMove || index === 0}
                  aria-label={`Move ${character.name} up`}
                  onClick={() => act(() => table.dispatch({ type: "moveTurn", characterId: character.id, direction: -1 }))}
                >
                  ↑
                </button>
                <button
                  className="min-h-11 min-w-11 text-mute disabled:opacity-30"
                  type="button"
                  disabled={!canMove || index === seated.length - 1}
                  aria-label={`Move ${character.name} down`}
                  onClick={() => act(() => table.dispatch({ type: "moveTurn", characterId: character.id, direction: 1 }))}
                >
                  ↓
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6 grid gap-3">
        <h2 className="font-display text-2xl">Seated</h2>
        {state.characters.filter((character) => character.seated).map((character) => {
          const card = (
            <Card>
              <div className="flex items-start gap-3">
                <Portrait path={character.portraitPath} name={character.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-display text-2xl leading-none">{character.name}</h3>
                      <p className="mt-1 text-sm text-mute">{faceLine(character, state.members)}</p>
                    </div>
                    {character.concealed ? null : (
                      <div className="text-right">
                        <p className="num text-2xl leading-none">AC {effectiveAc(character)}</p>
                        <div className="mt-2 flex justify-end">
                          <Pips value={character.heroPoints} />
                        </div>
                      </div>
                    )}
                  </div>
                  {character.concealed ? null : (
                    <div className="mt-3 grid gap-2">
                      <Meter label="HP" value={character.hp} max={character.hpMax} tone="hp" />
                      <Meter label="Mana" value={character.mana} max={manaMaximum(character.arcana)} tone="mana" />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
          return character.concealed ? (
            <div key={character.id}>{card}</div>
          ) : (
            <Link key={character.id} href={`/t/${state.table.code}/c/${character.id}`} className="block">
              {card}
            </Link>
          );
        })}
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Company</h2>
          <Button tone="ghost" className="min-h-9 px-3 text-sm" onClick={() => setCreating(true)}>
            New hero
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {state.characters.map((character) => {
            const claimed = isClaimed(character);
            const identity = (
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Portrait path={character.portraitPath} name={character.name} />
                <span className="min-w-0">
                  <span className="block truncate">{character.name}</span>
                  <span className="text-xs text-mute">{faceLine(character, state.members)}</span>
                </span>
              </span>
            );
            return (
              <li key={character.id} className="flex items-center gap-3 bg-panel/70 px-3 py-3">
                {character.concealed ? (
                  identity
                ) : (
                  <Link href={`/t/${state.table.code}/c/${character.id}`} className="min-w-0 flex-1">
                    {identity}
                  </Link>
                )}
                {!claimed ? (
                  <Button tone="ghost" className="min-h-9 px-3 text-sm" onClick={() => act(() => table.dispatch({ type: "claim", characterId: character.id }))}>
                    Claim
                  </Button>
                ) : character.ownerId === viewer.id ? (
                  <Button tone="quiet" className="min-h-9 px-2 text-sm" onClick={() => act(() => table.dispatch({ type: "release", characterId: character.id }))}>
                    Release
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {(isGm || founder) && (
        <section className="mt-6">
          <h2 className="font-display text-2xl">GM-eligible</h2>
          <p className="text-sm text-mute">Three or four people. Four is the limit.</p>
          <ul className="mt-3 grid gap-2">
            {state.members.map((member) => {
              const on = state.table.gmEligibleIds.includes(member.id);
              return (
                <li key={member.id} className="flex items-center justify-between rounded-xl border border-line px-3 py-2">
                  <span>
                    {member.displayName}
                    {member.id === state.table.currentGmId ? <span className="text-brass"> · GM</span> : null}
                  </span>
                  <Button
                    tone={on ? "brass" : "ghost"}
                    className="min-h-9 px-3 text-sm"
                    onClick={() => {
                      const ids = on
                        ? state.table.gmEligibleIds.filter((id) => id !== member.id)
                        : [...state.table.gmEligibleIds, member.id];
                      act(() => table.dispatch({ type: "setEligible", memberIds: ids }));
                    }}
                  >
                    {on ? "Eligible" : "Mark"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button
          tone="ghost"
          onClick={() =>
            act(async () => {
              const file = await codex.exportJson(state.table.code);
              const blob = new Blob([file], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const anchor = document.createElement("a");
              anchor.href = url;
              anchor.download = `${state.table.code}.st6.json`;
              anchor.click();
              URL.revokeObjectURL(url);
            })
          }
        >
          Export JSON
        </Button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-line px-4 text-sm">
          Import as a new table
          <input
            className="sr-only"
            type="file"
            accept="application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void file.text().then((raw) => codex.importTable(raw).then((next) => {
                window.location.href = `/t/${next}`;
              })).catch((error: Error) => codex.setNotice(error.message));
            }}
          />
        </label>
      </div>

      {creating ? (
        <Creator
          onClose={() => setCreating(false)}
          onCreate={async (character) => {
            await table.dispatch({ type: "addCharacter", character: { ...character, ownerId: viewer.id } });
            setCreating(false);
          }}
        />
      ) : null}
    </Frame>
  );
}

function publicLine(character: Character): string {
  return [character.seated ? "Seated" : "Sitting out", character.down ? "Down" : null, character.claimed ? "Claimed" : "Unclaimed"]
    .filter(Boolean)
    .join(" · ");
}

function faceLine(character: Character, members: Member[]): string {
  if (character.concealed) return publicLine(character);
  const who = ownerLabel(character.ownerId, character.playerName, members);
  return character.hp <= 0 ? `${who} · Down` : who;
}

function ownerLabel(
  ownerId: string | null,
  playerName: string,
  members: { id: string; displayName: string }[],
): string {
  if (ownerId) {
    const member = members.find((item) => item.id === ownerId);
    return member ? `Played by ${member.displayName}` : "Claimed";
  }
  return playerName ? `Sheet says ${playerName} · unclaimed` : "Unclaimed";
}
