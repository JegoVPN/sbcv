import type { Env } from "./env.js";

export interface ForwardBody {
  target: string;
  config: unknown;
}

const SINGLETON_NAME = "validator";

export async function forwardToContainer(body: ForwardBody, env: Env): Promise<Response> {
  const id = env.VALIDATOR.idFromName(SINGLETON_NAME);
  const stub = env.VALIDATOR.get(id);
  const timeout = Number(env.CHECK_TIMEOUT_MS ?? 6000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await stub.fetch("http://container.internal/check", {
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
