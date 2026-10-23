import type { TableState } from "../model";

export type Db = { tables: Record<string, TableState> };

export type Store = {
  read(): Db;
  write(db: Db): void;
  subscribe(listener: () => void): () => void;
};

export function emptyDb(): Db {
  return { tables: {} };
}

export function createMemoryStore(initial?: Db): Store {
  let db = initial ?? emptyDb();
  const listeners = new Set<() => void>();
  return {
    read: () => db,
    write(next) {
      db = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const DB_KEY = "st6-codex-db-v1";

export function createBrowserStore(): Store {
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("st6-codex") : null;
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === DB_KEY) emit();
    });
    channel?.addEventListener("message", () => emit());
  }
  return {
    read() {
      if (typeof localStorage === "undefined") return emptyDb();
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDb();
      try {
        const parsed = JSON.parse(raw) as Db;
        if (!parsed.tables) return emptyDb();
        return parsed;
      } catch {
        return emptyDb();
      }
    },
    write(db) {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      channel?.postMessage({ at: Date.now() });
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
