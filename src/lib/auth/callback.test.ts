import { createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";
import {
  applyAuthCallback,
  consumeAuthCallback,
  friendlyAuthError,
  friendlySendError,
  prepareBrowserLocation,
  readAuthCallback,
  resetAuthCallbackState,
  stripAuthCallbackUrl,
  type AuthCallbackClient,
} from "./callback";
import { createEmailLinkClient, verifyEmailCode } from "./email-link";

const PKCE_MESSAGE =
  "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.";

afterEach(() => {
  resetAuthCallbackState();
});

function auth(partial: Partial<AuthCallbackClient> = {}): AuthCallbackClient {
  return {
    setSession: async () => ({ error: null }),
    exchangeCodeForSession: async () => ({ error: null }),
    verifyOtp: async () => ({ error: null }),
    ...partial,
  };
}

describe("readAuthCallback", () => {
  it("reads an implicit magic-link hash from any browser", () => {
    const plan = readAuthCallback(
      "https://st-6-codex.vercel.app/auth/callback#access_token=access.jwt&refresh_token=refresh-1&expires_in=3600&token_type=bearer&type=magiclink",
    );
    expect(plan).toEqual({ kind: "session", accessToken: "access.jwt", refreshToken: "refresh-1", next: "/" });
  });

  it("keeps a same-site next path and drops an open redirect", () => {
    const allowed = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?next=%2Ft%2FSEAL6#access_token=a&refresh_token=b");
    const blocked = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?next=https://evil.example#access_token=a&refresh_token=b");
    expect(allowed).toMatchObject({ kind: "session", next: "/t/SEAL6" });
    expect(blocked).toMatchObject({ kind: "session", next: "/" });
  });

  it("prefers tokens in the URL over a leftover PKCE code", () => {
    const plan = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?code=abc#access_token=a&refresh_token=b");
    expect(plan.kind).toBe("session");
  });

  it("keeps Google's PKCE code for the same browser", () => {
    const plan = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?code=google-code&next=%2Frules");
    expect(plan).toEqual({ kind: "pkce", code: "google-code", flowId: null, next: "/rules" });
  });

  it("verifies a token hash when a template includes one", () => {
    const plan = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?token_hash=hash-1&type=magiclink");
    expect(plan).toEqual({ kind: "verify", tokenHash: "hash-1", otpType: "magiclink", next: "/" });
  });

  it("turns the Mail-browser PKCE failure into a resend message", () => {
    const plan = readAuthCallback(
      `https://st-6-codex.vercel.app/auth/callback?error=access_denied&error_code=pkce_code_verifier_not_found&error_description=${encodeURIComponent(PKCE_MESSAGE)}`,
    );
    expect(plan.kind).toBe("error");
    if (plan.kind !== "error") return;
    expect(plan.message).toBe(friendlyAuthError(PKCE_MESSAGE, "pkce_code_verifier_not_found"));
    expect(plan.message).toContain("different browser");
    expect(plan.message).not.toContain("code verifier");
  });

  it("turns an expired link into a resend message", () => {
    const plan = readAuthCallback(
      "https://st-6-codex.vercel.app/auth/callback#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(plan).toEqual({
      kind: "error",
      message: "That code or link didn't work. It may have expired or already been used. Send a new one.",
    });
  });

  it("ignores a callback with nothing to finish", () => {
    expect(readAuthCallback("https://st-6-codex.vercel.app/auth/callback")).toEqual({ kind: "none" });
  });
});

describe("prepareBrowserLocation", () => {
  it("remembers the session and removes it from the address before the client starts", () => {
    let href = "https://st-6-codex.vercel.app/auth/callback?code=old#access_token=aaa&refresh_token=bbb&token_type=bearer";
    const plan = prepareBrowserLocation(href, (next) => {
      href = `https://st-6-codex.vercel.app${next}`;
    });
    expect(plan).toMatchObject({ kind: "session", accessToken: "aaa", refreshToken: "bbb" });
    expect(href).toBe("https://st-6-codex.vercel.app/auth/callback");
    expect(readAuthCallback(href).kind).toBe("none");
    expect(stripAuthCallbackUrl("https://st-6-codex.vercel.app/auth/callback?next=%2Ft%2FSEAL6&code=abc")).toBe(
      "/auth/callback?next=%2Ft%2FSEAL6",
    );
  });
});

