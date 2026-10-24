import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { friendlyAuthError } from "./callback";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

export function createEmailLinkClient(url: string, key: string, fetchImpl?: typeof fetch): SupabaseClient {
  return createClient(url, key, {
    global: fetchImpl ? { fetch: fetchImpl } : undefined,
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: "st6-email-link",
      storage: memoryStorage(),
    },
  });
}

type VerifyResult = { error: { message: string; code?: string } | null };

export async function verifyEmailCode(
  verify: (args: { email: string; token: string; type: "magiclink" | "email" }) => Promise<VerifyResult>,
  email: string,
  token: string,
): Promise<void> {
  const magiclink = await verify({ email, token, type: "magiclink" });
  if (!magiclink.error) return;
  const emailOtp = await verify({ email, token, type: "email" });
  if (!emailOtp.error) return;
  throw new Error(friendlyAuthError(magiclink.error.message, magiclink.error.code));
}
