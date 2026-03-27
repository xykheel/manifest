/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Production API origin; in `vite dev` the app uses same-origin `/api` via the dev proxy instead. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
