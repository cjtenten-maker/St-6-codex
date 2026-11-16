import { describe, expect, it } from "vitest";
import { creditsLog, formatUc, normalizeCredits } from "./credits";

describe("universal credits", () => {
  it("formats a whole number and treats a missing value as 0", () => {
    expect(formatUc(16600)).toBe("16,600 UC");
    expect(formatUc(0)).toBe("0 UC");
    expect(normalizeCredits(undefined)).toBe(0);
    expect(normalizeCredits(-4)).toBe(0);
    expect(normalizeCredits(12.8)).toBe(12);
  });

  it("logs the old total and the new one", () => {
    expect(creditsLog("Rob Goodfellow", 0, 16600)).toBe("Rob Goodfellow: 0 UC → 16,600 UC.");
  });
});
