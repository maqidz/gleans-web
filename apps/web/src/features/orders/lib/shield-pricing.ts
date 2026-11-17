import "server-only";

import { unstable_cache } from "next/cache";
import { paymentAdmin } from "@/features/payments/server/repository";
import { DEFAULT_SHIELD_PRICING, type ShieldPricing } from "@/lib/plans";

export const SHIELD_PRICING_TAG = "shield-pricing";

export async function readShieldPrice() {
  const { data, error } = await paymentAdmin().database.from("shield_pricing")
    .select("price").eq("id", true).single();
  if (error || !data) throw new Error("SHIELD_PRICE_UNAVAILABLE", { cause: error });
  return data.price as number;
}

type PriceRow = { price: number; starter_price: number; standart_price: number; premium_price: number };
const priceColumns = "price,starter_price,standart_price,premium_price";

function fromPriceRow(row: PriceRow): ShieldPricing {
  return { price: row.price, packages: { starter: row.starter_price, standart: row.standart_price, premium: row.premium_price } };
}

function toPriceRow({ price, packages }: ShieldPricing): PriceRow {
  return { price, starter_price: packages.starter, standart_price: packages.standart, premium_price: packages.premium };
}

export async function readShieldPricing() {
  const { data, error } = await paymentAdmin().database.from("shield_pricing").select(priceColumns).eq("id", true).single();
  if (error || !data) throw new Error("SHIELD_PRICE_UNAVAILABLE", { cause: error });
  return fromPriceRow(data as PriceRow);
}

export async function saveShieldPricing(pricing: ShieldPricing, previous: ShieldPricing) {
  const { data, error } = await paymentAdmin().database.from("shield_pricing")
    .update(toPriceRow(pricing)).eq("id", true).match(toPriceRow(previous)).select(priceColumns).maybeSingle();
  if (error) throw error;
  return data ? fromPriceRow(data as PriceRow) : null;
}

const readCachedShieldPricing = unstable_cache(readShieldPricing, ["shield-price-catalog"], {
  tags: [SHIELD_PRICING_TAG],
  revalidate: 60,
});

export async function displayShieldPricing() {
  return readCachedShieldPricing().catch(() => DEFAULT_SHIELD_PRICING);
}
