"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DEMO_PLAYERS } from "@/lib/ids";
import { hasJoinedTable, lastTable, rememberTable } from "@/lib/table/identity";
import { useCodex } from "./CodexProvider";
import { MagicLinkForm } from "./MagicLinkForm";
import { Button, Card, Kicker, TextField } from "./ui";

export function HomeScreen() {
  const codex = useCodex();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const [guest, setGuest] = useState("");
  const [tableName, setTableName] = useState("Thursday table");
  const [joinCode, setJoinCode] = useState("");
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(params.get("create") === "1");
  const [confirmCreate, setConfirmCreate] = useState(false);
  const [pendingImport, setPendingImport] = useState<string | null>(null);

  const go = (href: string) => {
    const match = href.match(/^\/t\/([A-Za-z0-9]{4,8})/);
    if (match) rememberTable(match[1]);
    router.push(next && next.startsWith("/t/") ? next : href);
  };

  const joinRequested = params.get("join") === "1";
  const createRequested = params.get("create") === "1";

  useEffect(() => {
    if (joinRequested) document.getElementById("join-code")?.focus();
  }, [joinRequested, codex.viewer]);

  useEffect(() => {
    if (!codex.ready || !codex.viewer) return;
    if (joinRequested || createRequested || params.get("next")) return;
    const saved = lastTable();
    if (!saved) return;
    if (!codex.tables.some((table) => table.code.toUpperCase() === saved)) return;
    router.replace(`/t/${saved}`);
  }, [codex.ready, codex.tables, codex.viewer, createRequested, joinRequested, params, router]);

  const run = async (work: () => Promise<void> | void) => {
    setBusy(true);
    codex.setNotice(null);
    try {
      await work();
    } catch (error) {
      codex.setNotice(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (!codex.ready) {
    return <div className="min-h-dvh" />;
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <header>
        <Kicker>Field codex</Kicker>
        <h1 className="mt-1 font-display text-5xl font-medium tracking-tight text-paper">ST-6</h1>
        <p className="mt-2 max-w-sm text-mute">
          A seat on every phone. One GM tonight. The d12 does the arithmetic.
        </p>
      </header>

      {codex.mode === "local" ? (
        <Card>
          <Kicker>This phone</Kicker>
          <p className="mt-2 text-sm text-mute">
            {codex.supabaseConfigured
              ? "Practice table on this phone. The other phones are on the signed-in table."
              : "Local demo. No account. Open the same table in another tab and pick someone else — that second seat updates live. Across real phones, connect Supabase. The steps are in the README."}
          </p>
          {codex.supabaseConfigured ? (
            <Button className="mt-4 w-full" tone="ghost" onClick={() => codex.exitLocalDemo()}>
              Sign in with email instead
            </Button>
          ) : null}
          <div className="mt-4 grid gap-2">
            {DEMO_PLAYERS.map((player) => (
              <Button
                key={player.id}
                tone={codex.viewer?.id === player.id ? "brass" : "ghost"}
                onClick={() => codex.signInLocal({ ...player })}
              >
                {player.displayName}
                {codex.viewer?.id === player.id ? " · holding this phone" : ""}
              </Button>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              codex.signInGuest(guest);
            }}
          >
            <TextField
              aria-label="Another name"
              placeholder="Someone else"
              value={guest}
              onChange={(event) => setGuest(event.target.value)}
            />
            <Button type="submit" tone="ghost">
              Sit
            </Button>
          </form>
        </Card>
      ) : (
        <Card>
          <Kicker>Sign in</Kicker>
          <p className="mt-2 text-sm text-mute">
            A magic link, or Google. No password. The link signs you in even if Mail opens it in its own browser. After that, join with the code they send you.
          </p>
          {codex.viewer ? (
            <p className="mt-3">
              Signed in as <span className="text-brass">{codex.viewer.displayName}</span>
            </p>
          ) : (
            <div className="mt-4">
              <MagicLinkForm showGoogle />
            </div>
          )}
          <button
            className="mt-4 text-left text-sm text-mute underline decoration-line underline-offset-4"
            type="button"
            onClick={() => codex.useLocalDemo()}
          >
            Practice on this phone instead
          </button>
        </Card>
      )}

      {codex.viewer ? (
        <>
          <Card className="border-brass/70">
            <h2 className="font-display text-3xl font-medium leading-tight">Join a table with a code</h2>
            <p className="mt-2 text-sm text-mute">
              Use the code from the person who already opened the table. A second table with the same name is a different table, with its own roster.
            </p>
            <form
              className="mt-4 grid gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const code = joinCode.trim().toUpperCase();
                if (!/^[A-Z0-9]{4,8}$/.test(code)) {
                  codex.setNotice("Codes are 4 to 8 letters or numbers.");
                  return;
                }
                go(`/t/${code}`);
              }}
            >
              <TextField
                id="join-code"
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                placeholder="Invite code"
                aria-label="Invite code"
                maxLength={8}
                className="text-center font-display text-2xl tracking-[0.22em]"
              />
              <Button type="submit" className="w-full">
                Join
              </Button>
            </form>
          </Card>

          <Card>
            <Kicker>Your tables</Kicker>
            <div className="mt-3 grid gap-2">
              {codex.mode === "local" ? (
                <Button
                  tone="ghost"
                  onClick={() => {
                    const code = codex.openDemo();
                    go(`/t/${code}`);
                  }}
                >
                  Open Seal Team-6 · SEAL6
                </Button>
              ) : null}
              {codex.tables
                .filter((table) => codex.mode === "supabase" || table.code !== "SEAL6")
                .map((table) => (
                  <Button key={table.code} tone="ghost" onClick={() => go(`/t/${table.code}`)}>
                    {table.name}
                    <span className="text-mute">
                      {" "}
                      · {table.code} · {table.creatorName}
                    </span>
                  </Button>
                ))}
              {!hasJoinedTable(codex.tables) ? (
                <p className="text-sm text-mute">You are not in a table yet. Join with the code above.</p>
              ) : null}
            </div>
          </Card>

          {showCreate ? (
            <Card>
              <Kicker>A separate table</Kicker>
              <p className="mt-2 text-sm text-mute">
                This does not join a table someone else opened. Importing a roster starts a new table too.
              </p>
              <form
                className="mt-3 grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!hasJoinedTable(codex.tables) && !confirmCreate) {
                    setConfirmCreate(true);
                    return;
                  }
                  void run(async () => {
                    const code = await codex.createTable(tableName, seed);
                    go(`/t/${code}`);
                  });
                }}
              >
                <TextField value={tableName} onChange={(event) => setTableName(event.target.value)} aria-label="Table name" />
                <label className="flex items-center gap-2 text-sm text-mute">
                  <input type="checkbox" checked={seed} onChange={(event) => setSeed(event.target.checked)} />
                  Seat the ten characters from the sheets
                </label>
                {confirmCreate ? (
                  <div className="grid gap-2 rounded-xl border border-hp/40 bg-hp/10 p-3 text-sm">
                    <p>
                      You are not in a table yet. Creating one starts a separate table. Giving it the same name does not put you at the table that is already open. Ask for their code and join that one. Create a new table only if you are the person opening it.
                    </p>
                    <Button
                      type="button"
                      onClick={() => {
                        setConfirmCreate(false);
                        setShowCreate(false);
                        document.getElementById("join-code")?.focus();
                      }}
                    >
                      Join with a code instead
                    </Button>
                    <Button type="submit" tone="danger" disabled={busy}>
                      Create this new table anyway
                    </Button>
                  </div>
                ) : (
                  <Button type="submit" tone="ghost" disabled={busy}>
                    Create table
                  </Button>
                )}
              </form>
              <label className="mt-4 block text-sm text-mute">
                Import a roster into a new table
                <input
                  className="mt-2 block w-full text-paper"
                  type="file"
                  accept="application/json"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    void file.text().then((raw) => {
                      if (hasJoinedTable(codex.tables)) {
                        void run(async () => {
                          const code = await codex.importTable(raw);
                          go(`/t/${code}`);
                        });
                        return;
                      }
                      setPendingImport(raw);
                    });
                  }}
                />
              </label>
              {pendingImport ? (
                <div className="mt-3 grid gap-2 rounded-xl border border-hp/40 bg-hp/10 p-3 text-sm">
                  <p>
                    Importing starts a new table and copies the roster into it. It does not add you to the table that file came from. Join with that table&apos;s code instead.
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      setPendingImport(null);
                      document.getElementById("join-code")?.focus();
                    }}
                  >
                    Join with a code instead
                  </Button>
                  <Button
                    type="button"
                    tone="danger"
                    disabled={busy}
                    onClick={() => {
                      const raw = pendingImport;
                      if (!raw) return;
                      setPendingImport(null);
                      void run(async () => {
                        const code = await codex.importTable(raw);
                        go(`/t/${code}`);
                      });
                    }}
                  >
                    Import into a new table anyway
                  </Button>
                </div>
              ) : null}
            </Card>
          ) : (
            <button
              className="text-left text-sm text-mute underline decoration-line underline-offset-4"
              type="button"
              onClick={() => setShowCreate(true)}
            >
              Create a new table instead
            </button>
          )}

          <div className="flex items-center justify-between text-sm">
            <Link href="/rules" className="text-brass">
              Rules, weapons, spells
            </Link>
            <button className="text-mute" type="button" onClick={() => void codex.signOut()}>
              Set this phone down
            </button>
          </div>
        </>
      ) : (
        <Link href="/rules" className="text-sm text-brass">
          Read the rules without a seat
        </Link>
      )}

      <footer className="mt-auto flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
        <Link href="/privacy" className="underline decoration-line underline-offset-4">
          Privacy
        </Link>
        <Link href="/terms" className="underline decoration-line underline-offset-4">
          Terms
        </Link>
      </footer>

      <p className="text-xs text-mute">
        {codex.mode === "local"
          ? "Running locally in this browser. GM notes are hidden in the app until you hold the screen. Supabase is what locks them for real."
          : "Connected to Supabase. Each phone signs in and joins with the code."}
      </p>
      {busy ? <p className="text-sm text-mute">Working…</p> : null}
    </main>
  );
}
