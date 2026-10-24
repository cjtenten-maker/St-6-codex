import type { Metadata } from "next";
import Link from "next/link";
import { Card, Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy · ST-6 Codex",
  description: "What ST-6 Codex stores, and how to ask Corbin Young to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-8">
      <Link href="/" className="text-sm text-mute">
        ← Codex
      </Link>
      <header>
        <Kicker>ST-6 Codex</Kicker>
        <h1 className="font-display text-4xl">Privacy</h1>
        <p className="mt-2 text-sm text-mute">A hobby companion for Corbin Young’s gaming group. Last updated October 24, 2026.</p>
      </header>
      <Card>
        <p>
          Sign-in is by email magic link or Google, through Supabase. That is only so the table can tell players apart. There is no password.
        </p>
        <p className="mt-3">
          We store your email, your display name, and the game data you put in the app: characters, tables, and notes.
        </p>
        <p className="mt-3">We do not sell or share that information. There are no ads and no tracking.</p>
        <p className="mt-3">The app is hosted on Vercel. Accounts and game data are hosted on Supabase.</p>
        <p className="mt-3">
          To delete your data, email{" "}
          <a className="text-brass" href="mailto:cjtenten@gmail.com">
            cjtenten@gmail.com
          </a>
          .
        </p>
      </Card>
    </main>
  );
}
