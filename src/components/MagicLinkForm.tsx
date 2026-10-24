"use client";

import { useEffect, useState } from "react";
import { useCodex } from "./CodexProvider";
import { Button, TextField } from "./ui";

const EMAIL_KEY = "st6-auth-email";

function storedEmail(): string {
  try {
    return sessionStorage.getItem(EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

export function MagicLinkForm({ showGoogle = false }: { showGoogle?: boolean }) {
  const codex = useCodex();
  const [email, setEmail] = useState("");
  useEffect(() => {
    setEmail(storedEmail());
  }, []);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    codex.setNotice(null);
    try {
      await work();
    } catch (error) {
      const message = error instanceof Error ? error.message : "We couldn't finish signing you in. Send yourself a new link.";
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3">
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await codex.signInEmail(email);
            setStatus("Check your email for the sign-in link. It works from Mail, even in the in-app browser.");
          });
        }}
      >
        <TextField
          type="email"
          required
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-label="Email"
          autoComplete="email"
        />
        <Button type="submit" disabled={busy}>
          Email me a link
        </Button>
      </form>
      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await codex.signInWithCode(email, code);
            if (window.location.pathname.startsWith("/auth/")) window.location.replace("/");
          });
        }}
      >
        <TextField
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code, if the email shows one"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-label="Email code"
          maxLength={10}
        />
        <Button type="submit" tone="ghost" disabled={busy}>
          Use code
        </Button>
      </form>
      {showGoogle ? (
        <Button type="button" tone="ghost" disabled={busy} onClick={() => void run(() => codex.signInGoogle())}>
          Continue with Google
        </Button>
      ) : null}
      {status ? <p className="text-sm text-paper">{status}</p> : null}
      <p className="text-xs text-mute">The link is enough. The code is only there if the email shows six digits.</p>
    </div>
  );
}
