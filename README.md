# ST-6 Codex

A mobile table for Corbin's ST-6 d12 system. Each player keeps a character on their own phone. Only that player and the current GM can open the sheet. Everyone else at the table sees the name, the portrait, whether they are seated, and whether they are down. One GM-eligible player takes the screen for the night, and the next GM inherits the private notes and the sheets.

You can play the local demo before any account exists. Supabase is what connects separate phones. Vercel is what hosts it.

## Play the local demo

No Supabase, no Vercel, no passwords.

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

1. This phone asks who is holding it. Pick **Corbin**.
2. Open **Seal Team-6**. The code is `SEAL6`. The ten sheets from the brief are seated and unclaimed.
3. Open a second tab to the same address. Pick **Trish**. Open Seal Team-6 again.
4. On Trish's tab, claim Elowynne and change her hit points. Corbin's tab shows her name and, if she hits 0, Down. It does not show the number, and her sheet does not open.
5. On Elowynne's sheet, add a portrait. Corbin's tab shows the photo next to her name.
6. On Corbin's tab, tap **I'm GM tonight**. Naibroch sits out. Corbin can open Elowynne's sheet. The private note is on the GM screen. Trish does not see that note.
7. Trish taps **I'm GM tonight**. Elowynne sits out, Naibroch stays out, and the note is now hers. Corbin can no longer open Elowynne. He can still open Naibroch if he claimed him.

Justin is the third GM-eligible seat. A fourth person can be marked from the table. The company holds 48 characters and seats 12.

The local demo shares one browser. Two tabs behave like two players. Two phones on two networks need the Supabase steps below. The demo hides other sheets and GM notes the same way the live table does. They are not encrypted on that computer: the full table is still in this browser's storage so the GM handoff can work. Supabase is what actually locks them. A portrait in the demo stays on this computer. On Supabase it is a file in the character-art bucket, and everyone at the table can see it.

`npm test` runs the rules engine, the ten-character company, rests, seating, and the GM handoff.

`npm run build && npm start` is the production build.

## What the table enforces

- To hit: d12 + the weapon's stat against AC. Higher is full damage, a tie is half rounded down, lower is a miss.
- A natural 12 is full potential (maximum dice + bonus), even against a high AC. A natural 1 is not an automatic miss. An energy sword overheats on a natural 1.
- Damage bonus is half the stat, rounded down. Combat 11 adds 5. Judge's Edge and Grino's shota add the full stat. Elowynne's attack spells add half Arcana.
- Mana maximum is Arcana × 2. A cast spends mana, then rolls. A fizzle keeps the mana spent. A natural 12 is potent (maximum dice). Rerolling a cast does not spend mana again.
- Hero points start at 3 and cap at 8. Spend one to reroll (keep the new die), add +4 after the d12, or take a narrative beat. Starting a session sets **seated** heroes back to 3.
- A tag is +2, declared before the roll, or +1 AC if held defensively. New heroes carry 3 to 5 tags. The written scraps are allowed to have fewer.
- Short rest: seated heroes regain mana equal to Arcana (at least 1). No hit points. Temporary AC and a held defensive tag end.
- Long rest: seated heroes refill hit points and mana. The same clears.
- An energy shield swallows one full-potential hit, then drops.
- A new hero rolls five sets of 3d4, drops the lowest total, and assigns the other four. Hit points are 5d10, drop the lowest die. Armor plus a shield stops at AC 20. A handwritten AC, including Willow's 7, is kept.
- No initiative roll. The GM picks which side goes first. Players reorder themselves.
- The GM's own characters sit out. Unclaimed sheets still sit out when the name on the paper matches the person who took the screen (Corbin, Trish, Justin Ratsprit). That name does not open the sheet. Only a claim, or holding the GM screen, does.
- Other players see a character's name, portrait, whether they are seated, whether they are down (hit points at 0, not the number), and whether the sheet is claimed. They do not see who claimed it. Stats, tags, inventory, notes, abilities, weapons, spells, mana, armor class, and hero points stay with the owner and the current GM.
- Rests, the new session, and trouble strikes touch seated characters only.

