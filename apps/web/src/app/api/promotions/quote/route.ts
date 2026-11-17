import { z } from "zod";
import { readActivePromo } from "@/features/admin/lib/site-editor";
import { readShieldPrice } from "@/features/orders/lib/shield-pricing";
import { json, sameOrigin } from "@/features/payments/server/http";
import { allowOrderLookup } from "@/features/payments/server/lookup-limit";

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
    return promo ? json({ promo, price }) : json({ error: "Kode promo tidak ditemukan atau sudah kedaluwarsa." }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Kode promo tidak valid." }, 400);
    return json({ error: "Kode promo belum dapat diperiksa. Coba lagi." }, 503);
  }
}
