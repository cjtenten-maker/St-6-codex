import type { Character } from "../model";
import { effectiveAc } from "../model";

/** A hero another character can swing at. Armor class already includes temporary AC and a defensive tag. */
export type AllyTarget = {
  id: string;
  name: string;
  ac: number;
  energyShield: boolean;
};

/**
 * Seated heroes other than the attacker.
 * A public card is included only once it carries a strike profile, so a missing
 * migration cannot offer AC 0.
 */
export function allyTargets(characters: Character[], attackerId: string): AllyTarget[] {
  const targets: AllyTarget[] = [];
  for (const character of characters) {
    if (character.id === attackerId || !character.seated) continue;
    if (character.concealed) {
      if (!character.strike) continue;
      targets.push({
        id: character.id,
        name: character.name,
        ac: character.strike.ac,
        energyShield: character.strike.energyShield,
      });
      continue;
    }
    targets.push({
      id: character.id,
      name: character.name,
      ac: effectiveAc(character),
      energyShield: character.energyShield,
    });
  }
  return targets;
}

export function allyAttackLog(attacker: string, ally: string, detail: string): string {
  return `${attacker} attacks ${ally} (ally): ${detail}`;
}

export function foeAttackLog(attacker: string, foe: string, detail: string): string {
  return `${attacker} attacks ${foe} (foe). ${detail}`;
}
