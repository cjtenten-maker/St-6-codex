export type AuthCallbackPlan =
  | { kind: "session"; accessToken: string; refreshToken: string; next: string }
  | { kind: "pkce"; code: string; flowId: string | null; next: string }
  | { kind: "verify"; tokenHash: string; otpType: string; next: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

export type AuthCallbackResult = { ok: true; next: string } | { ok: false; message: string };

export type AuthCallbackClient = {
  setSession: (tokens: { access_token: string; refresh_token: string }) => Promise<{ error: { message: string; code?: string } | null }>;
  exchangeCodeForSession: (code: string, flowId?: string) => Promise<{ error: { message: string; code?: string } | null }>;
  verifyOtp: (args: { token_hash: string; type: string }) => Promise<{ error: { message: string; code?: string } | null }>;
};

const OTP_TYPES = new Set(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);
const STRIP_KEYS = ["code", "sb_flow_id", "error", "error_code", "error_description", "token_hash", "type", "access_token", "refresh_token", "expires_in", "expires_at", "token_type", "provider_token", "provider_refresh_token"];

let remembered: AuthCallbackPlan | null = null;
let inflight: Promise<AuthCallbackResult> | null = null;

export function resetAuthCallbackState(): void {
  remembered = null;
  inflight = null;
}

export function friendlyAuthError(raw: string, code?: string | null): string {
  const text = `${code ?? ""} ${raw}`.toLowerCase();
  if (text.includes("code verifier") || text.includes("pkce") || code === "pkce_code_verifier_not_found") {
    return "This link was opened in a different browser than the one that asked for it. Send a new link. The new one signs you in here, including when Mail opens it.";
  }
  if (text.includes("expired") || text.includes("otp_expired") || text.includes("already") || text.includes("invalid")) {
    return "That code or link didn't work. It may have expired or already been used. Send a new one.";
  }
  if (text.includes("token") || text.includes("otp")) {
    return "That code didn't match. Check the digits, or send a new link.";
  }
  return "We couldn't finish signing you in. Send yourself a new link.";
}

export function friendlySendError(raw: string): string {
  const text = raw.toLowerCase();
  if (text.includes("rate") || text.includes("too many") || text.includes("once every")) {
    return "Too many emails just went out. Wait a minute, then ask for another link.";
  }
  if (text.includes("redirect")) {
    return "Supabase rejected the return address. The redirect URL for this site needs to be allowed.";
  }
  return "The email didn't send. Check the address and try again.";
}

function safeNext(value: string | null): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) return "/";
  if (value.startsWith("/auth/")) return "/";
  return value;
}

function paramsOf(href: string): { query: URLSearchParams; hash: URLSearchParams } {
  const url = new URL(href, "https://st-6-codex.vercel.app");
  return {
    query: url.searchParams,
    hash: new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash),
  };
}

function first(query: URLSearchParams, hash: URLSearchParams, key: string): string | null {
  const fromHash = hash.get(key);
  if (fromHash) return fromHash;
  return query.get(key);
}

export function readAuthCallback(href: string): AuthCallbackPlan {
  const { query, hash } = paramsOf(href);
  const next = safeNext(first(query, hash, "next"));
  const errorDescription = first(query, hash, "error_description");
  const errorCode = first(query, hash, "error_code");
  const error = first(query, hash, "error");
  if (error || errorDescription || errorCode) {
    return { kind: "error", message: friendlyAuthError(errorDescription || error || "", errorCode) };
  }

  const accessToken = first(query, hash, "access_token");
  const refreshToken = first(query, hash, "refresh_token");
  if (accessToken && refreshToken) return { kind: "session", accessToken, refreshToken, next };
  if (accessToken || refreshToken) {
    return { kind: "error", message: friendlyAuthError("missing session") };
  }

  const tokenHash = first(query, hash, "token_hash");
  const otpType = first(query, hash, "type");
  if (tokenHash && otpType && OTP_TYPES.has(otpType)) {
    return { kind: "verify", tokenHash, otpType, next };
  }

  const code = query.get("code") || hash.get("code");
  if (code) return { kind: "pkce", code, flowId: first(query, hash, "sb_flow_id"), next };
  return { kind: "none" };
}

export function rememberAuthCallback(href: string): AuthCallbackPlan {
  if (!remembered) remembered = readAuthCallback(href);
  return remembered;
}

export function stripAuthCallbackUrl(href: string): string {
  const url = new URL(href, "https://st-6-codex.vercel.app");
  url.hash = "";
  for (const key of STRIP_KEYS) url.searchParams.delete(key);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}`;
}

export function prepareBrowserLocation(href: string, replace: (url: string) => void): AuthCallbackPlan {
  const plan = rememberAuthCallback(href);
  if (plan.kind !== "none") replace(stripAuthCallbackUrl(href));
  return plan;
}

export async function applyAuthCallback(plan: AuthCallbackPlan, auth: AuthCallbackClient): Promise<AuthCallbackResult> {
  try {
    if (plan.kind === "none") return { ok: true, next: "/" };
    if (plan.kind === "error") return { ok: false, message: plan.message };
    if (plan.kind === "session") {
      const { error } = await auth.setSession({ access_token: plan.accessToken, refresh_token: plan.refreshToken });
      if (error) return { ok: false, message: friendlyAuthError(error.message, error.code) };
      return { ok: true, next: plan.next };
    }
    if (plan.kind === "pkce") {
      const { error } = await auth.exchangeCodeForSession(plan.code, plan.flowId ?? undefined);
      if (error) return { ok: false, message: friendlyAuthError(error.message, error.code) };
      return { ok: true, next: plan.next };
    }
    const { error } = await auth.verifyOtp({ token_hash: plan.tokenHash, type: plan.otpType });
    if (error) return { ok: false, message: friendlyAuthError(error.message, error.code) };
    return { ok: true, next: plan.next };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
    return { ok: false, message: friendlyAuthError(message, code) };
  }
}

export function consumeAuthCallback(auth: AuthCallbackClient): Promise<AuthCallbackResult> {
  if (!inflight) inflight = applyAuthCallback(remembered ?? { kind: "none" }, auth);
  return inflight;
}
