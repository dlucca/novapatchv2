import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";

/** Flat shipping cost in MXN. */
const SHIPPING_MXN = 85;

/** Compact item shape stored in Stripe metadata (500-char limit per value). */
const itemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  price: z.number().int(),
  qty: z.number().int().min(1),
  subscription: z
    .object({ interval_days: z.number().int(), discount_percentage: z.number().int() })
    .optional(),
});

const schema = z.object({
  amount_mxn: z.number().int().min(1),
  items: z.array(itemSchema).min(1),
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

  const { amount_mxn, items } = parsed.data;
  const total_centavos = (amount_mxn + SHIPPING_MXN) * 100;

  // Compact item serialization to fit within Stripe's 500-char metadata limit.
  const itemsJson = JSON.stringify(
    items.map((i) => ({
      s: i.slug,
      n: i.name,
      p: i.price,
      q: i.qty,
      ...(i.subscription && { sub: { d: i.subscription.interval_days, pct: i.subscription.discount_percentage } }),
    })),
  );

  try {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.create({
      amount: total_centavos,
      currency: "mxn",
      automatic_payment_methods: { enabled: true },
      metadata: {
        source: "novapatch-web",
        subtotal_mxn: amount_mxn.toString(),
        shipping_mxn: SHIPPING_MXN.toString(),
        total_mxn: (amount_mxn + SHIPPING_MXN).toString(),
        items: itemsJson,
      },
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