describe("applyAuthCallback", () => {
  it("establishes the session from the URL tokens", async () => {
    const calls: unknown[] = [];
    const result = await applyAuthCallback(
      { kind: "session", accessToken: "access", refreshToken: "refresh", next: "/t/SEAL6" },
      auth({
        setSession: async (tokens) => {
          calls.push(tokens);
          return { error: null };
        },
      }),
    );
    expect(result).toEqual({ ok: true, next: "/t/SEAL6" });
    expect(calls).toEqual([{ access_token: "access", refresh_token: "refresh" }]);
  });

  it("keeps Google's flow id so the verifier can be found after the URL is cleaned", async () => {
    const plan = readAuthCallback("https://st-6-codex.vercel.app/auth/callback?code=google-code&sb_flow_id=flow-9");
    expect(plan).toMatchObject({ kind: "pkce", code: "google-code", flowId: "flow-9" });
    const seen: unknown[] = [];
    const result = await applyAuthCallback(plan, auth({
      exchangeCodeForSession: async (code, flowId) => {
        seen.push({ code, flowId });
        return { error: null };
      },
    }));
    expect(result).toEqual({ ok: true, next: "/" });
    expect(seen).toEqual([{ code: "google-code", flowId: "flow-9" }]);
  });

  it("exchanges a Google code and hides a missing verifier", async () => {
    const ok = await applyAuthCallback({ kind: "pkce", code: "code-1", flowId: null, next: "/" }, auth());
    expect(ok).toEqual({ ok: true, next: "/" });

    const missing = await applyAuthCallback(
      { kind: "pkce", code: "code-1", flowId: null, next: "/" },
      auth({
        exchangeCodeForSession: async () => ({ error: { message: PKCE_MESSAGE, code: "pkce_code_verifier_not_found" } }),
      }),
    );
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.message).toContain("Send a new link");
      expect(missing.message).not.toContain("localstorage");
      expect(missing.message).not.toContain(PKCE_MESSAGE);
    }
  });

  it("verifies a token hash and surfaces a friendly failure", async () => {
    const types: string[] = [];
    const ok = await applyAuthCallback(
      { kind: "verify", tokenHash: "hash", otpType: "magiclink", next: "/" },
      auth({
        verifyOtp: async (args) => {
          types.push(args.type);
          return { error: null };
        },
      }),
    );
    expect(ok).toEqual({ ok: true, next: "/" });
    expect(types).toEqual(["magiclink"]);

    const failed = await applyAuthCallback(
      { kind: "verify", tokenHash: "hash", otpType: "magiclink", next: "/" },
      auth({
        verifyOtp: async () => {
          throw new Error(PKCE_MESSAGE);
        },
      }),
    );
    expect(failed.ok).toBe(false);
    if (!failed.ok) expect(failed.message).toContain("different browser");
  });

  it("does not call auth when the link already failed", async () => {
    let called = false;
    const result = await applyAuthCallback(
      { kind: "error", message: "Send a new link." },
      auth({
        setSession: async () => {
          called = true;
          return { error: null };
        },
      }),
    );
    expect(result).toEqual({ ok: false, message: "Send a new link." });
    expect(called).toBe(false);
  });

  it("runs the remembered plan once", async () => {
    let sessions = 0;
    prepareBrowserLocation("https://st-6-codex.vercel.app/auth/callback#access_token=a&refresh_token=b", () => undefined);
    const client = auth({
      setSession: async () => {
        sessions += 1;
        return { error: null };
      },
    });
    const [first, second] = await Promise.all([consumeAuthCallback(client), consumeAuthCallback(client)]);
    expect(first).toEqual({ ok: true, next: "/" });
    expect(second).toEqual(first);
    expect(sessions).toBe(1);
  });
});

describe("email sign-in", () => {
  it("asks for a magic link without a PKCE code challenge", async () => {
    const calls: { url: string; body: string }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: String(init?.body ?? "") });
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const client = createEmailLinkClient("https://jmfzxehgrpctrbncltoy.supabase.co", "test-anon-key", fetchImpl);
    const { error } = await client.auth.signInWithOtp({
      email: "corbin@example.com",
      options: { emailRedirectTo: "https://st-6-codex.vercel.app/auth/callback" },
    });
    expect(error).toBeNull();
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0].body) as { code_challenge: string | null };
    expect(body.code_challenge).toBeNull();
    expect(calls[0].url).toContain("redirect_to=https%3A%2F%2Fst-6-codex.vercel.app%2Fauth%2Fcallback");
  });

  it("still attaches a code challenge when the client is PKCE", async () => {
    const calls: string[] = [];
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls.push(String(init?.body ?? ""));
      return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
    };
    const client = createClient("https://jmfzxehgrpctrbncltoy.supabase.co", "test-anon-key", {
      global: { fetch: fetchImpl },
      auth: { flowType: "pkce", persistSession: false, detectSessionInUrl: false, storageKey: "st6-pkce-test", storage: memory() },
    });
    await client.auth.signInWithOtp({ email: "corbin@example.com" });
    const body = JSON.parse(calls[0]) as { code_challenge: string | null };
    expect(typeof body.code_challenge).toBe("string");
    expect(body.code_challenge?.length).toBeGreaterThan(10);
  });

  it("tries the magic-link code, then the email code", async () => {
    const types: string[] = [];
    await verifyEmailCode(async (args) => {
      types.push(args.type);
      return args.type === "email" ? { error: null } : { error: { message: "Token has expired or is invalid" } };
    }, "corbin@example.com", "123456");
    expect(types).toEqual(["magiclink", "email"]);
  });

  it("hides a bad code behind a resend message", async () => {
    await expect(
      verifyEmailCode(async () => ({ error: { message: "Token has expired or is invalid", code: "otp_expired" } }), "a@b.com", "000000"),
    ).rejects.toThrow(/Send a new one/);
  });

  it("maps send failures", () => {
    expect(friendlySendError("For security purposes, you can only request this once every 60 seconds.")).toContain("Wait a minute");
    expect(friendlySendError("redirect_to is not allowed")).toContain("redirect URL");
  });
});

function memory() {
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
