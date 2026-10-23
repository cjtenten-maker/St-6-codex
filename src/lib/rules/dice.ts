import { RuleError } from "./errors";

export type DiceTerm =
  | { kind: "die"; count: number; sides: number }
  | { kind: "flat"; value: number };

/** Read `2d6+1d4+3`. Empty means no dice. */
export function parseExpression(input: string): DiceTerm[] {
  const expr = input.replace(/\s+/g, "").replace(/−/g, "-").toLowerCase();
  if (!expr || expr === "—" || expr === "-" || expr === "0") return [];
  if (!/^(\d+d\d+|\d+)([+-](\d+d\d+|\d+))*$/.test(expr)) {
    throw new RuleError(`Can't read dice "${input}". Try 2d6+3.`);
  }
  return expr.split(/(?=[+-])/).map((part) => {
    const sign = part.startsWith("-") ? -1 : 1;
    const body = part.replace(/^[+-]/, "");
    const die = /^(\d+)d(\d+)$/.exec(body);
    if (die) {
      const count = Number(die[1]) * sign;
      const sides = Number(die[2]);
      if (count < 1 || count > 40 || sides < 2 || sides > 100) {
        throw new RuleError(`Dice "${part}" are out of range.`);
      }
      return { kind: "die" as const, count, sides };
    }
    return { kind: "flat" as const, value: Number(body) * sign };
  });
}

export function maxDice(expression: string): number {
  return parseExpression(expression).reduce((sum, term) => {
    if (term.kind === "flat") return sum + term.value;
    return sum + term.count * term.sides;
  }, 0);
}

export type DiceRoll = { total: number; faces: number[]; text: string };

export function rollDice(
  expression: string,
  rng: () => number = Math.random,
  fixedFaces?: number[],
): DiceRoll {
  const terms = parseExpression(expression);
  const faces: number[] = [];
  let cursor = 0;
  let total = 0;
  const bits: string[] = [];
  for (const term of terms) {
    if (term.kind === "flat") {
      total += term.value;
      bits.push(formatSigned(term.value, bits.length === 0));
      continue;
    }
    const rolled: number[] = [];
    for (let i = 0; i < term.count; i++) {
      const face =
        fixedFaces && cursor < fixedFaces.length
          ? fixedFaces[cursor++]
          : 1 + Math.floor(rng() * term.sides);
      if (!Number.isInteger(face) || face < 1 || face > term.sides) {
        throw new RuleError(`A d${term.sides} only shows 1 through ${term.sides}.`);
      }
      rolled.push(face);
    }
    faces.push(...rolled);
    const sub = rolled.reduce((a, b) => a + b, 0);
    total += sub;
    bits.push(rolled.join("+"));
  }
  return { total, faces, text: bits.filter(Boolean).join(" + ") || "0" };
}

function formatSigned(value: number, first: boolean): string {
  if (first) return String(value);
  return value < 0 ? `− ${Math.abs(value)}` : String(value);
}

export function assertD12(face: number): void {
  if (!Number.isInteger(face) || face < 1 || face > 12) {
    throw new RuleError("A d12 shows 1 through 12.");
  }
}

/** One die, 1 through `sides`. */
export function rollDie(sides: number, rng: () => number): number {
  return 1 + Math.floor(rng() * sides);
}
