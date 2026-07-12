/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HIGHLIGHT_TRACE_DURATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __LLM_MODEL__: string;
declare const __LLM_CONFIG_ERROR__: string;
