/** Universal Credits. An old sheet with no number is 0. The inventory text is not parsed. */
export function normalizeCredits(amount: number | undefined): number {
  if (amount == null || !Number.isFinite(amount)) return 0;
  return Math.max(0, Math.trunc(amount));
}

/** 16600 becomes "16,600 UC". */
export function formatUc(amount: number): string {
  const whole = normalizeCredits(amount);
  return `${whole.toLocaleString("en-US")} UC`;
}

export function creditsLog(name: string, before: number, after: number): string {
  return `${name}: ${formatUc(before)} → ${formatUc(after)}.`;
}
