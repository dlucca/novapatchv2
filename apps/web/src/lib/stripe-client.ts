import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | undefined;

/** Memoized loadStripe — safe to call multiple times from client components. */
export function getStripePromise(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PK;
    if (!key) throw new Error("NEXT_PUBLIC_STRIPE_PK not set");
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
