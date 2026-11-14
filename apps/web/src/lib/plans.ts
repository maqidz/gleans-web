export const SHIELD_PRICE = 8_000;

export const PLANS = [
  { id: "starter", name: "Starter", price: 35_000, checks: 5, blurb: "Pas untuk tugas kuliah dan makalah rutin." },
  { id: "standart", name: "Standart", price: 65_000, checks: 10, blurb: "Untuk proposal dan laporan." },
  { id: "premium", name: "Premium", price: 150_000, checks: 25, blurb: "Hemat untuk skripsi, tesis, dan kelompok." },
] as const;
