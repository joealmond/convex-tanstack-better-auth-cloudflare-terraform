/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONVEX_URL: string
  readonly VITE_CONVEX_SITE_URL?: string
  readonly VITE_APP_ENV?: 'development' | 'preview' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// App version from vite.config.ts
declare const __APP_ENV__: string