Weapons, armor, shields, and the reference spell list are on the Rules page. Character spells keep the names from the sheets.

## The company

Seal Team-6 opens with all ten, numbers as written:

| Hero | Player on the sheet | Cha | Str | Com | Arc | HP | Mana | AC |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Naibroch Britheam | Corbin | 10 | 9 | 11 | 12 | 36 | 24 | 17 |
| Elowynne | Trish | 9 | 8 | 8 | 10 | 29 | 20 | 14 |
| Willow | — | 9 | 10 | 7 | 13 | 27 | 26 | 7 |
| Mystie | — | 7 | 8 | 8 | 10 | 31 | 20 | 6 |
| Emma | — | 12 | 11 | 10 | 10 | 34 | 20 | 6 |
| Nixy | — | 12 | 8 | 10 | 12 | 33 | 24 | 8 |
| Rob Goodfellow | Justin Ratsprit | 12 | 6 | 7 | 11 | 37 | 22 | 17 |
| Apple Pot | — | 10 | 11 | 10 | 10 | 28 | 20 | 10 |
| Grino | — | 6 | 8 | 8 | 8 | 32 | 16 | 17 |
| Reginald Crowe | — | 7 | 7 | 10 | 10 | 23 | 14/20 | 14 |

They belong to the table until someone taps Claim. Unexplained +2s (Emma's Charisma, Nixy's Arcana), Rob's suit, Mystie's shift, and the conditional +2 AC notes are recorded and not baked into the numbers, except the suit, which is on and can be taken off. Full-stat damage is only Judge's Edge and the shota.

## Export and import

On the table, **Export JSON** downloads the sheets you are allowed to open, plus trouble, the log, and the scene. GM notes are included only when you currently hold the screen. Other characters' sheets are left out. Importing a file that omitted them does not wipe notes already on the table.

The file looks like `{ "format": "st6-codex", "version": 1, ... }`.

## Connect Supabase

Do these once. Until both keys are set, the app stays in the local demo. After you set them, restart `npm run dev` or redeploy. Next.js bakes `NEXT_PUBLIC_` values in at build time.

Only the **anon** key goes in the app. Do not paste the service role key anywhere in Vercel or `.env.local`.

### 1. Create the project

