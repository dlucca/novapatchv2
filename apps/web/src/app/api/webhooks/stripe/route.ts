import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook handler.
 *
 * Local dev:
 *   1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
 *   2. stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *   3. Copy the signing secret printed by the CLI into STRIPE_WEBHOOK_SECRET in .env
 *
 * Production:
 *   Create an endpoint in Stripe Dashboard → Developers → Webhooks
 *   URL: https://yourdomain.com/api/webhooks/stripe
 *   Events to listen: payment_intent.succeeded, payment_intent.payment_failed
 */

/** Compact item shape serialized into Stripe metadata. */
type CompactItem = {
  s: string;  // slug
  n: string;  // name
  p: number;  // unit price MXN
  q: number;  // qty
  sub?: { d: number; pct: number }; // subscription interval_days + discount_percentage
};

/** Compact shipping-address shape stamped by /api/checkout/finalize. */
type CompactAddress = {
  l1: string;
  l2?: string;
  c: string;
  s: string;
  pc: string;
  co: string;
};

type ProductSlug = "energy" | "sleep" | "glow" | "shield" | "zen" | "woman";

function parseItems(raw: string | undefined): CompactItem[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CompactItem[];
  } catch {
    return [];
  }
}

function parseAddress(raw: string | undefined): CompactAddress | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as CompactAddress;
  } catch {
    return undefined;
  }
}

function isProductSlug(s: string): s is ProductSlug {
  return ["energy", "sleep", "glow", "shield", "zen", "woman"].includes(s);
}

function isInterval(n: number): n is 30 | 60 | 90 {
  return n === 30 || n === 60 || n === 90;
}

/**
 * Forward a successful PaymentIntent to apps/api for guest order persistence.
 * Idempotency-Key = PaymentIntent id, so Stripe retries collapse server-side.
 *
 * Returns true on success (or accepted idempotent replay), false on a problem
 * the caller should report so Stripe retries the webhook.
 */
async function forwardToApi(intent: Stripe.PaymentIntent): Promise<boolean> {
  const apiUrl = process.env.NOVA_API_URL;
  const secret = process.env.NOVA_API_WEBHOOK_SECRET;
  if (!apiUrl || !secret) {
    console.error(
      "[stripe] NOVA_API_URL or NOVA_API_WEBHOOK_SECRET not set — cannot forward to apps/api",
    );
    return false;
  }

  const md = intent.metadata;
  const compactItems = parseItems(md.items);
  const address = parseAddress(md.shipping_address);
  const customerEmail = md.customer_email;

  if (!customerEmail || !address || compactItems.length === 0) {
    console.warn(
      "[stripe] PI metadata missing required fields (email/address/items); finalize step likely failed. pi=",
      intent.id,
    );
    return false;
  }

  // Re-shape compact items into the apps/api ItemSchema, dropping any unknown
  // slugs/intervals defensively.
  const items = compactItems.flatMap((i) => {
    if (!isProductSlug(i.s)) return [];
    if (i.sub && isInterval(i.sub.d)) {
      return [{ slug: i.s, quantity: i.q, subscription: { interval: i.sub.d } }];
    }
    return [{ slug: i.s, quantity: i.q }];
  });
  if (items.length === 0) {
    console.warn("[stripe] no valid items after normalization; pi=", intent.id);
    return false;
  }

  // Stripe types `customer` + `payment_method` as string | null | object —
  // we set them via the API as strings during /finalize, but normalize
  // defensively in case Stripe returns expanded objects.
  const stripeCustomerId =
    typeof intent.customer === "string"
      ? intent.customer
      : intent.customer?.id ?? null;
  const paymentMethodId =
    typeof intent.payment_method === "string"
      ? intent.payment_method
      : intent.payment_method?.id ?? null;

  const hasSubscription = items.some((i) => "subscription" in i);
  if (hasSubscription && (!stripeCustomerId || !paymentMethodId)) {
    console.warn(
      `[stripe] subscription PI missing customer/payment_method on success — pi=${intent.id}; cron renewals will fail until manually fixed`,
    );
    // Don't fail the forward — the order should still persist. apps/api will
    // reject with a 400 if we omit these on a subscription, which propagates
    // to a 500 here (Stripe retries) — but if we're already at this point
    // with the PI succeeded, retrying won't fix the missing data. We'd
    // rather let the order persist via a separate non-subscription path...
    // but we don't have one. The cleanest answer is: this branch is a bug,
    // not an expected state. Log loudly so ops sees it.
  }

  const body = {
    customerEmail,
    market: md.market ?? "mx",
    items,
    shippingAddress: {
      line1: address.l1,
      ...(address.l2 ? { line2: address.l2 } : {}),
      city: address.c,
      state: address.s,
      postalCode: address.pc,
      country: address.co,
    },
    paymentToken: intent.id,
    recurringConsent: md.recurring_consent === "true",
    ...(stripeCustomerId ? { gatewayCustomer: stripeCustomerId } : {}),
    ...(paymentMethodId ? { paymentMethod: paymentMethodId } : {}),
  };

  try {
    const res = await fetch(`${apiUrl}/webhook/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Auth": secret,
        "Idempotency-Key": intent.id,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 201 || res.status === 200) {
      const data = (await res.json()) as { orderId?: string; replayed?: boolean };
      console.log(
        `[stripe] forwarded to apps/api: pi=${intent.id} order=${data.orderId} ${data.replayed ? "(replayed)" : "(new)"}`,
      );
      return true;
    }
    const text = await res.text();
    console.error(
      `[stripe] apps/api rejected webhook forward: pi=${intent.id} status=${res.status} body=${text.slice(0, 500)}`,
    );
    return false;
  } catch (err) {
    console.error(
      "[stripe] apps/api forward threw:",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  console.log("[stripe] payment_intent.succeeded", {
    id: intent.id,
    total_cents: intent.metadata.total_cents,
    customer_email: intent.metadata.customer_email,
    has_customer: typeof intent.customer === "string" || !!intent.customer,
    has_payment_method: typeof intent.payment_method === "string" || !!intent.payment_method,
  });

  const ok = await forwardToApi(intent);
  if (!ok) {
    // Throw so the POST handler returns 500 and Stripe retries the webhook.
    throw new Error(`forward to apps/api failed for pi=${intent.id}`);
  }

  // TODO: send order confirmation email via Resend (next milestone)
}

async function handlePaymentFailed(intent: Stripe.PaymentIntent) {
  console.warn("[stripe] payment_intent.payment_failed", {
    id: intent.id,
    last_error: intent.last_payment_error?.message,
  });

  // TODO: notify customer of failed payment
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[stripe] STRIPE_WEBHOOK_SECRET not set — webhook rejected");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Raw body required for signature verification.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe] Webhook signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // Unhandled events — acknowledge without processing.
        break;
    }
  } catch (err) {
    console.error("[stripe] Error handling event:", event.type, err);
    // Return 500 so Stripe retries the event.
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
