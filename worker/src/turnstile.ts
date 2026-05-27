import type { Env } from "./env.js";

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(
  token: string | null,
  env: Env,
  clientIp: string | null,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true; // Turnstile not configured yet
  if (!token) return false;

  const body = new URLSearchParams();
  body.append("secret", env.TURNSTILE_SECRET_KEY);
  body.append("response", token);
  if (clientIp) body.append("remoteip", clientIp);

  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch {
    return false;
  }
}