1. Go to [https://supabase.com](https://supabase.com) and create a free account.
2. New project. Pick a name, a database password, and a region near you. Wait until it finishes provisioning.
3. In the left sidebar open **SQL Editor → New query**.
4. Paste the whole file `supabase/migrations/001_st6.sql` from this repo and run it. Then paste `supabase/migrations/002_character_privacy.sql` and run that too. You want "Success" at the bottom of each. If this project already ran 001, run only 002.
5. Open **Database → Publications**. `supabase_realtime` should include `tables`, `table_members`, `gm_notes`, `characters`, `character_cards`, `foes`, and `log_entries`. The SQL adds them. If a notice said it skipped that step, toggle those tables on by hand.
6. `002_character_privacy.sql` creates a private Storage bucket named `character-art` (5 MB, JPEG / PNG / WebP / GIF) and the policies on it. You do not create that bucket in the dashboard. The app downscales a photo to a JPEG before upload, including from the iPhone photo picker. Only the character's player and the current GM can change it, and only after the character is claimed. Everyone at the table can see it.

### 2. Turn on sign-in

1. **Authentication → Providers → Email**. Leave it enabled. No passwords; the app sends a magic link. Leave the email template on the default `{{ .ConfirmationURL }}`. The link signs you in even when Mail on an iPhone opens it in its own browser. If you later add `{{ .Token }}` to that template, the 6-digit box on the sign-in screen accepts it. You do not have to.
2. **Authentication → URL configuration**.
   - Site URL: `http://localhost:3000` while you are trying it on your machine. Change this to `https://YOUR-APP.vercel.app` after Vercel gives you a domain.
   - Add these redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `https://YOUR-APP.vercel.app/auth/callback`
3. The free project sends a small number of magic-link emails per hour. That covers a home table. If the link never arrives, open **Authentication → Emails** (or SMTP settings) and add your own mail provider later. Check spam the first time.

### 3. Google (optional, same Supabase project)

1. In [Google Cloud Console](https://console.cloud.google.com/) create or pick a project.
2. **APIs & Services → OAuth consent screen**. External is fine. Add your Gmail as a test user if the app stays in testing.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URI, exactly:

   `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`

   The project ref is in the Supabase URL (`https://abcdefgh.supabase.co` → `abcdefgh`). Supabase also shows this callback on the Google provider page.
5. Copy the client ID and client secret.
6. Back in Supabase: **Authentication → Providers → Google**. Enable it and paste both values. Save.

### 4. Paste the two keys

1. Supabase → **Project Settings → API**.
2. Copy **Project URL**.
3. Copy the **anon public** key. Not the service role.
4. In this repo, copy `.env.example` to `.env.local` and fill it:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...the anon key...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

5. Stop the dev server and start it again (`npm run dev`). The home page should ask for email instead of Corbin / Trish / Justin.
6. Sign in, create a table, leave **Seat the ten characters from the sheets** checked, and send the invite code. The other phone opens the same URL, signs in, and joins with that code.
7. There is a link on the sign-in card, **Use the local demo on this device instead**, if you want the no-account table back on that browser. It does not talk to Supabase.

## Deploy to Vercel

1. Push this repo to GitHub if it is not there already.
2. Go to [https://vercel.com](https://vercel.com), sign up, and **Add New → Project**. Import the repository.
3. Framework preset: Next.js. Leave the build command as `npm run build` and the output as Next's default.
4. Environment variables, before the first deploy (or redeploy after adding them):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...the anon key...
NEXT_PUBLIC_SITE_URL=https://YOUR-APP.vercel.app
```

Use the real Vercel domain. If you do not know it yet, deploy once, copy the domain, set `NEXT_PUBLIC_SITE_URL`, and redeploy. Changing these requires a new deploy, not just a refresh.

5. After the deploy is green, set Supabase **Site URL** to `https://YOUR-APP.vercel.app` and make sure `https://YOUR-APP.vercel.app/auth/callback` is in the redirect allow list. If those three variables are already set under those exact names, leave them. The names do not change, and the magic-link email template stays on the default `{{ .ConfirmationURL }}`.
6. Open the Vercel URL on a phone. The browser can install it (Add to Home Screen, or the install prompt). Sign in, create the table, share the code.

## Install on a phone

The app is a PWA: `manifest.webmanifest`, icons, and a service worker in production. On iPhone: Safari → Share → Add to Home Screen. On Android: Chrome → Install app, or the menu → Add to Home Screen.

## What you do by hand

These cannot be done from the repo. Everything else is already in the app.

1. Create a Supabase account and a project.
2. Run `supabase/migrations/001_st6.sql` in the SQL editor, then `supabase/migrations/002_character_privacy.sql`. The second file also creates the `character-art` bucket. Until 002 has been run, the live table will not open.
3. Copy the project URL and the anon key into `.env.local` and into Vercel.
4. In Supabase, set the Site URL and the `/auth/callback` redirect to your Vercel domain (and to localhost if you test sign-in on your machine).
5. Optional: create a Google OAuth client and paste its id and secret into Supabase's Google provider. The redirect there is `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`.
6. Create a Vercel account, import the repo, set the three environment variables, and deploy.

You do not create passwords, tables, or character rows by hand. You do not edit the magic-link email. The first signed-in player creates a table and seats the ten.
