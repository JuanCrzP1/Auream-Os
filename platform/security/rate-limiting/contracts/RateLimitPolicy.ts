export interface RateLimitPolicy {
  readonly windowMs: number;
  readonly maxRequests: number;
}
