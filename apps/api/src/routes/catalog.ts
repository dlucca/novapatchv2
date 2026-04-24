import { Hono } from "hono";
import {
  getProduct,
  listProducts,
  getPriceForMarket,
  getSubscriptionPrice,
  type Product,
  type SubscriptionInterval,
} from "@novapatch/catalog";
import type { Market } from "@novapatch/markets";
import { marketMiddleware } from "../middleware/market";

export const catalogRoutes = new Hono();

catalogRoutes.use("*", marketMiddleware);

const SUBSCRIPTION_INTERVALS: readonly SubscriptionInterval[] = [30, 60, 90];

function serializeProduct(product: Product, market: Market) {
  const subscriptionPrices = Object.fromEntries(
    SUBSCRIPTION_INTERVALS.map((interval) => [
      String(interval),
      getSubscriptionPrice(product, market.id, interval),
    ]),
  );
  return {
    slug: product.slug,
    name: product.name,
    description: product.description,
    images: product.images,
    price: getPriceForMarket(product, market.id),
    currency: market.currency,
    subscriptionPrices,
  };
}

catalogRoutes.get("/", (c) => {
  const market = c.get("market");
  return c.json({
    market: market.id,
    currency: market.currency,
    products: listProducts().map((p) => serializeProduct(p, market)),
  });
});

catalogRoutes.get("/:slug", (c) => {
  const market = c.get("market");
  const slug = c.req.param("slug");
  const product = getProduct(slug);
  if (!product) {
    return c.json({ error: `product not found: ${slug}` }, 404);
  }
  return c.json(serializeProduct(product, market));
});
