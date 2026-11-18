import { z } from "zod";
import { currentAdmin } from "@/features/auth/session";
import { paymentAdmin } from "@/features/payments/server/repository";
import { json, sameOrigin } from "@/features/payments/server/http";

const activityId = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "Permintaan tidak diizinkan." }, 403);
  try {
    if (!await currentAdmin()) return json({ error: "Akses ditolak." }, 403);
    const through = activityId.safeParse(new URL(request.url).searchParams.get("through"));
    if (!through.success) return json({ error: "Muat ulang riwayat aktivitas sebelum menghapusnya." }, 400);
    // Preserve activity added after the list shown in the confirmation dialog.
    const { error } = await paymentAdmin().database.from("site_editor_activity").delete().lte("id", through.data);
    if (error) throw error;
    return json({ deletedThrough: through.data });
  } catch {
    return json({ error: "Riwayat aktivitas belum dapat dihapus. Coba lagi." }, 503);
  }
}
