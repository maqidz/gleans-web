export type PromoEligibility = { code: string; requiresCompletedCheck?: boolean };

export function requiresCompletedCheck(promo: PromoEligibility) {
  // Existing recheck campaigns also inherit the rule before their next admin edit.
  return promo.requiresCompletedCheck ?? promo.code.trim().toUpperCase() === "HEMAT5RIBU";
}

export const RECHECK_PROMO_MESSAGE = "Promo cek ulang hanya berlaku setelah minimal 1 pemeriksaan selesai. Masuk ke akun pemesan atau buka kembali tautan hasil pesanan sebelumnya, lalu coba lagi.";
