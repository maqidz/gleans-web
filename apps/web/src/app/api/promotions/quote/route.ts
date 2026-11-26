import { z } from "zod";
import { readActivePromo } from "@/features/admin/lib/site-editor";
import { readShieldPrice } from "@/features/orders/lib/shield-pricing";
import { json, sameOrigin } from "@/features/payments/server/http";
import { allowOrderLookup } from "@/features/payments/server/lookup-limit";
import { dashboardUser } from "@/features/auth/server";
import { guestSession } from "@/features/payments/server/guest";
import { hasCompletedShieldCheck } from "@/features/orders/server/promo-eligibility";
import { RECHECK_PROMO_MESSAGE } from "@/features/orders/lib/promo-eligibility";

const quote = z.object({ code: z.string().trim().min(1).max(40) }).strict();

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    const raw = await request.text();
    const input = raw.length <= 256 && quote.safeParse(JSON.parse(raw));
    if (!input || !input.success) return json({ error: "Kode promo tidak valid." }, 400);
    if (!await allowOrderLookup(request, "promo")) return json({ error: "Terlalu banyak percobaan. Coba lagi dalam satu menit." }, 429);
    const price = await readShieldPrice();
    const promo = await readActivePromo(input.data.code, price);
    if (promo?.requiresCompletedCheck) {
      const [user, guest] = await Promise.all([dashboardUser(), guestSession()]);
      if (!await hasCompletedShieldCheck({ userId: user?.id, guestHash: guest?.hash })) {
        return json({ error: RECHECK_PROMO_MESSAGE, code: "PROMO_REQUIRES_COMPLETED_CHECK" }, 403);
      }
    }
    return promo ? json({ promo, price }) : json({ error: "Kode promo tidak ditemukan atau sudah kedaluwarsa." }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Kode promo tidak valid." }, 400);
    return json({ error: "Kode promo belum dapat diperiksa. Coba lagi." }, 503);
  }
}
