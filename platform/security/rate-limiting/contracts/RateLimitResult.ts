export type RateLimitResult =
  | { readonly allowed: true; readonly remainingRequests: number }
  | { readonly allowed: false; readonly retryAfterMs: number };
