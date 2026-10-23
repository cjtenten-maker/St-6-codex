/** Hero points begin at 3. They cap at 8. A new session sets seated heroes back to 3. */
export const HERO_START = 3;
export const HERO_CAP = 8;

export function awardHeroPoint(current: number): number {
  return Math.min(HERO_CAP, current + 1);
}

export function spendHeroPoint(current: number): number {
  if (current < 1) {
    throw new Error("No hero points left.");
  }
  return current - 1;
}

export type RestSnapshot = {
  hp: number;
  hpMax: number;
  mana: number;
  arcana: number;
  tempAc: number;
  defenseTagActive: boolean;
};

export type RestResult = {
  hp: number;
  mana: number;
  tempAc: number;
  defenseTagActive: boolean;
};

/**
 * Short rest: mana increases by Arcana (at least 1), capped at Arcana × 2.
 * No hit points. Temporary AC and a defensive tag end.
 */
export function shortRest(snapshot: RestSnapshot, manaMax: number): RestResult {
  const gain = Math.max(snapshot.arcana, 1);
  return {
    hp: snapshot.hp,
    mana: Math.min(manaMax, snapshot.mana + gain),
    tempAc: 0,
    defenseTagActive: false,
  };
}

/** Long rest: all hit points and all mana. Temporary AC and a defensive tag end. */
export function longRest(snapshot: RestSnapshot, manaMax: number): RestResult {
  return {
    hp: snapshot.hpMax,
    mana: manaMax,
    tempAc: 0,
    defenseTagActive: false,
  };
}
