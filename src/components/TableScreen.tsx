"use client";

import Link from "next/link";
import { useState } from "react";
import { useCodex, useTable } from "./CodexProvider";
import { Creator } from "./Creator";
import { Frame } from "./Nav";
import { effectiveAc } from "@/lib/model";
import { manaMaximum } from "@/lib/rules";
import { Banner, Button, Card, Kicker, Meter, Pips } from "./ui";

export function TableScreen({ code }: { code: string }) {
  const codex = useCodex();
  const table = useTable(code);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { state, viewer } = table;

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
          <Kicker>
            {state.table.code}
            {table.live ? <span className="ml-2 text-good">Live</span> : null}
          </Kicker>
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
            const owned = character.ownerId === viewer.id || character.ownerId === null || isGm;
            return (
              <li key={character.id} className="flex items-center gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
                <span className="num w-6 text-mute">{index + 1}</span>
                <Link href={`/t/${state.table.code}/c/${character.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{character.name}</span>
                  <span className="text-xs text-mute">
                    HP {character.hp}/{character.hpMax} · Mana {character.mana}/{manaMaximum(character.arcana)} · AC {effectiveAc(character)}
                  </span>
                </Link>
                <button
                  className="min-h-11 min-w-11 text-mute disabled:opacity-30"
                  type="button"
                  disabled={!owned || index === 0}
                  aria-label={`Move ${character.name} up`}
                  onClick={() => act(() => table.dispatch({ type: "moveTurn", characterId: character.id, direction: -1 }))}
                >
                  ↑
                </button>
                <button
                  className="min-h-11 min-w-11 text-mute disabled:opacity-30"
                  type="button"
                  disabled={!owned || index === seated.length - 1}
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
        {state.characters.filter((character) => character.seated).map((character) => (
          <Link key={character.id} href={`/t/${state.table.code}/c/${character.id}`} className="block">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-2xl leading-none">{character.name}</h3>
                  <p className="mt-1 text-sm text-mute">
                    {ownerLabel(character.ownerId, character.playerName, state.members)}
                    {character.hp === 0 ? " · Down" : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-2xl leading-none">AC {effectiveAc(character)}</p>
                  <div className="mt-2 flex justify-end">
                    <Pips value={character.heroPoints} />
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <Meter label="HP" value={character.hp} max={character.hpMax} tone="hp" />
                <Meter label="Mana" value={character.mana} max={manaMaximum(character.arcana)} tone="mana" />
              </div>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-6">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Company</h2>
          <Button tone="ghost" className="min-h-9 px-3 text-sm" onClick={() => setCreating(true)}>
            New hero
          </Button>
        </div>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line">
          {state.characters.map((character) => (
            <li key={character.id} className="flex items-center gap-3 bg-panel/70 px-3 py-3">
              <Link href={`/t/${state.table.code}/c/${character.id}`} className="min-w-0 flex-1">
                <span className="block truncate">{character.name}</span>
                <span className="text-xs text-mute">
                  {character.seated ? "Seated" : "Sat out"}
                  {" · "}
                  {ownerLabel(character.ownerId, character.playerName, state.members)}
                </span>
              </Link>
              {character.ownerId === null ? (
                <Button tone="ghost" className="min-h-9 px-3 text-sm" onClick={() => act(() => table.dispatch({ type: "claim", characterId: character.id }))}>
                  Claim
                </Button>
              ) : character.ownerId === viewer.id ? (
                <Button tone="quiet" className="min-h-9 px-2 text-sm" onClick={() => act(() => table.dispatch({ type: "release", characterId: character.id }))}>
                  Release
                </Button>
              ) : null}
            </li>
          ))}
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
          Import
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
