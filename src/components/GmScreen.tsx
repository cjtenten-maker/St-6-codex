"use client";

import Link from "next/link";
import { useState } from "react";
import type { Character, Foe } from "@/lib/model";
import { effectiveAc } from "@/lib/model";
import { outcomeLabel, resolveAttack } from "@/lib/rules";
import { isOwnCharacter } from "@/lib/table/present";
import { useCodex, useTable } from "./CodexProvider";
import { Frame } from "./Nav";
import { Banner, Button, Card, Kicker, TextField, Area } from "./ui";

export function GmScreen({ code }: { code: string }) {
  const codex = useCodex();
  const table = useTable(code);
  const { state, viewer } = table;
  const [notes, setNotes] = useState<string | null>(null);
  const [scene, setScene] = useState<string | null>(null);
  const [foeName, setFoeName] = useState("");
  const [foeHp, setFoeHp] = useState("12");
  const [foeAc, setFoeAc] = useState("13");
  const [foeAttack, setFoeAttack] = useState("8");
  const [foeDamage, setFoeDamage] = useState("1d8+2");
  const [attacker, setAttacker] = useState("");
  const [target, setTarget] = useState("");
  const [strike, setStrike] = useState<string | null>(null);

  if (!codex.ready || !viewer) return <Frame><p className="text-mute">Taking your seat…</p></Frame>;
  if (!state) return <Frame><p className="text-mute">Opening the screen…</p></Frame>;

  const isGm = state.table.currentGmId === viewer.id;
  const eligible = state.table.gmEligibleIds.includes(viewer.id);
  const gm = state.members.find((member) => member.id === state.table.currentGmId);
  const me = state.members.find((member) => member.id === viewer.id) ?? viewer;
  const seated = state.characters.filter((character) => character.seated);
  const notesValue = notes ?? state.table.gmNotes;
  const sceneValue = scene ?? state.table.sceneNote;

  const act = (work: () => Promise<unknown>) => {
    void work().catch(() => undefined);
  };

  if (!isGm) {
    return (
      <Frame code={state.table.code}>
        <Kicker>GM screen</Kicker>
        <h1 className="font-display text-4xl">Behind the screen</h1>
        {gm ? <p className="mt-3">{gm.displayName} has it tonight.</p> : <p className="mt-3 text-mute">Nobody has taken it.</p>}
        {eligible ? (
          <Button className="mt-4" onClick={() => act(() => table.dispatch({ type: "claimGm" }))}>
            I'm GM tonight
          </Button>
        ) : (
          <p className="mt-4 text-sm text-mute">The GM or the founder marks three or four people who can take it.</p>
        )}
        <Link href={`/t/${state.table.code}`} className="mt-6 inline-block text-brass">Back to the table</Link>
      </Frame>
    );
  }

  const chosenFoe = state.foes.find((foe) => foe.id === (attacker || state.foes[0]?.id));
  const chosenHero = seated.find((hero) => hero.id === (target || seated[0]?.id));

  const rollTrouble = () => {
    if (!chosenFoe || !chosenHero) return;
    const d12 = 1 + Math.floor(Math.random() * 12);
    const result = resolveAttack({
      d12,
      stat: chosenFoe.attackBonus,
      ac: chosenHero.ac,
      tempAc: chosenHero.tempAc,
      defensiveAc: chosenHero.defenseTagActive ? 1 : 0,
      ignoreAc: chosenFoe.ignoreAc,
      damageExpression: chosenFoe.damage,
      damageBonus: 0,
      energyShield: chosenHero.energyShield,
    });
    const text = `${chosenFoe.name} strikes ${chosenHero.name}. ${result.equation}. ${outcomeLabel(result.outcome)} ${result.damage}.`;
    setStrike(text);
    act(async () => {
      await table.dispatch({ type: "log", kind: "roll", summary: text });
      if (result.outcome !== "miss") {
        await table.dispatch({
          type: "applyHarm",
          target: { kind: "character", id: chosenHero.id },
          amount: result.damage,
          direction: "harm",
          onlySeated: true,
          breakShield: result.shieldDropped,
          summary: result.shieldDropped
            ? `${chosenHero.name}'s energy shield swallows it and drops.`
            : `${chosenHero.name} takes ${result.damage}.`,
        });
      }
    });
  };

  return (
    <Frame code={state.table.code}>
      <div className="lg:grid lg:grid-cols-2 lg:gap-6">
        <div>
          <Kicker>You have the screen</Kicker>
          <h1 className="font-display text-4xl">GM</h1>
          <p className="mt-1 text-sm text-mute">Your own characters sit this one out. The notes stay for the next GM.</p>
          {table.error ? <p className="mt-2 text-sm text-hp">{table.error}</p> : null}

          <Card className="mt-4">
            <Kicker>Private notes</Kicker>
            <Area
              className="mt-2"
              rows={5}
              value={notesValue}
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => {
                if (notesValue !== state.table.gmNotes) act(() => table.dispatch({ type: "setGmNotes", notes: notesValue }));
              }}
            />
          </Card>

          <Card className="mt-3">
            <Kicker>Scene</Kicker>
            <Area
              className="mt-2"
              rows={3}
              value={sceneValue}
              onChange={(event) => setScene(event.target.value)}
              onBlur={() => {
                if (sceneValue !== state.table.sceneNote) act(() => table.dispatch({ type: "setScene", scene: sceneValue }));
              }}
            />
            <div className="mt-3 flex gap-2">
              <Button tone={state.table.sideFirst === "heroes" ? "brass" : "ghost"} onClick={() => act(() => table.dispatch({ type: "setSide", side: "heroes" }))}>
                Heroes first
              </Button>
              <Button tone={state.table.sideFirst === "trouble" ? "brass" : "ghost"} onClick={() => act(() => table.dispatch({ type: "setSide", side: "trouble" }))}>
                Trouble first
              </Button>
            </div>
          </Card>

          <section className="mt-4">
            <h2 className="font-display text-2xl">Order</h2>
            <p className="text-sm text-mute">No roll for it. Move anyone. Players can also move themselves from the table.</p>
            <ol className="mt-2 grid gap-1">
              {state.table.turnOrder.map((id, index) => {
                const hero = state.characters.find((character) => character.id === id);
                if (!hero) return null;
                return (
                  <li key={id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-1">
                    <span className="num w-5 text-mute">{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{hero.name}</span>
                    <button className="min-h-11 min-w-11 text-mute disabled:opacity-30" type="button" disabled={index === 0} aria-label={`Move ${hero.name} up`} onClick={() => act(() => table.dispatch({ type: "moveTurn", characterId: id, direction: -1 }))}>↑</button>
                    <button className="min-h-11 min-w-11 text-mute disabled:opacity-30" type="button" disabled={index === state.table.turnOrder.length - 1} aria-label={`Move ${hero.name} down`} onClick={() => act(() => table.dispatch({ type: "moveTurn", characterId: id, direction: 1 }))}>↓</button>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-4">
            <h2 className="font-display text-2xl">Seats · {seated.length}/12</h2>
            <ul className="mt-2 grid gap-1">
              {state.characters.map((character) => {
                const mine = isOwnCharacter(me, character);
                return (
                  <li key={character.id} className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
                    <span className="min-w-0 truncate">
                      {character.name}
                      {mine ? <span className="text-mute"> · yours, sitting out</span> : null}
                      {!character.seated && !mine ? <span className="text-mute"> · sat out</span> : null}
                    </span>
                    <Button
                      tone={character.seated ? "brass" : "ghost"}
                      className="min-h-9 px-3 text-sm"
                      disabled={mine}
                      onClick={() => {
                        const ids = character.seated
                          ? seated.filter((hero) => hero.id !== character.id).map((hero) => hero.id)
                          : [...seated.map((hero) => hero.id), character.id];
                        act(() => table.dispatch({ type: "setSeated", characterIds: ids }));
                      }}
                    >
                      {character.seated ? "Seated" : "Seat"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div>
          <section className="mt-6 lg:mt-0">
            <h2 className="font-display text-2xl">Trouble</h2>
            <div className="mt-2 grid gap-2">
              {state.foes.length === 0 ? <p className="text-sm text-mute">No foe in the scene yet.</p> : null}
              {state.foes.map((foe) => (
                <FoeCard key={foe.id} foe={foe} onChange={(patch) => act(() => table.dispatch({ type: "patchFoe", foeId: foe.id, patch }))} onRemove={() => act(() => table.dispatch({ type: "removeFoe", foeId: foe.id }))} />
              ))}
            </div>
            <Card className="mt-3 grid gap-2">
              <Kicker>Add a foe</Kicker>
              <TextField value={foeName} placeholder="Name" aria-label="Foe name" onChange={(event) => setFoeName(event.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <TextField value={foeHp} aria-label="Hit points" inputMode="numeric" onChange={(event) => setFoeHp(event.target.value)} />
                <TextField value={foeAc} aria-label="AC" inputMode="numeric" onChange={(event) => setFoeAc(event.target.value)} />
                <TextField value={foeAttack} aria-label="Attack bonus" inputMode="numeric" onChange={(event) => setFoeAttack(event.target.value)} />
                <TextField value={foeDamage} aria-label="Damage" onChange={(event) => setFoeDamage(event.target.value)} />
              </div>
              <p className="text-xs text-mute">Attack bonus is what you add to the d12. Put the whole damage in the dice line, like 2d6+3.</p>
              <Button
                onClick={() => {
                  const hp = Math.max(1, Number(foeHp) || 1);
                  act(async () => {
                    await table.dispatch({
                      type: "addFoe",
                      foe: {
                        id: crypto.randomUUID(),
                        name: foeName.trim() || "Trouble",
                        hp,
                        hpMax: hp,
                        ac: Number(foeAc) || 10,
                        attackBonus: Number(foeAttack) || 0,
                        damage: foeDamage.trim() || "1d6",
                        notes: "",
                        energyShield: false,
                      },
                    });
                    setFoeName("");
                  });
                }}
              >
                Add trouble
              </Button>
            </Card>
          </section>

          <Card className="mt-3">
            <Kicker>Trouble strikes</Kicker>
            <div className="mt-2 grid gap-2">
              <select className="min-h-11 rounded-xl border border-line bg-ink px-3" value={attacker || chosenFoe?.id || ""} onChange={(event) => setAttacker(event.target.value)} aria-label="Attacking foe">
                {state.foes.map((foe) => <option key={foe.id} value={foe.id}>{foe.name}</option>)}
              </select>
              <select className="min-h-11 rounded-xl border border-line bg-ink px-3" value={target || chosenHero?.id || ""} onChange={(event) => setTarget(event.target.value)} aria-label="Target hero">
                {seated.map((hero) => <option key={hero.id} value={hero.id}>{hero.name} · AC {effectiveAc(hero)}</option>)}
              </select>
              <Button disabled={!chosenFoe || !chosenHero} onClick={rollTrouble}>Roll the strike</Button>
              {strike ? <Banner>{strike}</Banner> : null}
            </div>
          </Card>

          <section className="mt-4">
            <h2 className="font-display text-2xl">Session</h2>
            <p className="text-sm text-mute">
              {state.table.sessionActive ? "A session is open." : "No session open."} Starting one sets seated heroes back to 3 hero points. Rests touch only the seats.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => act(() => table.dispatch({ type: "startSession" }))}>Start session</Button>
              <Button tone="ghost" onClick={() => act(() => table.dispatch({ type: "shortRest" }))}>Short rest</Button>
              <Button tone="ghost" onClick={() => act(() => table.dispatch({ type: "longRest" }))}>Long rest</Button>
              <Button tone="ghost" onClick={() => act(() => table.dispatch({ type: "endSession" }))}>End session</Button>
            </div>
            <ul className="mt-4 grid gap-2">
              {seated.map((hero) => (
                <li key={hero.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{hero.name} · {hero.heroPoints} hero</span>
                  <Button tone="quiet" className="min-h-9" onClick={() => act(() => table.dispatch({ type: "awardHero", characterId: hero.id }))}>
                    Award
                  </Button>
                </li>
              ))}
            </ul>
            <Button className="mt-4" tone="danger" onClick={() => act(() => table.dispatch({ type: "releaseGm" }))}>
              Set the screen down
            </Button>
          </section>
        </div>
      </div>
    </Frame>
  );
}

function FoeCard({
  foe,
  onChange,
  onRemove,
}: {
  foe: Foe;
  onChange: (patch: Partial<Foe>) => void;
  onRemove: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg leading-tight">{foe.name}</h3>
          <p className="text-sm text-mute">AC {foe.ac} · d12+{foe.attackBonus} · {foe.damage}{foe.energyShield ? " · shield" : ""}</p>
        </div>
        <Button tone="quiet" onClick={onRemove}>Remove</Button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Button tone="ghost" className="min-h-9 px-3" onClick={() => onChange({ hp: Math.max(0, foe.hp - 1) })}>−</Button>
        <span className="num">{foe.hp}/{foe.hpMax}</span>
        <Button tone="ghost" className="min-h-9 px-3" onClick={() => onChange({ hp: Math.min(foe.hpMax, foe.hp + 1) })}>+</Button>
        <Button tone="ghost" className="min-h-9 px-3" onClick={() => onChange({ energyShield: !foe.energyShield })}>
          {foe.energyShield ? "Shield up" : "No shield"}
        </Button>
      </div>
    </Card>
  );
}

export function seatedNames(characters: Character[]): string {
  return characters.filter((character) => character.seated).map((character) => character.name).join(", ");
}
