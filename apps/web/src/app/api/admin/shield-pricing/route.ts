import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { currentAdmin } from "@/features/auth/session";
import { readShieldPricing, saveShieldPricing, SHIELD_PRICING_TAG } from "@/features/orders/lib/shield-pricing";
import { json, sameOrigin } from "@/features/payments/server/http";
import { MAX_SHIELD_PRICE } from "@/lib/plans";

const priceNumber = z.number().int().min(1).max(MAX_SHIELD_PRICE);
const pricingSchema = z.object({
  price: priceNumber,
  packages: z.object({ starter: priceNumber, standart: priceNumber, premium: priceNumber }).strict(),
}).strict();
const edit = z.object({ pricing: pricingSchema, previous: pricingSchema }).strict();

export async function GET() {
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    return json(await readShieldPricing());
  } catch {
    return json({ error: "Harga Shield belum dapat dimuat. Coba lagi." }, 503);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const input = edit.safeParse(await request.json());
    if (!input.success) return json({ error: "Masukkan nominal bulat antara Rp 1 dan Rp 1.000.000." }, 400);

    const saved = await saveShieldPricing(input.data.pricing, input.data.previous);
    if (!saved) return json({ error: "Tarif sudah berubah. Muat ulang harga sebelum menyimpan." }, 409);

    revalidateTag(SHIELD_PRICING_TAG);
    revalidatePath("/");
    revalidatePath("/deteksi-ai");
    return json(saved);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Data tidak valid." }, 400);
    return json({ error: "Harga Shield belum dapat disimpan. Coba lagi." }, 503);
  }
}
