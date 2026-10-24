"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createLocalApi, type Viewer } from "@/lib/backend/local";
import { createBrowserStore } from "@/lib/backend/memory";
import { consumeAuthCallback } from "@/lib/auth/callback";
import { chooseTableMode } from "@/lib/auth/mode";
import { authCallbackClient, createSupabaseApi, supabaseConfigured } from "@/lib/backend/supabase";
import { DEMO_CODE } from "@/lib/ids";
import type { Action, TableState } from "@/lib/model";
import { RuleError } from "@/lib/rules/errors";

const VIEWER_KEY = "st6-viewer";
const DEMO_KEY = "st6-force-local";

type Codex = {
  mode: "local" | "supabase";
  supabaseConfigured: boolean;
  ready: boolean;
  viewer: Viewer | null;
  tables: { code: string; name: string }[];
  notice: string | null;
  setNotice: (notice: string | null) => void;
  signInLocal: (viewer: Viewer) => void;
  signInGuest: (name: string) => void;
  signInEmail: (email: string) => Promise<void>;
  signInWithCode: (email: string, code: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  refreshTables: () => Promise<void>;
  openDemo: () => string;
  createTable: (name: string, seed: boolean) => Promise<string>;
  load: (code: string) => Promise<TableState | null>;
  watch: (tableId: string, onChange: () => void) => () => void;
  dispatch: (code: string, action: Action) => Promise<TableState>;
  exportJson: (code: string) => Promise<string>;
  importTable: (raw: string) => Promise<string>;
  useLocalDemo: () => void;
  exitLocalDemo: () => void;
};

const CodexContext = createContext<Codex | null>(null);

export function useCodex(): Codex {
  const value = useContext(CodexContext);
  if (!value) throw new Error("Codex is not ready.");
  return value;
}

function message(error: unknown): string {
  if (error instanceof RuleError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function CodexProvider({ children }: { children: React.ReactNode }) {
  const remoteAvailable = supabaseConfigured();
  const local = useMemo(() => createLocalApi(createBrowserStore()), []);
  const remote = useMemo(() => (remoteAvailable ? createSupabaseApi() : null), [remoteAvailable]);
  const [forceLocal, setForceLocal] = useState(false);
  const [bootId, setBootId] = useState(0);
  const [ready, setReady] = useState(false);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [tables, setTables] = useState<{ code: string; name: string }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const mode = chooseTableMode({ configured: Boolean(remote), demo: forceLocal });

  const refreshTables = useCallback(async () => {
    if (mode === "local") {
      if (viewer) local.ensureDemo();
      setTables(local.listTables());
      return;
    }
    if (!viewer || !remote) {
      setTables([]);
      return;
    }
    setTables(await remote.listTables());
  }, [local, mode, remote, viewer]);

  useEffect(() => {
    let stop = () => {};
    let cancel = false;
    const boot = async () => {
      const forced = sessionStorage.getItem(DEMO_KEY) === "1";
      if (!cancel) setForceLocal(forced);
      try {
        if (remote && !forced) {
          try {
            const callback = await consumeAuthCallback(authCallbackClient());
            if (!cancel && !callback.ok && !window.location.pathname.startsWith("/auth/callback")) setNotice(callback.message);
            if (!cancel) setViewer(await remote.getViewer());
            if (!cancel) {
              stop = remote.onAuth((next) => {
                if (!cancel) setViewer(next);
              });
            }
          } catch (error) {
            if (!cancel) {
              setViewer(null);
              setNotice(message(error));
            }
          }
        } else {
          const raw = sessionStorage.getItem(VIEWER_KEY);
          if (raw) {
            try {
              const stored = JSON.parse(raw) as Viewer;
              local.setViewer(stored);
              if (!cancel) setViewer(stored);
            } catch {
              sessionStorage.removeItem(VIEWER_KEY);
              if (!cancel) setViewer(null);
            }
          } else if (!cancel) {
            local.clearViewer();
            setViewer(null);
          }
        }
      } finally {
        if (!cancel) setReady(true);
      }
    };
    void boot();
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
    return () => {
      cancel = true;
      stop();
    };
  }, [bootId, local, remote]);

  useEffect(() => {
    if (!ready) return;
    void refreshTables().catch((error: unknown) => setNotice(message(error)));
  }, [ready, refreshTables]);

  const signInLocal = useCallback(
    (next: Viewer) => {
      sessionStorage.setItem(VIEWER_KEY, JSON.stringify(next));
      local.setViewer(next);
      setViewer(next);
    },
    [local],
  );

  const api = useMemo<Codex>(() => {
    return {
      mode,
      supabaseConfigured: Boolean(remote),
      ready,
      viewer,
      tables,
      notice,
      setNotice,
      signInLocal,
      signInGuest(name: string) {
        const clean = name.trim();
        if (!clean) {
          setNotice("Tell the table what to call you.");
          return;
        }
        signInLocal({ id: crypto.randomUUID(), displayName: clean, email: "" });
      },
      async signInEmail(email: string) {
        if (!remote) throw new RuleError("This demo has no mail yet. Pick a seat instead.");
        await remote.signInEmail(email);
      },
      async signInWithCode(email: string, code: string) {
        if (!remote) throw new RuleError("This demo has no mail yet. Pick a seat instead.");
        await remote.signInWithCode(email, code);
        const next = await remote.getViewer();
        setViewer(next);
      },
      async signInGoogle() {
        if (!remote) throw new RuleError("Google sign-in waits until Supabase is connected.");
        await remote.signInGoogle();
      },
      async signOut() {
        if (mode === "supabase" && remote) await remote.signOut();
        sessionStorage.removeItem(VIEWER_KEY);
        local.clearViewer();
        setViewer(null);
        setTables([]);
      },
      async updateName(name: string) {
        if (!remote || mode !== "supabase") return;
        await remote.updateName(name);
        const next = await remote.getViewer();
        setViewer(next);
      },
      refreshTables,
      openDemo() {
        return local.ensureDemo();
      },
      async createTable(name: string, seed: boolean) {
        if (!viewer) throw new RuleError("Pick who is holding this phone.");
        const code = mode === "local" || !remote ? local.createTable(name, seed) : await remote.createTable(name, seed);
        await refreshTables();
        return code;
      },
      async load(code: string) {
        const key = code.toUpperCase();
        if (mode === "local" || !remote) {
          if (key === DEMO_CODE) local.ensureDemo();
          const existing = local.load(key);
          if (!existing) return null;
          if (viewer && !existing.members.some((member) => member.id === viewer.id)) {
            local.dispatch(key, { type: "join", member: viewer });
          }
          return local.load(key);
        }
        if (!viewer) return null;
        try {
          await remote.join(key);
        } catch (error) {
          if (error instanceof RuleError && /no table/i.test(error.message)) return null;
          throw error;
        }
        return remote.load(key, viewer.id);
      },
      watch(tableId: string, onChange: () => void) {
        if (mode === "local" || !remote) return local.subscribe(onChange);
        return remote.subscribe(tableId, onChange);
      },
      async dispatch(code: string, action: Action) {
        if (!viewer) throw new RuleError("Pick who is holding this phone.");
        if (mode === "local" || !remote) return local.dispatch(code, action);
        return remote.dispatch(code, action, viewer);
      },
      async exportJson(code: string) {
        if (mode === "local" || !remote) return local.exportJson(code);
        return remote.exportJson(code, viewer?.id ?? null);
      },
      async importTable(raw: string) {
        if (!viewer) throw new RuleError("Pick who is holding this phone.");
        const code = mode === "local" || !remote ? local.importJson(raw) : await remote.importJson(raw, viewer);
        await refreshTables();
        return code;
      },
      useLocalDemo() {
        sessionStorage.setItem(DEMO_KEY, "1");
        setForceLocal(true);
        setViewer(null);
        setBootId((value) => value + 1);
      },
      exitLocalDemo() {
        sessionStorage.removeItem(DEMO_KEY);
        sessionStorage.removeItem(VIEWER_KEY);
        local.clearViewer();
        setForceLocal(false);
        setViewer(null);
        setBootId((value) => value + 1);
      },
    };
  }, [local, mode, notice, ready, refreshTables, remote, signInLocal, tables, viewer]);

  return (
    <CodexContext.Provider value={api}>
      {children}
      <Notice text={notice} onClose={() => setNotice(null)} />
    </CodexContext.Provider>
  );
}

export function useTable(code: string) {
  const codex = useCodex();
  const router = useRouter();
  const [state, setState] = useState<TableState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [live, setLive] = useState(false);

  const reload = useCallback(async () => {
    const next = await codex.load(code);
    setState(next);
    setMissing(!next);
    return next;
  }, [code, codex]);

  useEffect(() => {
    if (!codex.ready) return;
    if (!codex.viewer) {
      router.replace(`/?next=${encodeURIComponent(`/t/${code}`)}`);
      return;
    }
    let stop = () => {};
    let timer = 0;
    let ignore = false;
    const run = async () => {
      try {
        const next = await reload();
        if (ignore || !next) return;
        stop = codex.watch(next.table.id, () => {
          setLive(true);
          window.clearTimeout(timer);
          timer = window.setTimeout(() => setLive(false), 1400);
          void reload().catch((caught: unknown) => setError(message(caught)));
        });
      } catch (caught) {
        if (!ignore) setError(message(caught));
      }
    };
    void run();
    return () => {
      ignore = true;
      stop();
      window.clearTimeout(timer);
    };
  }, [code, codex, reload, router]);

  const dispatch = useCallback(
    async (action: Action) => {
      try {
        const next = await codex.dispatch(code, action);
        setState(next);
        setError(null);
        return next;
      } catch (caught) {
        const text = message(caught);
        setError(text);
        throw new RuleError(text);
      }
    },
    [code, codex],
  );

  return { state, error, setError, missing, live, dispatch, viewer: codex.viewer, mode: codex.mode };
}

export function Notice({ text, onClose }: { text: string | null; onClose: () => void }) {
  if (!text) return null;
  return (
    <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-lg rounded-2xl border border-brass/40 bg-panel px-4 py-3 text-sm shadow-card">
      <div className="flex items-start justify-between gap-3">
        <p>{text}</p>
        <button className="text-mute" onClick={onClose} type="button">
          Close
        </button>
      </div>
    </div>
  );
}
