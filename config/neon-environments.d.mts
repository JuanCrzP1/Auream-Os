// Declaración de tipos para neon-environments.mjs — no redeclara valores,
// sólo los tipa para el único consumidor TypeScript.

export declare const NEON_PRODUCTION_COMPUTE_HOST: string;
export declare const NEON_TEST_COMPUTE_HOST: string;
export declare function parseDatabaseHost(connectionString: string): string | null;
export declare function isProductionDatabaseUrl(connectionString: string): boolean;
export declare function safeHostOf(connectionString: string): string;
