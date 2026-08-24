/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Empty in development so requests go through the Vite proxy as same-origin. */
  readonly VITE_API_BASE_URL?: string;
  /** When "true", show the demonstration-only banner and PHI warning. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
