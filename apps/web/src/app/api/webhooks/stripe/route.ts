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

function parseItems(raw: string | undefined): CompactItem[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as CompactItem[];
  } catch {
    return [];
  }
}

async function handlePaymentSucceeded(intent: Stripe.PaymentIntent) {
  const { metadata } = intent;
  const items = parseItems(metadata.items);

  console.log("[stripe] payment_intent.succeeded", {
    id: intent.id,
    total_mxn: metadata.total_mxn,
    subtotal_mxn: metadata.subtotal_mxn,
    shipping_mxn: metadata.shipping_mxn,
    items: items.map((i) => ({
      slug: i.s,
      name: i.n,
      qty: i.q,
      price: i.p,
      ...(i.sub && { subscription: { interval_days: i.sub.d, discount_pct: i.sub.pct } }),
    })),
    customer_email: intent.receipt_email,
  });

  // TODO: send order confirmation email via Resend (next milestone)
  // TODO: create order record in backend when API is ready
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
