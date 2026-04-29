import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveMarket, isMarketId } from "@novapatch/markets";
import { calculateQuote, type CartItemInput } from "@novapatch/pricing";
import { getStripe } from "@/lib/stripe";

/**
 * Compact item shape from the cart store. We re-derive prices from the
 * canonical pricing engine — `price` here is informational only (used for
 * compact PI metadata so the webhook can forward to apps/api). The actual
 * Stripe `amount` is the engine's output, NOT the client's number.
 */
const itemSchema = z.object({
  slug: z.enum(["energy", "sleep", "glow", "shield", "zen", "woman"]),
  name: z.string(),
  price: z.number().int(),
  qty: z.number().int().min(1),
  subscription: z
    .object({ interval_days: z.union([z.literal(30), z.literal(60), z.literal(90)]), discount_percentage: z.number().int() })
    .optional(),
});

const schema = z.object({
  // amount_mxn is no longer trusted (kept optional for backward-compat with
  // stale clients, but ignored). Engine recomputes the canonical amount.
  amount_mxn: z.number().int().min(1).optional(),
  items: z.array(itemSchema).min(1),
  /**
   * Market id (mx, br, ar, cl, co). Defaults to "mx". Stamped on PI metadata
   * so the webhook can forward it to apps/api with the correct currency/tax/
   * shipping config.
   */
  market: z.string().min(1).max(8).optional(),
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
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 });
  }

  const { items, market: marketIdRaw } = parsed.data;

  const marketId = (marketIdRaw ?? "mx").toLowerCase();
  if (!isMarketId(marketId)) {
    return NextResponse.json({ error: `unknown market: ${marketIdRaw}` }, { status: 400 });
  }
  const market = resolveMarket(marketId);

  // Re-derive the canonical amount from slugs + quantities + subscription
  // intervals. This MUST match what apps/api computes via the same engine,
  // otherwise the gateway's amount-mismatch guard rejects the order.
  const cartInput: CartItemInput[] = items.map((i) =>
    i.subscription !== undefined
      ? { slug: i.slug, quantity: i.qty, subscription: { interval: i.subscription.interval_days } }
      : { slug: i.slug, quantity: i.qty },
  );
  const quote = calculateQuote({ items: cartInput, market });

  // Compact item serialization for Stripe metadata (500-char limit).
  const itemsJson = JSON.stringify(
    items.map((i) => ({
      s: i.slug,
      n: i.name,
      p: i.price,
      q: i.qty,
      ...(i.subscription && {
        sub: { d: i.subscription.interval_days, pct: i.subscription.discount_percentage },
      }),
    })),
  );

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: quote.total,
      currency: market.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: "novapatch-web",
        market: market.id,
        subtotal_cents: quote.subtotal.toString(),
        shipping_cents: quote.shipping.toString(),
        tax_cents: quote.tax.toString(),
        total_cents: quote.total.toString(),
        items: itemsJson,
        // customer_email + shipping_address get added later via /finalize.
      },
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
