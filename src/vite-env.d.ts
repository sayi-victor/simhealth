/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the SimHealth API, e.g. `http://localhost:8000/api`. Defaults to `/api`. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
