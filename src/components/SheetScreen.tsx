"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { WEAPONS, SPELLS } from "@/lib/data/catalog";
import type { Character, Spell, StatName, Weapon } from "@/lib/model";
import { effectiveAc } from "@/lib/model";
import { manaMaximum } from "@/lib/rules";
import { useCodex, useTable } from "./CodexProvider";
import { Frame } from "./Nav";
import { Portrait, PortraitControls } from "./Portrait";
import { Roller } from "./Roller";
import { Banner, Button, Card, Kicker, Meter, Pips, TextField, Area } from "./ui";

const STATS: { key: StatName; label: string }[] = [
  { key: "charisma", label: "Cha" },
  { key: "strength", label: "Str" },
  { key: "combat", label: "Com" },
  { key: "arcana", label: "Arc" },
];

/** Amend labels. Speed is the charisma stat on the sheet. */
const AMEND_STATS: { key: StatName; label: string }[] = [
  { key: "combat", label: "Combat" },
  { key: "strength", label: "Strength" },
  { key: "charisma", label: "Speed" },
  { key: "arcana", label: "Arcana" },
];

type Roll =
  | { kind: "attack"; weapon: Weapon }
  | { kind: "cast"; spell: Spell }
  | { kind: "check" };

export function SheetScreen({ code, id }: { code: string; id: string }) {
  const codex = useCodex();
  const table = useTable(code);
  const [roll, setRoll] = useState<Roll | null>(null);
  const [amending, setAmending] = useState(false);
  const [advance, setAdvance] = useState("");
  const [portraitBusy, setPortraitBusy] = useState(false);
  const { state, viewer } = table;
  const character = state?.characters.find((item) => item.id === id);

  useEffect(() => {
    if (!character) return;
    const key = `st6-sheet-${code.toUpperCase()}`;
    if (character.concealed) {
      if (sessionStorage.getItem(key) === character.id) {
        sessionStorage.removeItem(key);
        window.dispatchEvent(new Event("st6-sheet"));
      }
      return;
    }
    sessionStorage.setItem(key, character.id);
    window.dispatchEvent(new Event("st6-sheet"));
  }, [character, code]);

  if (!codex.ready || !viewer) return <Frame><p className="text-mute">Taking your seat…</p></Frame>;
  if (!state) return <Frame><p className="text-mute">Opening the sheet…</p></Frame>;
  if (!character) {
    return (
      <Frame code={code}>
        <p>That sheet isn't at this table.</p>
        <Link href={`/t/${code}`} className="text-brass">Back to the table</Link>
      </Frame>
    );
  }

  const act = (work: () => Promise<unknown>) => {
    void work().catch(() => undefined);
  };

  if (character.concealed) {
    return (
      <Frame code={state.table.code}>
        <Link href={`/t/${state.table.code}`} className="text-sm text-mute">
          ← {state.table.name}
        </Link>
        <header className="mt-2">
          <Kicker>{character.seated ? "Seated" : "Sitting out"}{character.down ? " · Down" : ""}</Kicker>
          <h1 className="font-display text-4xl font-medium leading-tight">{character.name}</h1>
          <p className="mt-2 text-mute">This sheet is private.</p>
        </header>
        <Portrait path={character.portraitPath} name={character.name} size="lg" />
        {table.error ? <p className="mt-3 text-sm text-hp">{table.error}</p> : null}
        {!character.claimed ? (
          <Button className="mt-4" onClick={() => act(() => table.dispatch({ type: "claim", characterId: character.id }))}>
            Claim
          </Button>
        ) : null}
      </Frame>
    );
  }

  const isGm = state.table.currentGmId === viewer.id;
  const canEdit = isGm || character.ownerId === viewer.id;
  const canSpend = character.ownerId === viewer.id || (isGm && character.ownerId === null);
  const canPortrait = canEdit && character.ownerId !== null;
  const editableHeroes = state.characters.filter((hero) => !hero.concealed && (isGm || hero.ownerId === viewer.id));
  const manaMax = manaMaximum(character.arcana);
  const ac = effectiveAc(character);
  const weapons = withUnarmed(character.weapons);
  const owner = state.members.find((member) => member.id === character.ownerId);

  const pickPortrait = async (file: File) => {
    setPortraitBusy(true);
    try {
      await table.setPortrait(character.id, file);
    } finally {
      setPortraitBusy(false);
    }
  };

  const bump = (direction: "harm" | "heal", amount = 1) =>
    act(() =>
      table.dispatch({
        type: "applyHarm",
        target: { kind: "character", id: character.id },
        amount,
        direction,
        summary: `${character.name} ${direction === "harm" ? "takes" : "recovers"} ${amount}. HP ${
          direction === "harm" ? Math.max(0, character.hp - amount) : Math.min(character.hpMax, character.hp + amount)
        }.`,
      }),
    );

  return (
    <Frame code={state.table.code}>
      <Link href={`/t/${state.table.code}`} className="text-sm text-mute">
        ← {state.table.name}
      </Link>
      <header className="mt-2">
        <Kicker>
          {character.seated ? "Seated" : "Sitting out"}
          {character.role ? ` · ${character.role}` : ""}
        </Kicker>
        <h1 className="font-display text-4xl font-medium leading-tight">{character.name}</h1>
        <Portrait path={character.portraitPath} name={character.name} size="lg" />
        {canPortrait ? (
          <PortraitControls
            path={character.portraitPath}
            busy={portraitBusy}
            onPick={pickPortrait}
            onRemove={async () => {
              setPortraitBusy(true);
              try {
                await table.setPortrait(character.id, null);
              } finally {
                setPortraitBusy(false);
              }
            }}
          />
        ) : null}
        <p className="mt-1 text-sm text-mute">
          {owner ? `Played by ${owner.displayName}` : character.playerName ? `Sheet says ${character.playerName}` : "Unclaimed"}
          {character.playerName && owner ? ` · sheet says ${character.playerName}` : ""}
        </p>
      </header>

      {character.look ? (
        <section className="mt-4">
          <Block title="Description" body={character.look} />
        </section>
      ) : null}
      {character.concept ? <p className="mt-3 leading-snug">{character.concept}</p> : null}
      {!character.seated ? <Banner tone="miss">Not in the seats. Rests, the new session, and trouble don't reach them.</Banner> : null}
      {character.hp === 0 ? <div className="mt-3"><Banner tone="miss">Down.</Banner></div> : null}
      {table.error ? <p className="mt-3 text-sm text-hp">{table.error}</p> : null}

      <div className="mt-4 grid grid-cols-4 gap-2">
        {STATS.map((stat) => (
          <Card key={stat.key} className="px-2 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">{stat.label}</p>
            <p className="num font-display text-3xl">{character[stat.key]}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-3">
        <div className="grid gap-3">
          <Meter label="Hit points" value={character.hp} max={character.hpMax} tone="hp" />
          <Meter label="Mana" value={character.mana} max={manaMax} tone="mana" />
        </div>
        {canEdit ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button tone="ghost" className="min-h-9 px-3" onClick={() => bump("harm")}>−1 HP</Button>
            <Button tone="ghost" className="min-h-9 px-3" onClick={() => bump("heal")}>+1 HP</Button>
            <Button tone="ghost" className="min-h-9 px-3" onClick={() => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { mana: character.mana - 1 } }))}>−1 mana</Button>
            <Button tone="ghost" className="min-h-9 px-3" onClick={() => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { mana: character.mana + 1 } }))}>+1 mana</Button>
          </div>
        ) : null}
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Armor class</p>
            <p className="num font-display text-4xl leading-none">{ac}</p>
            <p className="mt-1 text-xs text-mute">
              {character.acNote}
              {character.tempAc ? ` · +${character.tempAc} temporary` : ""}
              {character.defenseTagActive ? " · tag +1" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.16em] text-mute">Hero {character.heroPoints}/8</p>
            <div className="mt-2"><Pips value={character.heroPoints} /></div>
          </div>
        </div>
      </Card>

      <section className="mt-4">
        <Kicker>Tags</Kicker>
        <p className="text-sm text-mute">+2 if you declare one before the roll. Or hold one for +1 AC until a rest.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {character.tags.length === 0 ? <p className="text-sm text-mute">None written.</p> : null}
          {character.tags.map((tag) => (
            <span key={tag.id} className="rounded-full border border-line px-3 py-1 text-sm">
              {tag.label}
            </span>
          ))}
        </div>
        {canEdit ? (
          <div className="mt-2">
            {character.defenseTagActive ? (
              <Button tone="ghost" onClick={() => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { defenseTagActive: false } }))}>
                Drop the defensive tag
              </Button>
            ) : (
              <Button tone="ghost" onClick={() => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { defenseTagActive: true } }))}>
                Hold a tag · +1 AC
              </Button>
            )}
          </div>
        ) : null}
      </section>

      {character.suit ? (
        <div className="mt-4">
          <Button
            tone="ghost"
            disabled={!canEdit}
            onClick={() =>
              act(() =>
                table.dispatch({
                  type: "patchCharacter",
                  characterId: character.id,
                  patch: { suit: { ...character.suit!, on: !character.suit!.on } },
                }),
              )
            }
          >
            {character.suit.on ? "Suit on · Charisma 12, AC 17" : "Suit off · Charisma 9, AC 14"}
          </Button>
        </div>
      ) : null}

      {character.focusCastBonus ? (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(character.focusOn)}
            disabled={!canEdit}
            onChange={(event) => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { focusOn: event.target.checked } }))}
          />
          Judge's Edge staff is the focus · +{character.focusCastBonus} to cast
        </label>
      ) : null}

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={character.energyShield}
          disabled={!canEdit}
          onChange={(event) => act(() => table.dispatch({ type: "patchCharacter", characterId: character.id, patch: { energyShield: event.target.checked } }))}
        />
        Energy shield up · swallows one full-potential hit
      </label>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Weapons</h2>
        <div className="mt-2 grid gap-2">
          {weapons.map((weapon) => (
            <Card key={weapon.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg leading-tight">{weapon.name}</h3>
                  <p className="text-sm text-mute">
                    {weapon.damage}
                    {weapon.bonusMode === "full" ? " + full " : weapon.bonusMode === "half" ? " + half " : " "}
                    {weapon.bonusMode === "none" ? "no stat" : weapon.bonusStat ?? weapon.hitStat}
                    {" · to hit "}
                    {weapon.hitStat === "none" ? "d12" : weapon.hitStat}
                    {weapon.ignoreAc ? ` · ignores ${weapon.ignoreAc} AC` : ""}
                  </p>
                  {weapon.notes ? <p className="mt-1 text-sm text-mute">{weapon.notes}</p> : null}
                  {weapon.overheated ? <p className="mt-1 text-sm text-hp">Overheated.</p> : null}
                </div>
                <Button disabled={weapon.overheated} onClick={() => setRoll({ kind: "attack", weapon })}>
                  Strike
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-display text-2xl">Spells</h2>
        <p className="text-sm text-mute">Mana is spent, then the d12. A miss fizzles and the mana stays gone.</p>
        <div className="mt-2 grid gap-2">
          {character.spells.length === 0 ? <p className="text-sm text-mute">No spells written.</p> : null}
          {character.spells.map((spell) => (
            <Card key={spell.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="leading-tight">{spell.name}</h3>
                  <p className="text-sm text-mute">{spell.cost} mana · {spell.effect}</p>
                </div>
                <Button tone="ghost" disabled={character.mana < spell.cost} onClick={() => setRoll({ kind: "cast", spell })}>
                  Cast
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button tone="ghost" onClick={() => setRoll({ kind: "check" })}>Check</Button>
        {canSpend ? (
          <Button
            tone="ghost"
            disabled={character.heroPoints < 1}
            onClick={() => {
              const beat = window.prompt("What advantage do they seize?");
              if (!beat?.trim()) return;
              act(async () => {
                await table.dispatch({ type: "spendHero", characterId: character.id, reason: "narrative" });
                await table.dispatch({ type: "log", kind: "hero", summary: `${character.name}: ${beat.trim()}` });
              });
            }}
          >
            Narrative beat
          </Button>
        ) : null}
      </div>

      {canEdit ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            act(async () => {
              await table.dispatch({ type: "advance", characterId: character.id, text: advance });
              setAdvance("");
            });
          }}
        >
          <TextField value={advance} onChange={(event) => setAdvance(event.target.value)} placeholder="Note an advance" aria-label="Advance" />
          <Button type="submit" tone="ghost">Bank</Button>
        </form>
      ) : null}

      <section className="mt-6 grid gap-3 text-sm leading-relaxed">
        {character.abilities ? <Block title="Abilities" body={character.abilities} /> : null}
        {character.inventory ? <Block title="Inventory" body={character.inventory} /> : null}
        {character.notes ? <Block title="Notes" body={character.notes} /> : null}
      </section>

      {canEdit ? (
        <div className="mt-4">
          <Button tone="ghost" onClick={() => setAmending((open) => !open)}>
            {amending ? "Close the amend" : "Amend the sheet"}
          </Button>
        </div>
      ) : null}
      {amending ? (
        <Amend
          character={character}
          onSave={async (patch) => {
            await table.dispatch({ type: "patchCharacter", characterId: character.id, patch });
            setAmending(false);
          }}
          onRetire={async () => {
            await table.dispatch({ type: "removeCharacter", characterId: character.id });
          }}
        />
      ) : null}

      {roll ? (
        <Roller
          kind={roll.kind}
          character={character}
          weapon={roll.kind === "attack" ? roll.weapon : undefined}
          spell={roll.kind === "cast" ? roll.spell : undefined}
          foes={state.foes}
          heroes={editableHeroes}
          canSpend={canSpend}
          dispatch={table.dispatch}
          onClose={() => setRoll(null)}
        />
      ) : null}
    </Frame>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Kicker>{title}</Kicker>
      <p className="mt-2 whitespace-pre-wrap">{body}</p>
    </Card>
  );
}

function withUnarmed(weapons: Weapon[]): Weapon[] {
  if (weapons.some((weapon) => /unarmed/i.test(weapon.name))) return weapons;
  const catalog = WEAPONS.find((weapon) => weapon.id === "unarmed");
  if (!catalog) return weapons;
  return [
    ...weapons,
    {
      id: "unarmed-always",
      name: catalog.name,
      damage: catalog.damage,
      hitStat: catalog.hitStat,
      bonusMode: catalog.bonusMode,
      notes: catalog.notes,
    },
  ];
}

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-[11px] uppercase tracking-[0.14em] text-mute">{label}</span>
      {children}
    </label>
  );
}

function Amend({
  character,
  onSave,
  onRetire,
}: {
  character: Character;
  onSave: (patch: Partial<Character>) => Promise<void>;
  onRetire: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(character);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetire, setConfirmRetire] = useState(false);
  const set = (patch: Partial<Character>) => setDraft({ ...draft, ...patch });
  return (
    <Card className="mt-3 grid gap-3">
      <Kicker>Amend</Kicker>
      <Labeled label="Name">
        <TextField value={draft.name} aria-label="Name" onChange={(event) => set({ name: event.target.value })} />
      </Labeled>
      <Labeled label="Role">
        <TextField value={draft.role} aria-label="Role" onChange={(event) => set({ role: event.target.value })} />
      </Labeled>
      <Labeled label="Description">
        <Area rows={4} value={draft.look} aria-label="Description" onChange={(event) => set({ look: event.target.value })} />
      </Labeled>
      <div className="grid grid-cols-2 gap-2">
        {AMEND_STATS.map((stat) => (
          <Labeled key={stat.key} label={stat.label}>
            <TextField aria-label={stat.label} inputMode="numeric" value={draft[stat.key]} onChange={(event) => set({ [stat.key]: Number(event.target.value) })} />
          </Labeled>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Labeled label="HP">
          <TextField aria-label="HP" inputMode="numeric" value={draft.hp} onChange={(event) => set({ hp: Number(event.target.value) })} />
        </Labeled>
        <Labeled label="Max HP">
          <TextField aria-label="Max HP" inputMode="numeric" value={draft.hpMax} onChange={(event) => set({ hpMax: Number(event.target.value) })} />
        </Labeled>
        <Labeled label="Mana">
          <TextField aria-label="Mana" inputMode="numeric" value={draft.mana} onChange={(event) => set({ mana: Number(event.target.value) })} />
        </Labeled>
        <Labeled label="AC">
          <TextField aria-label="AC" inputMode="numeric" value={draft.ac} onChange={(event) => set({ ac: Number(event.target.value) })} />
        </Labeled>
      </div>
      <Labeled label="AC note">
        <TextField value={draft.acNote} aria-label="AC note" onChange={(event) => set({ acNote: event.target.value })} />
      </Labeled>
      <Labeled label="Notes">
        <Area rows={3} value={draft.notes} aria-label="Notes" onChange={(event) => set({ notes: event.target.value })} />
      </Labeled>
      <Labeled label="Gear">
        <Area rows={2} value={draft.inventory} aria-label="Gear" onChange={(event) => set({ inventory: event.target.value })} />
      </Labeled>
      <div className="grid gap-1">
        <span className="text-[11px] uppercase tracking-[0.14em] text-mute">Tags</span>
        {draft.tags.map((tag, index) => (
          <div key={tag.id} className="flex gap-2">
            <TextField value={tag.label} aria-label={`Tag ${index + 1}`} onChange={(event) => set({ tags: draft.tags.map((item, i) => (i === index ? { ...item, label: event.target.value } : item)) })} />
            <Button tone="quiet" type="button" onClick={() => set({ tags: draft.tags.filter((_, i) => i !== index) })}>Remove</Button>
          </div>
        ))}
        {draft.tags.length < 5 ? (
          <Button tone="ghost" type="button" onClick={() => set({ tags: [...draft.tags, { id: crypto.randomUUID(), label: "", defensive: false }] })}>Add a tag</Button>
        ) : null}
      </div>
      <p className="text-xs text-mute">Add from the lists. Willow's sheet and the other scraps are allowed to carry fewer than three.</p>
      <select
        className="min-h-11 rounded-xl border border-line bg-ink px-3"
        defaultValue=""
        aria-label="Add a weapon"
        onChange={(event) => {
          const catalog = WEAPONS.find((weapon) => weapon.id === event.target.value);
          if (!catalog) return;
          set({
            weapons: [
              ...draft.weapons,
              { id: crypto.randomUUID(), name: catalog.name, damage: catalog.damage, hitStat: catalog.hitStat, altHitStat: catalog.altHitStat, bonusMode: catalog.bonusMode, bonusStat: catalog.bonusStat, ignoreAc: catalog.ignoreAc, overheatsOnNat1: catalog.overheatsOnNat1, notes: catalog.notes },
            ],
          });
          event.target.value = "";
        }}
      >
        <option value="">Add a weapon</option>
        {WEAPONS.map((weapon) => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
      </select>
      <select
        className="min-h-11 rounded-xl border border-line bg-ink px-3"
        defaultValue=""
        aria-label="Add a spell"
        onChange={(event) => {
          const catalog = SPELLS.find((spell) => spell.id === event.target.value);
          if (!catalog) return;
          set({
            spells: [
              ...draft.spells,
              { id: crypto.randomUUID(), name: catalog.name, cost: catalog.cost, effect: catalog.effect, damage: catalog.damage, heal: catalog.heal, tempAc: catalog.tempAc, aoeAc: catalog.aoeAc, saveForHalf: catalog.saveForHalf, notes: catalog.notes },
            ],
          });
          event.target.value = "";
        }}
      >
        <option value="">Add a spell</option>
        {SPELLS.map((spell) => <option key={spell.id} value={spell.id}>{spell.name}</option>)}
      </select>
      {error ? <p className="text-sm text-hp">{error}</p> : null}
      <Button
        onClick={() => {
          const tags = draft.tags.filter((tag) => tag.label.trim());
          if (tags.length > 5) return setError("Five tags is the limit.");
          void onSave({ ...draft, tags, name: draft.name.trim() || character.name }).catch((caught: Error) => setError(caught.message));
        }}
      >
        Save the amend
      </Button>
      {confirmRetire ? (
        <Button
          tone="danger"
          onClick={() => {
            void onRetire().catch((caught: Error) => setError(caught.message));
          }}
        >
          Delete {character.name}
        </Button>
      ) : (
        <Button tone="quiet" type="button" onClick={() => setConfirmRetire(true)}>
          Retire this character
        </Button>
      )}
    </Card>
  );
}
