"use client";

import { useEffect, useState } from "react";
import { consumeAuthCallback } from "@/lib/auth/callback";
import { authCallbackClient, supabaseConfigured } from "@/lib/backend/supabase";
import { MagicLinkForm } from "@/components/MagicLinkForm";
import { Card, Kicker } from "@/components/ui";

export default function AuthCallback() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured()) {
      window.location.replace("/");
      return;
    }
    let cancel = false;
    void consumeAuthCallback(authCallbackClient()).then((result) => {
      if (cancel) return;
      if (result.ok) {
        window.location.replace(result.next);
        return;
      }
      setMessage(result.message);
    });
    return () => {
      cancel = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-5 px-4 py-8">
      <header>
        <Kicker>Sign in</Kicker>
        <h1 className="mt-1 font-display text-4xl font-medium tracking-tight text-paper">
          {message ? "Send a new link" : "Signing you in"}
        </h1>
        <p className="mt-2 text-mute">{message ?? "Finishing the email link on this device."}</p>
      </header>
      {message ? (
        <Card>
          <MagicLinkForm />
        </Card>
      ) : null}
    </main>
  );
}
