"use client";

import { useState } from "react";
import type { Trouble, TroubleFolder } from "@/lib/model";
import { SPAWN_CAP } from "@/lib/model";
import { LIBRARY_WAITING } from "@/lib/table/library";
import type { useTable } from "./CodexProvider";
import { Portrait, PortraitControls } from "./Portrait";
import { Button, Card, Kicker, TextField, Area } from "./ui";

type TableApi = ReturnType<typeof useTable>;

export function TroubleLibrary({ table }: { table: TableApi }) {
  const { state } = table;
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [folderDraft, setFolderDraft] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [busyArt, setBusyArt] = useState<string | null>(null);

  if (!state) return null;
  if (state.troubleReady === false) {
    return (
      <Card className="mt-3">
        <Kicker>Library</Kicker>
        <p className="mt-2 text-sm">{LIBRARY_WAITING}</p>
      </Card>
    );
  }

  const folders = state.troubleFolders;
  const visible = state.trouble.filter((item) => {
    if (filter === "all") return true;
    if (filter === "none") return item.folderId == null;
    return item.folderId === filter;
  });
  const selected = folders.find((folder) => folder.id === filter) ?? null;

  const act = (work: () => Promise<unknown>) => {
    void work().catch(() => undefined);
  };

  const saveFolder = (folder: TroubleFolder) => act(() => table.dispatch({ type: "saveFolder", folder }));

  return (
    <div className="mt-3 grid gap-3">
      <div>
        <Kicker>Library</Kicker>
        <p className="mt-1 text-sm text-mute">Saved trouble stays with the table. Only whoever has the screen can open it. Adding a copy does not change the original.</p>
      </div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <FolderChip on={filter === "all"} onClick={() => setFilter("all")}>All</FolderChip>
        {folders.map((folder) => (
          <FolderChip key={folder.id} on={filter === folder.id} onClick={() => setFilter(folder.id)}>
            {folder.name}
          </FolderChip>
        ))}
        <FolderChip on={filter === "none"} onClick={() => setFilter("none")}>No folder</FolderChip>
      </div>

      {selected ? (
        <Card className="grid gap-2">
          <Kicker>Folder</Kicker>
          <TextField
            aria-label="Folder name"
            defaultValue={selected.name}
            key={selected.id}
            onBlur={(event) => {
              const name = event.target.value.trim();
              if (name && name !== selected.name) saveFolder({ ...selected, name });
            }}
          />
          <Button
            tone="danger"
            onClick={() => {
              act(() => table.dispatch({ type: "removeFolder", folderId: selected.id }));
              setFilter("all");
            }}
          >
            Remove folder
          </Button>
          <p className="text-xs text-mute">The trouble in it stays, under No folder.</p>
        </Card>
      ) : null}

      {addingFolder ? (
        <Card className="grid gap-2">
          <Kicker>New folder</Kicker>
          <TextField
            aria-label="New folder name"
            placeholder="Beasts, Bandits, Traps…"
            value={folderDraft}
            onChange={(event) => setFolderDraft(event.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const name = folderDraft.trim();
                if (!name) return;
                const folder = { id: crypto.randomUUID(), name, sort: folders.length };
                saveFolder(folder);
                setFolderDraft("");
                setAddingFolder(false);
                setFilter(folder.id);
              }}
            >
              Save folder
            </Button>
            <Button tone="ghost" onClick={() => setAddingFolder(false)}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <Button tone="ghost" onClick={() => setAddingFolder(true)}>New folder</Button>
      )}

      {visible.length === 0 ? <p className="text-sm text-mute">Nothing saved in this folder yet.</p> : null}
      {visible.map((item) => (
        <TroubleCard
          key={item.id}
          item={item}
          folders={folders}
          count={counts[item.id] ?? 1}
          open={editing === item.id}
          busy={busyArt === item.id}
          onCount={(count) => setCounts((current) => ({ ...current, [item.id]: count }))}
          onToggle={() => setEditing((current) => (current === item.id ? null : item.id))}
          onSpawn={() => act(() => table.dispatch({ type: "spawnTrouble", troubleId: item.id, count: counts[item.id] ?? 1 }))}
          onSave={(trouble) => {
            act(async () => {
              await table.dispatch({ type: "saveTrouble", trouble });
              setEditing(null);
            });
          }}
          onRemove={() => act(() => table.dispatch({ type: "removeTrouble", troubleId: item.id }))}
          onArt={async (file) => {
            setBusyArt(item.id);
            try {
              await table.setTroubleArt(item.id, file);
            } finally {
              setBusyArt(null);
            }
          }}
        />
      ))}

      {editing === "new" ? (
        <TroubleEditor
          folders={folders}
          initial={{
            id: crypto.randomUUID(),
            folderId: selected?.id ?? null,
            name: "",
            hp: 12,
            ac: 12,
            attackBonus: 4,
            damage: "1d6",
            abilities: "",
            notes: "",
            energyShield: false,
            portraitPath: null,
            sort: state.trouble.length,
          }}
          onCancel={() => setEditing(null)}
          onSave={(trouble) => {
            act(async () => {
              await table.dispatch({ type: "saveTrouble", trouble });
              setEditing(null);
            });
          }}
        />
      ) : (
        <Button onClick={() => setEditing("new")}>New trouble</Button>
      )}
    </div>
  );
}

function FolderChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full border px-4 text-sm ${on ? "border-brass bg-brass text-ink" : "border-line text-paper"}`}
    >
      {children}
    </button>
  );
}

function TroubleCard({
  item,
  folders,
  count,
  open,
  busy,
  onCount,
  onToggle,
  onSpawn,
  onSave,
  onRemove,
  onArt,
}: {
  item: Trouble;
  folders: TroubleFolder[];
  count: number;
  open: boolean;
  busy: boolean;
  onCount: (count: number) => void;
  onToggle: () => void;
  onSpawn: () => void;
  onSave: (trouble: Trouble) => void;
  onRemove: () => void;
  onArt: (file: File | null) => Promise<void>;
}) {
  const [confirm, setConfirm] = useState(false);
  const folder = folders.find((entry) => entry.id === item.folderId);
  return (
    <Card>
      <div className="flex items-start gap-3">
        <Portrait path={item.portraitPath} name={item.name} bucket="trouble-art" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg leading-tight">{item.name}</h3>
          <p className="text-sm text-mute">
            {folder ? `${folder.name} · ` : ""}HP {item.hp} · AC {item.ac} · d12+{item.attackBonus} · {item.damage}
            {item.energyShield ? " · shield" : ""}
          </p>
          {item.abilities ? <p className="mt-1 text-sm">{item.abilities}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button tone="ghost" className="min-h-11 min-w-11 px-3" aria-label={`Fewer ${item.name}`} onClick={() => onCount(Math.max(1, count - 1))}>
          −
        </Button>
        <span className="num min-w-6 text-center" aria-live="polite">{count}</span>
        <Button tone="ghost" className="min-h-11 min-w-11 px-3" aria-label={`More ${item.name}`} onClick={() => onCount(Math.min(SPAWN_CAP, count + 1))}>
          +
        </Button>
        <Button onClick={onSpawn} aria-label={`Add ${count} ${item.name} to the scene`}>Add to scene</Button>
        <Button tone="ghost" onClick={onToggle}>{open ? "Close" : "Edit"}</Button>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3">
          <TroubleEditor folders={folders} initial={item} onCancel={onToggle} onSave={onSave} />
          <PortraitControls
            path={item.portraitPath}
            busy={busy}
            noun="picture"
            hint="Only the current GM sees this picture. Photos only, up to 5 MB."
            onPick={(file) => onArt(file)}
            onRemove={() => onArt(null)}
          />
          {confirm ? (
            <Button tone="danger" onClick={onRemove}>Delete {item.name}</Button>
          ) : (
            <Button tone="quiet" onClick={() => setConfirm(true)}>Delete</Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}

function TroubleEditor({
  folders,
  initial,
  onCancel,
  onSave,
}: {
  folders: TroubleFolder[];
  initial: Trouble;
  onCancel: () => void;
  onSave: (trouble: Trouble) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = (patch: Partial<Trouble>) => setDraft((current) => ({ ...current, ...patch }));
  return (
    <div className="grid gap-2">
      <TextField aria-label="Trouble name" placeholder="Name" value={draft.name} onChange={(event) => set({ name: event.target.value })} />
      <label className="grid gap-1 text-sm text-mute">
        Folder
        <select
          className="min-h-11 rounded-xl border border-line bg-ink px-3 text-paper"
          aria-label="Trouble folder"
          value={draft.folderId ?? ""}
          onChange={(event) => set({ folderId: event.target.value || null })}
        >
          <option value="">No folder</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>{folder.name}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <TextField aria-label="Hit points" inputMode="numeric" value={String(draft.hp)} onChange={(event) => set({ hp: Number(event.target.value) })} />
        <TextField aria-label="AC" inputMode="numeric" value={String(draft.ac)} onChange={(event) => set({ ac: Number(event.target.value) })} />
        <TextField aria-label="Attack bonus" inputMode="numeric" value={String(draft.attackBonus)} onChange={(event) => set({ attackBonus: Number(event.target.value) })} />
        <TextField aria-label="Damage" value={draft.damage} onChange={(event) => set({ damage: event.target.value })} />
      </div>
      <p className="text-xs text-mute">Attack bonus is added to a d12. Trouble has no hero stat line. Put the whole damage in the dice line, like 1d8+2.</p>
      <Area aria-label="Attacks and abilities" rows={3} placeholder="Attacks and abilities" value={draft.abilities} onChange={(event) => set({ abilities: event.target.value })} />
      <Area aria-label="Notes" rows={2} placeholder="Notes" value={draft.notes} onChange={(event) => set({ notes: event.target.value })} />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input className="h-5 w-5" type="checkbox" checked={draft.energyShield} onChange={(event) => set({ energyShield: event.target.checked })} />
        Energy shield
      </label>
      <TextField
        aria-label="Ignore AC"
        inputMode="numeric"
        placeholder="Ignore AC, if any"
        value={draft.ignoreAc == null ? "" : String(draft.ignoreAc)}
        onChange={(event) => {
          const raw = event.target.value.trim();
          set({ ignoreAc: raw === "" ? undefined : Number(raw) });
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => onSave({ ...draft, portraitPath: initial.portraitPath ?? null })}
        >
          Save trouble
        </Button>
        <Button tone="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
