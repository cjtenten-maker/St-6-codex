import { describe, expect, it } from "vitest";
import { isMissingClaimRpc, isStorageTriggerBlock } from "./supabase";

describe("claim and portrait delete errors", () => {
  it("notices when claim_character is not on the database yet", () => {
    expect(isMissingClaimRpc({ code: "PGRST202", message: "Could not find the function public.claim_character" })).toBe(true);
    expect(isMissingClaimRpc({ message: "Could not find the function public.claim_character(p_character_id) in the schema cache" })).toBe(true);
    expect(isMissingClaimRpc({ code: "PGRST205", message: "Could not find the table public.trouble" })).toBe(false);
  });

  it("notices the storage.objects trigger that blocks a character delete", () => {
    expect(isStorageTriggerBlock({ message: "Direct deletion from storage tables is not allowed. Use the Storage API. protect_delete" })).toBe(true);
    expect(isStorageTriggerBlock({ message: "permission denied for table characters" })).toBe(false);
  });
});
