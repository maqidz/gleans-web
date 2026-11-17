import { z } from "zod";
import { formatRupiah } from "@/lib/format";

export const whatsappSchema = z
  .string()
  .trim()
  .min(1, "Nomor WhatsApp wajib diisi.")
  .transform((value) => value.replace(/[\s().-]/g, ""))
  .refine((value) => /^(\+?62|0)8\d{7,12}$/.test(value), "Masukkan nomor WhatsApp Indonesia yang valid.");

type PromoRule = { code: string; label: string; percent?: number; amount?: number };

const PROMO_RULES: PromoRule[] = [
  { code: "GLEANS10", label: "Diskon 10%", percent: 10 },
  { code: "MAHASISWA", label: "Potongan Rp 2.000", amount: 2_000 },
  { code: "SKRIPSIAMAN", label: "Diskon 25%", percent: 25 },
];

export type AppliedPromo = { code: string; label: string; discount: number };

export function calculatePromo(code: string, value: number, percent: boolean, subtotal: number): AppliedPromo {
  const raw = percent ? Math.round((subtotal * value) / 100) : value;
  const discount = Math.min(raw, Math.max(0, subtotal - 1));
  const label = percent ? `Diskon ${value}%` : `Potongan ${formatRupiah(discount)}`;
  return { code, label, discount };
}

export function resolvePromo(input: string, subtotal: number): AppliedPromo | null {
  const code = input.trim().toUpperCase();
  const rule = PROMO_RULES.find((r) => r.code === code);
  if (!rule) return null;
  return calculatePromo(rule.code, rule.percent ?? rule.amount ?? 0, Boolean(rule.percent), subtotal);
}
