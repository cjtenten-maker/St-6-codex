import type { Metadata } from "next";
import Link from "next/link";
import { Card, Kicker } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms · ST-6 Codex",
  description: "ST-6 Codex is provided as-is for personal use.",
};

export default function TermsPage() {
  return (
    <main className="mx-auto grid w-full max-w-lg gap-4 px-4 py-8">
      <Link href="/" className="text-sm text-mute">
        ← Codex
      </Link>
      <header>
        <Kicker>ST-6 Codex</Kicker>
        <h1 className="font-display text-4xl">Terms</h1>
        <p className="mt-2 text-sm text-mute">Last updated October 24, 2026.</p>
      </header>
      <Card>
        <p>ST-6 Codex is provided as-is for personal use by Corbin Young’s gaming group.</p>
        <p className="mt-3">
          It is a hobby app for one home game. It comes with no warranty. You are responsible for what you write on a sheet or in a note.
        </p>
        <p className="mt-3">
          Questions:{" "}
          <a className="text-brass" href="mailto:cjtenten@gmail.com">
            cjtenten@gmail.com
          </a>
          .
        </p>
      </Card>
    </main>
  );
}
