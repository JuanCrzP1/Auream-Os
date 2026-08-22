/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base de la API. Obligatoria en builds de producción. */
  readonly VITE_API_BASE_URL?: string;
  /**
   * API key de desarrollo local. Sólo se lee cuando `import.meta.env.DEV` es true,
   * de modo que nunca queda compilada en un build de producción.
   */
  readonly VITE_DEV_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
