"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/backend/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured()) {
      router.replace("/");
      return;
    }
    const supabase = getSupabase();
    const code = new URLSearchParams(window.location.search).get("code");
    const finish = () => router.replace("/");
    if (!code) {
      finish();
      return;
    }
    void supabase.auth.exchangeCodeForSession(code).then(({ error: authError }) => {
      if (authError) setError(authError.message);
      else finish();
    });
  }, [router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <p>{error ?? "Signing you in…"}</p>
    </main>
  );
}
