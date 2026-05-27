import type { ValidatorContainer } from "./container.js";

export interface Env {
  CHECK_CACHE: KVNamespace;
  VALIDATOR: DurableObjectNamespace<ValidatorContainer>;
  INTERNAL_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  ALLOWED_ORIGIN: string;
  MAX_BODY_BYTES: string;
  CHECK_TIMEOUT_MS: string;
  VALIDATOR_VERSION: string;
  RATE_LIMIT_PER_MIN: string;
}
