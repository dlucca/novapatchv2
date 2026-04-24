import type { Market } from "@novapatch/markets";

// Central registry for Hono ContextVariableMap augmentations.
// Add new keys here as the API grows — e.g. `customer`, `requestId`.
declare module "hono" {
  interface ContextVariableMap {
    market: Market;
  }
}

export {};
