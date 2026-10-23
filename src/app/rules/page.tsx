import Link from "next/link";
import { ARMORS, SHIELDS, SPELLS, WEAPONS } from "@/lib/data/catalog";
import { Card, Kicker } from "@/components/ui";

export default function RulesPage() {
  return (
    <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-8 lg:max-w-3xl">
      <Link href="/" className="text-sm text-mute">← Codex</Link>
      <header>
        <Kicker>ST-6 d12</Kicker>
        <h1 className="font-display text-4xl">The sheet</h1>
      </header>
      <Card>
        <Kicker>To hit</Kicker>
        <p className="mt-2">d12 + the weapon's stat against AC. Higher is full damage. A tie is half, rounded down. Lower is a miss. A natural 12 is full potential: maximum dice plus the bonus, even if the total would have missed. A natural 1 is not an automatic miss. An energy sword overheats on a natural 1.</p>
      </Card>
      <Card>
        <Kicker>Damage</Kicker>
        <p className="mt-2">The bonus is half the stat, rounded down. Heavy weapons use Strength, precision and ranged use Combat, magical and hybrid use Arcana. A Combat of 11 adds 5, not 11. Judge's Edge and Grino's shota add the full stat. Everything else, including Elowynne's attack spells, adds half.</p>
      </Card>
      <Card>
        <Kicker>Mana</Kicker>
        <p className="mt-2">Maximum mana is Arcana × 2. Spend the mana, then roll d12 + Arcana against a DC, usually 10, 12, or 15. A miss fizzles and the mana stays spent. A natural 12 is a potent success: maximum dice. A hero point can reroll the cast without spending the mana again.</p>
      </Card>
      <Card>
        <Kicker>Hero points</Kicker>
        <p className="mt-2">Start each session at 3. Cap at 8. Spend one to reroll a d12 and keep the new result, to add +4 after seeing the d12, or to seize a small narrative beat. A new session sets seated heroes back to 3.</p>
      </Card>
      <Card>
        <Kicker>Tags and rests</Kicker>
        <p className="mt-2">Three to five tags. A tag that fits is +2, declared before the roll, or +1 AC if you hold it defensively. A short rest restores mana equal to Arcana (at least 1) and no hit points. A long rest fills hit points and mana. Both clear temporary AC and a defensive tag. An energy shield swallows one full-potential hit, then drops.</p>
      </Card>
      <Card>
        <Kicker>Making a hero</Kicker>
        <p className="mt-2">Roll five sets of 3d4, drop the lowest total, assign the other four to Charisma, Strength, Combat, and Arcana. Roll 5d10 for hit points and drop the lowest die. The usual range is 3–12, and AC from the list is 10–20. A number written outside that range stays as written.</p>
      </Card>
      <Card>
        <Kicker>The table</Kicker>
        <p className="mt-2">No initiative roll. The GM picks which side goes first. Players reorder themselves, then trouble goes. Twelve heroes can sit. Forty-eight can be saved. Someone sitting out keeps their hit points, mana, hero points, and notes. Rests, a new session, and trouble only touch the seats. The GM's own characters sit out. Up to four people can be marked GM-eligible, and the notes on the screen pass to the next GM.</p>
      </Card>

      <h2 className="mt-4 font-display text-3xl">Weapons</h2>
      <div className="grid gap-2">
        {WEAPONS.map((weapon) => (
          <Card key={weapon.id}>
            <h3>{weapon.name}</h3>
            <p className="text-sm text-mute">{weapon.damage} · to hit {weapon.hitStat === "none" ? "no stat" : weapon.hitStat} · damage bonus {weapon.bonusMode === "none" ? "none" : `half ${weapon.bonusStat ?? weapon.hitStat}`}</p>
            <p className="mt-1 text-sm">{weapon.notes}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-4 font-display text-3xl">Armor and shields</h2>
      <div className="grid gap-2">
        {ARMORS.map((armor) => (
          <Card key={armor.id}>
            <h3>{armor.name}</h3>
            <p className="text-sm text-mute">AC {armor.ac}. {armor.notes}</p>
          </Card>
        ))}
        {SHIELDS.filter((shield) => shield.bonus || shield.energyShield).map((shield) => (
          <Card key={shield.id}>
            <h3>{shield.name}</h3>
            <p className="text-sm text-mute">+{shield.bonus} AC, and the stack stops at 20. {shield.notes}</p>
          </Card>
        ))}
      </div>

      <h2 className="mt-4 font-display text-3xl">Spells</h2>
      <p className="text-sm text-mute">Rename them to fit the hero. The company sheets already have.</p>
      {(["Basic", "Standard", "Powerful"] as const).map((tier) => (
        <section key={tier} className="grid gap-2">
          <h3 className="font-display text-2xl">{tier}</h3>
          {SPELLS.filter((spell) => spell.tier === tier).map((spell) => (
            <Card key={spell.id}>
              <h3>{spell.name} · {spell.cost}</h3>
              <p className="text-sm">{spell.effect}</p>
              <p className="text-sm text-mute">{spell.range}{spell.notes ? ` · ${spell.notes}` : ""}</p>
            </Card>
          ))}
        </section>
      ))}
    </main>
  );
}
