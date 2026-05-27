/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_OFFICIAL_CHECK_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
