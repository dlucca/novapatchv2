import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";

/**
 * Finalize a PaymentIntent's customer + shipping metadata.
 *
 * Why this exists: the PaymentIntent is created on checkout-page mount — at
 * which point we don't yet know the customer's email or shipping address.
 * The user fills the form, and right before `stripe.confirmPayment()` runs,
 * the form calls this endpoint to stamp those fields onto PI metadata.
 *
 * The Stripe webhook on `payment_intent.succeeded` reads this metadata and
 * forwards it to `apps/api POST /webhook/checkout` for guest order
 * persistence. Without this step the webhook would be missing the data it
 * needs.
 *
 * Safety: this endpoint can only update metadata, not amounts/currency. The
 * worst a malicious caller could do is associate someone else's PI with a
 * wrong email — which would just get rejected at apps/api by the
 * idempotency key collision check (different customer for same PI).
 */
const ShippingAddressSchema = z.object({
  line1: z.string().min(1).max(200),
  line2: z.string().min(1).max(200).optional(),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  country: z.string().min(1).max(3),
});

const schema = z.object({
  payment_intent_id: z.string().regex(/^pi_[A-Za-z0-9]+$/, "invalid payment_intent_id"),
  customer_email: z.string().email().max(254),
  customer_name: z.string().min(1).max(200).optional(),
  customer_phone: z.string().min(1).max(40).optional(),
  shipping_address: ShippingAddressSchema,
  /**
   * True when the cart contains at least one subscription line. Triggers
   * Stripe Customer creation + `setup_future_usage: off_session` so the
   * payment method is saved for the renewal cron. False/absent for one-time
   * orders — saving the PM would over-collect data.
   */
  recurring_consent: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    payment_intent_id,
    customer_email,
    customer_name,
    customer_phone,
    shipping_address,
    recurring_consent,
  } = parsed.data;

  // Compact JSON so we stay well under Stripe's 500-char metadata-value limit.
  const shippingJson = JSON.stringify({
    l1: shipping_address.line1,
    ...(shipping_address.line2 ? { l2: shipping_address.line2 } : {}),
    c: shipping_address.city,
    s: shipping_address.state,
    pc: shipping_address.postalCode,
    co: shipping_address.country,
  });
  if (shippingJson.length > 500) {
    return NextResponse.json(
      { error: "shipping address exceeds metadata size limit" },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  // For subscriptions, create a Stripe Customer and attach it to the PI so
  // the payment method gets saved off-session for the renewal cron. We do
  // NOT search for an existing Customer — we just create a fresh one each
  // time. apps/api de-duplicates on its end (one row per email) and stores
  // the most-recent Customer id. Old orphaned Customers on Stripe don't
  // break anything; they just don't get used. Lookup-and-reuse can be added
  // later if needed (Stripe's customers.search has rate limits and eventual
  // consistency caveats anyway).
  let stripeCustomerId: string | undefined;
  if (recurring_consent) {
    try {
      const created = await stripe.customers.create({
        email: customer_email,
        ...(customer_name ? { name: customer_name } : {}),
        ...(customer_phone ? { phone: customer_phone } : {}),
      });
      stripeCustomerId = created.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      console.error("[finalize] stripe.customers.create failed:", message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  try {
    await stripe.paymentIntents.update(payment_intent_id, {
      metadata: {
        customer_email,
        ...(customer_name ? { customer_name } : {}),
        ...(customer_phone ? { customer_phone } : {}),
        shipping_address: shippingJson,
        recurring_consent: recurring_consent ? "true" : "false",
      },
      // setup_future_usage + customer must be set BEFORE confirmPayment runs.
      // Stripe will save the PM to the Customer on successful confirmation
      // and it's then available for off-session charges.
      ...(stripeCustomerId
        ? {
            customer: stripeCustomerId,
            setup_future_usage: "off_session" as const,
          }
        : {}),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[finalize] paymentIntents.update failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
