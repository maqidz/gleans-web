export const SHIELD_PRICE = 8_000;
export const MAX_SHIELD_PRICE = 1_000_000;

export const PLANS = [
  { id: "starter", name: "Starter", price: 35_000, checks: 5, blurb: "Pas untuk tugas kuliah dan makalah rutin." },
  { id: "standart", name: "Standart", price: 65_000, checks: 10, blurb: "Untuk proposal dan laporan." },
  { id: "premium", name: "Premium", price: 150_000, checks: 25, blurb: "Hemat untuk skripsi, tesis, dan kelompok." },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];
export type PackagePrices = Record<PlanId, number>;
export type ShieldPricing = { price: number; packages: PackagePrices };

export const DEFAULT_SHIELD_PRICING: ShieldPricing = {
  price: SHIELD_PRICE,
  packages: {
    starter: PLANS[0].price,
    standart: PLANS[1].price,
    premium: PLANS[2].price,
  },
};
