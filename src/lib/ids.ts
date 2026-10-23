/** Stable ids so the demo company, tests, and a Supabase import agree. */
export const ID = {
  corbin: "10000000-0000-4000-8000-000000000001",
  trish: "10000000-0000-4000-8000-000000000002",
  justin: "10000000-0000-4000-8000-000000000003",
  table: "20000000-0000-4000-8000-000000000001",
  naibroch: "30000000-0000-4000-8000-000000000001",
  elowynne: "30000000-0000-4000-8000-000000000002",
  willow: "30000000-0000-4000-8000-000000000003",
  mystie: "30000000-0000-4000-8000-000000000004",
  emma: "30000000-0000-4000-8000-000000000005",
  nixy: "30000000-0000-4000-8000-000000000006",
  rob: "30000000-0000-4000-8000-000000000007",
  apple: "30000000-0000-4000-8000-000000000008",
  grino: "30000000-0000-4000-8000-000000000009",
  reginald: "30000000-0000-4000-8000-00000000000a",
} as const;

export const DEMO_CODE = "SEAL6";

export const DEMO_PLAYERS = [
  { id: ID.corbin, displayName: "Corbin", email: "corbin@table.local" },
  { id: ID.trish, displayName: "Trish", email: "trish@table.local" },
  { id: ID.justin, displayName: "Justin", email: "justin@table.local" },
] as const;
