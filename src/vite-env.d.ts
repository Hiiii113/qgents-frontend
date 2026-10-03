/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_USE_MOCK: string
  readonly VITE_RSA_KEY_ID?: string
  readonly VITE_RSA_PUBLIC_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
