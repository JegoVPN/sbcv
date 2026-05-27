import type { Env } from "./env.js";

export interface ForwardBody {
  target: string;
  config: unknown;
}

export async function forwardToContainer(body: ForwardBody, env: Env): Promise<Response> {
  if (!env.VALIDATOR_URL) {
    throw new Error("VALIDATOR_URL is not configured");
  }
  const url = `${env.VALIDATOR_URL.replace(/\/$/, "")}/check`;
  const timeout = Number(env.CHECK_TIMEOUT_MS ?? 6000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-token": env.INTERNAL_TOKEN ?? "",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}
