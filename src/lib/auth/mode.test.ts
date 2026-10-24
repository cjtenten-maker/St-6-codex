import { describe, expect, it } from "vitest";
import { chooseTableMode } from "./mode";

describe("chooseTableMode", () => {
  it("uses Supabase when the keys are present", () => {
    expect(chooseTableMode({ configured: true, demo: false })).toBe("supabase");
  });

  it("stays on Supabase after a failed sign-in", () => {
    expect(chooseTableMode({ configured: true, demo: false })).toBe("supabase");
  });

  it("uses the practice table only when someone asks for it, or when no keys exist", () => {
    expect(chooseTableMode({ configured: true, demo: true })).toBe("local");
    expect(chooseTableMode({ configured: false, demo: false })).toBe("local");
  });
});
